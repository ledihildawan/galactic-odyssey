import sfxManifest from '../assets/manifest';
import { showToast } from '../ui/Toast';
import { OdysseyConfig } from './Config';
import EventBus from './EventBus';

export default class GalacticAudio {
  private _path: string = OdysseyConfig.audio.basePath;
  private _sounds: Map<string, AudioBuffer> = new Map();
  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _panner: PannerNode | null = null;
  private _ambientSources: Map<string, AudioBufferSourceNode> = new Map();

  enabled: boolean = false;
  initialized: boolean = false;
  isBusy: boolean = false;
  idleTimer: any = null;
  private _unbinds: Array<() => void> = [];
  private _lastEnginePlay?: number;

  constructor() {
    this._initAudioContext();

    this._unbinds = [];
    this._unbinds.push(EventBus.on('audio:play', (p: any) => this.play(p?.key, p?.options)));
    this._unbinds.push(
      EventBus.on('audio:toggleMaster', async () => {
        const enabled = await this.toggleMaster();
        EventBus.emit('audio:toggled', { enabled });
      })
    );
    this._unbinds.push(EventBus.on('audio:setBusy', (v: any) => this.setBusy(Boolean(v))));
    this._unbinds.push(EventBus.on('audio:injectEnginePower', (v: number) => this.injectEnginePower(v)));
    this._unbinds.push(EventBus.on('audio:updateSpatialPosition', (p: any) => this.updateSpatialPosition(p?.x, p?.y)));
    this._unbinds.push(EventBus.on('audio:resetIdleTimer', () => this.resetIdleTimer()));
    this._unbinds.push(EventBus.on('audio:setEnabled', (enabled: boolean) => this.setEnabled(enabled)));
    this._unbinds.push(
      EventBus.on('powerSaving:changed', ({ enabled }: any) => {
        this.setEnabled(!enabled);
      })
    );
  }

  private _initAudioContext() {
    const init = async () => {
      if (this.initialized) return;
      // @ts-ignore
      this._ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = OdysseyConfig.audio.masterVolume;

      this._panner = this._ctx.createPanner();
      this._panner.panningModel = 'HRTF';
      this._panner.distanceModel = 'inverse';
      this._panner.refDistance = 1;
      this._panner.maxDistance = 10000;
      this._panner.rolloffFactor = 1;

      this._panner.connect(this._masterGain);
      this._masterGain.connect(this._ctx.destination);

      await this._loadAssets();
      this.initialized = true;
    };
    ['click', 'touchstart', 'keydown'].forEach((e) =>
      window.addEventListener(e, init as EventListener, { once: true })
    );
  }

  injectEnginePower(velocity: number) {
    if (!this.enabled || !this.initialized) return;
    const power = Math.min(velocity / 120, 1.0);
    if (power > 0.15) {
      const nowMs = Date.now();
      if (!this._lastEnginePlay || nowMs - this._lastEnginePlay > 100) {
        this.play('hover', { volume: OdysseyConfig.audio.masterVolume * power * 0.3, playbackRate: 0.4 + power * 1.2 });
        this._lastEnginePlay = nowMs;
      }
    }
    if (this._masterGain && this._ctx) {
      const targetVol = OdysseyConfig.audio.masterVolume * (1.0 + power * 0.4);
      this._masterGain.gain.setTargetAtTime(targetVol, this._ctx.currentTime, 0.08);
    }
  }

  private async _loadAssets() {
    const sfx = sfxManifest as Record<string, string>;
    for (const [key, name] of Object.entries(sfx)) {
      try {
        const res = await fetch(`${this._path}${name}`);
        const buf = await res.arrayBuffer();
        if (this._ctx) this._sounds.set(key, await this._ctx.decodeAudioData(buf));
      } catch (err) {
        // ignore load errors silently
      }
    }
  }

  updateSpatialPosition(x: number, y: number) {
    if (!this.initialized || !this._panner || !this._ctx) return;
    const px = (x / window.innerWidth) * 2 - 1;
    const py = -(y / window.innerHeight) * 2 + 1;
    this._panner.positionX.setTargetAtTime(px, this._ctx.currentTime, 0.1);
    this._panner.positionY.setTargetAtTime(py, this._ctx.currentTime, 0.1);
    this._panner.positionZ.setTargetAtTime(0.5, this._ctx.currentTime, 0.1);
  }

  play(key: string, options: { volume?: number; playbackRate?: number; loop?: boolean } = {}) {
    if (!this.enabled || !this.initialized || !this._sounds.has(key)) return;
    if (this.isBusy && key === 'hover') return;
    if (!this._ctx) return;
    const source = this._ctx.createBufferSource();
    source.buffer = this._sounds.get(key) || null;
    const gain = this._ctx.createGain();
    gain.gain.value = options.volume ?? 1.0;
    source.playbackRate.value = options.playbackRate || 1.0;
    source.connect(gain);
    if (['hover', 'beep', 'pulse', 'wind'].includes(key) && this._panner) {
      gain.connect(this._panner);
    } else if (this._masterGain) {
      gain.connect(this._masterGain);
    }
    if (options.loop) {
      source.loop = true;
      this._ambientSources.set(key, source);
    }
    source.start(0);
  }

  async toggleMaster() {
    if (!this.initialized) {
      await this._waitForInitialization();
    }
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('audio_enabled', String(this.enabled));
    } catch (e) {}

    if (this.enabled) {
      try {
        if (this._ctx && this._ctx.state === 'suspended') {
          await this._ctx.resume();
        }
        this.play('enable');
        this.play('base', { volume: OdysseyConfig.audio.ambientBaseVolume, loop: true });
        this.resetIdleTimer();
      } catch (err) {
        showToast('Audio System Initialization Failed', 2000);
        this.enabled = false;
      }
    } else {
      this.play('mute');
      this._ambientSources.forEach((s) => s.stop());
      this._ambientSources.clear();
      clearTimeout(this.idleTimer);
    }
    EventBus.emit('audio:toggled', { enabled: this.enabled });
    return this.enabled;
  }

  async setEnabled(enabled: boolean) {
    if (!this.initialized) {
      return false;
    }
    if (this.enabled === enabled) return this.enabled;
    return await this.toggleMaster();
  }

  private async _waitForInitialization() {
    return new Promise<void>((resolve) => {
      if (this.initialized) {
        resolve();
      } else {
        const check = setInterval(() => {
          if (this.initialized) {
            clearInterval(check);
            resolve();
          }
        }, 50);
        setTimeout(() => {
          clearInterval(check);
          resolve();
        }, 5000);
      }
    });
  }

  resetIdleTimer() {
    if (!this.enabled) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this._triggerRandomIdleClip(), OdysseyConfig.audio.idleDelay);
  }

  private _triggerRandomIdleClip() {
    if (!this.enabled || this.isBusy) return;
    const clips = [
      { k: 'pulse', v: 0.15 },
      { k: 'wind', v: 0.2 },
      { k: 'engine', v: 0.15 },
      { k: 'stellar', v: 0.2 },
    ];
    const c = clips[Math.floor(Math.random() * clips.length)];
    this.play(c.k, { volume: c.v });
    const [min, max] = OdysseyConfig.audio.idleInterval;
    this.idleTimer = setTimeout(() => this._triggerRandomIdleClip(), Math.random() * (max - min) + min);
  }

  setBusy(val: boolean) {
    this.isBusy = val;
    if (this._masterGain && this._ctx)
      this._masterGain.gain.setTargetAtTime(val ? 0.1 : OdysseyConfig.audio.masterVolume, this._ctx.currentTime, 0.5);
  }
}
