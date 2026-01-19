import sfxManifest from '../assets/manifest';
import { showToast } from '../ui/Toast';
import EventBus from './';
import { OdysseyConfig } from './Config';
import { EVENT_KEYS, STORAGE_KEYS } from './Keys';

type SfxKey = keyof typeof sfxManifest;

export default class AudioEngine {
  ambientSources: Map<string, AudioBufferSourceNode> = new Map();
  audioContext: AudioContext | null = null;
  enabled: boolean = false;
  idleTimer: any = null;
  initialized: boolean = false;
  isBusy: boolean = false;
  lastEnginePlay?: number = undefined;
  masterGain: GainNode | null = null;
  panner: PannerNode | null = null;
  path: string = OdysseyConfig.audio.basePath;
  sounds: Map<string, AudioBuffer> = new Map();
  unbinds: Array<() => void> = [];

  constructor() {
    this.initAudioContext();

    const handlers = [
      EventBus.on(EVENT_KEYS.AUDIO_PLAY, (p) => {
        if (!p?.key) return;
        this.play(p.key as SfxKey, p?.options);
      }),
      EventBus.on(EVENT_KEYS.AUDIO_TOGGLE_MASTER, async () => {
        const enabled = await this.toggleMaster();

        EventBus.emit(EVENT_KEYS.AUDIO_TOGGLED, { enabled });
      }),
      EventBus.on(EVENT_KEYS.AUDIO_SET_BUSY, (v) => this.setBusy(v)),
      EventBus.on(EVENT_KEYS.AUDIO_INJECT_ENGINE_POWER, (v) => this.injectEnginePower(v)),
      EventBus.on(EVENT_KEYS.AUDIO_UPDATE_SPATIAL_POSITION, (p) => this.updateSpatialPosition(p.x, p.y)),
      EventBus.on(EVENT_KEYS.AUDIO_RESET_IDLE_TIMER, () => this.resetIdleTimer()),
      EventBus.on(EVENT_KEYS.AUDIO_SET_ENABLED, (enabled: boolean) => this.setEnabled(enabled)),
      EventBus.on(EVENT_KEYS.POWER_SAVING_CHANGED, ({ enabled }) => {
        this.setEnabled(!enabled);
      }),
    ];

    this.unbinds.push(...handlers);
  }

  private initAudioContext() {
    const initialize = async () => {
      if (this.initialized) return;

      this.audioContext = new globalThis.AudioContext();

      this.panner = this.audioContext.createPanner();
      this.masterGain = this.audioContext.createGain();

      this.panner.distanceModel = 'inverse';
      this.panner.maxDistance = 10000;
      this.panner.panningModel = 'HRTF';
      this.panner.refDistance = 1;
      this.panner.rolloffFactor = 1;

      this.panner.connect(this.masterGain);

      this.masterGain.gain.value = OdysseyConfig.audio.masterVolume;

      this.masterGain.connect(this.audioContext.destination);

      await this.loadAssets();

      this.initialized = true;
    };

    ['click', 'keydown', 'touchstart'].forEach((event) => {
      globalThis.addEventListener(event, initialize as EventListener, { once: true, passive: true });
    });
  }

  injectEnginePower(velocity: number) {
    if (!this.enabled || !this.initialized) return;

    const power = Math.min(velocity / 120, 1);

    if (power > 0.15) {
      const now = Date.now();

      if (!this.lastEnginePlay || now - this.lastEnginePlay > 100) {
        this.play('hover', {
          playbackRate: 0.4 + power * 1.2,
          volume: OdysseyConfig.audio.masterVolume * power * 0.3,
        });

        this.lastEnginePlay = now;
      }
    }

    if (this.masterGain && this.audioContext) {
      const targetVolume = OdysseyConfig.audio.masterVolume * (1 + power * 0.4);

      this.masterGain.gain.setTargetAtTime(targetVolume, this.audioContext.currentTime, 0.08);
    }
  }

  private async loadAssets() {
    const manifest = sfxManifest;

    for (const [key, file] of Object.entries(manifest)) {
      const response = await fetch(`${this.path}${file}`);

      const buffer = await response.arrayBuffer();

      if (this.audioContext) {
        this.sounds.set(key, await this.audioContext.decodeAudioData(buffer));
      }
    }
  }

  updateSpatialPosition(x: number, y: number) {
    if (!this.initialized || !this.panner || !this.audioContext) return;

    const px = (x / globalThis.innerWidth) * 2 - 1;
    const py = -(y / globalThis.innerHeight) * 2 + 1;

    this.panner.positionX.setTargetAtTime(px, this.audioContext.currentTime, 0.1);
    this.panner.positionY.setTargetAtTime(py, this.audioContext.currentTime, 0.1);
    this.panner.positionZ.setTargetAtTime(0.5, this.audioContext.currentTime, 0.1);
  }

  play(
    key: SfxKey,
    options: { volume?: number; playbackRate?: number; loop?: boolean } = {} satisfies {
      volume?: number;
      playbackRate?: number;
      loop?: boolean;
    },
  ) {
    if (!this.enabled || !this.initialized || !this.sounds.has(key)) return;

    if (this.isBusy && key === 'hover') return;

    if (!this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = this.sounds.get(key) || null;

    const gain = this.audioContext.createGain();
    gain.gain.value = options.volume ?? 1;

    source.playbackRate.value = options.playbackRate || 1;

    source.connect(gain);

    if (['beep', 'hover', 'pulse', 'wind'].includes(key) && this.panner) {
      gain.connect(this.panner);
    } else if (this.masterGain) {
      gain.connect(this.masterGain);
    }

    if (options.loop) {
      source.loop = true;
      this.ambientSources.set(key, source);
    }

    source.start(0);
  }

  async toggleMaster() {
    if (!this.initialized) {
      await this.waitForInitialization();
    }

    const nextEnabled = !this.enabled;

    localStorage.setItem(STORAGE_KEYS.AUDIO_ENABLED, String(nextEnabled));

    if (nextEnabled) {
      this.enabled = true;

      try {
        if (this.audioContext?.state === 'suspended') {
          await this.audioContext.resume();
        }

        this.play('enable');

        this.play('base', {
          loop: true,
          volume: OdysseyConfig.audio.ambientBaseVolume,
        });

        this.resetIdleTimer();
      } catch {
        showToast('Audio System Initialization Failed', 2000);

        this.enabled = false;
      }
    } else {
      this.playImmediate('mute');

      setTimeout(() => {
        this.enabled = false;
        this.ambientSources.forEach((source) => {
          source.stop();
        });
        this.ambientSources.clear();
        clearTimeout(this.idleTimer);
        EventBus.emit(EVENT_KEYS.AUDIO_TOGGLED, { enabled: false });
      }, 800);

      return false;
    }

    EventBus.emit(EVENT_KEYS.AUDIO_TOGGLED, { enabled: this.enabled });

    return this.enabled;
  }

  private playImmediate(key: SfxKey, options: { volume?: number } = {} satisfies { volume?: number }) {
    if (!this.initialized || !this.sounds.has(key) || !this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = this.sounds.get(key) || null;

    const gain = this.audioContext.createGain();
    gain.gain.value = options.volume ?? 1;

    source.connect(gain);

    if (this.masterGain) {
      gain.connect(this.masterGain);
    }

    source.start(0);
  }

  async setEnabled(enabled: boolean) {
    if (!this.initialized) return false;

    if (this.enabled === enabled) return this.enabled;

    return await this.toggleMaster();
  }

  private async waitForInitialization() {
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

    this.idleTimer = setTimeout(() => this.triggerRandomIdleClip(), OdysseyConfig.audio.idleDelay);
  }

  private triggerRandomIdleClip() {
    if (!this.enabled || this.isBusy) return;

    const clips: Array<{ key: SfxKey; volume: number }> = [
      { key: 'engine' as SfxKey, volume: 0.15 },
      { key: 'pulse' as SfxKey, volume: 0.15 },
      { key: 'stellar' as SfxKey, volume: 0.2 },
      { key: 'wind' as SfxKey, volume: 0.2 },
    ];

    const clip = clips[Math.floor(Math.random() * clips.length)];

    this.play(clip.key, { volume: clip.volume });

    const [min, max] = OdysseyConfig.audio.idleInterval;

    this.idleTimer = setTimeout(() => this.triggerRandomIdleClip(), Math.random() * (max - min) + min);
  }

  setBusy(busy: boolean) {
    this.isBusy = busy;

    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(
        busy ? 0.1 : OdysseyConfig.audio.masterVolume,
        this.audioContext.currentTime,
        0.5,
      );
    }
  }
}
