import sfxManifest from '../assets/manifest.js';
import { showToast } from '../ui/Toast.js';
import { OdysseyConfig } from './Config.js';
import EventBus from './EventBus.js';

export default class GalacticAudio {
  #path = OdysseyConfig.audio.basePath;
  #sounds = new Map();
  #ctx = null;
  #masterGain = null;
  #panner = null;
  #ambientSources = new Map();

  constructor() {
    this.enabled = false;
    this.initialized = false;
    this.isBusy = false;
    this.idleTimer = null;
    this.#initAudioContext();

    this._unbinds = [];
    this._unbinds.push(EventBus.on('audio:play', (p) => this.play(p?.key, p?.options)));
    this._unbinds.push(
      EventBus.on('audio:toggleMaster', () => {
        const enabled = this.toggleMaster();
        EventBus.emit('audio:toggled', { enabled });
      })
    );
    this._unbinds.push(EventBus.on('audio:setBusy', (v) => this.setBusy(Boolean(v))));
    this._unbinds.push(EventBus.on('audio:injectEnginePower', (v) => this.injectEnginePower(v)));
    this._unbinds.push(EventBus.on('audio:updateSpatialPosition', (p) => this.updateSpatialPosition(p?.x, p?.y)));
    this._unbinds.push(EventBus.on('audio:resetIdleTimer', () => this.resetIdleTimer()));
    this._unbinds.push(EventBus.on('audio:setEnabled', (enabled) => this.setEnabled(enabled)));
    this._unbinds.push(
      EventBus.on('powerSaving:changed', ({ enabled }) => {
        this.setEnabled(!enabled);
      })
    );
  }

  #initAudioContext() {
    const init = async () => {
      if (this.initialized) return;
      this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.#masterGain = this.#ctx.createGain();
      this.#masterGain.gain.value = OdysseyConfig.audio.masterVolume;

      this.#panner = this.#ctx.createPanner();
      this.#panner.panningModel = 'HRTF';
      this.#panner.distanceModel = 'inverse';
      this.#panner.refDistance = 1;
      this.#panner.maxDistance = 10000;
      this.#panner.rolloffFactor = 1;

      this.#panner.connect(this.#masterGain);
      this.#masterGain.connect(this.#ctx.destination);

      await this.#loadAssets();
      this.initialized = true;
    };
    ['click', 'touchstart', 'keydown'].forEach((e) => window.addEventListener(e, init, { once: true }));
  }

  injectEnginePower(velocity) {
    if (!this.enabled || !this.initialized) return;
    const power = Math.min(velocity / 120, 1.0);
    if (power > 0.15) {
      const nowMs = Date.now();
      if (!this._lastEnginePlay || nowMs - this._lastEnginePlay > 100) {
        this.play('hover', { volume: OdysseyConfig.audio.masterVolume * power * 0.3, playbackRate: 0.4 + power * 1.2 });
        this._lastEnginePlay = nowMs;
      }
    }
    if (this.#masterGain) {
      const targetVol = OdysseyConfig.audio.masterVolume * (1.0 + power * 0.4);
      this.#masterGain.gain.setTargetAtTime(targetVol, this.#ctx.currentTime, 0.08);
    }
  }

  async #loadAssets() {
    const sfx = sfxManifest;
    for (const [key, name] of Object.entries(sfx)) {
      try {
        const res = await fetch(`${this.#path}${name}`);
        const buf = await res.arrayBuffer();
        this.#sounds.set(key, await this.#ctx.decodeAudioData(buf));
      } catch (err) {
      }
    }
  }

  updateSpatialPosition(x, y) {
    if (!this.initialized || !this.#panner) return;
    const px = (x / window.innerWidth) * 2 - 1;
    const py = -(y / window.innerHeight) * 2 + 1;
    this.#panner.positionX.setTargetAtTime(px, this.#ctx.currentTime, 0.1);
    this.#panner.positionY.setTargetAtTime(py, this.#ctx.currentTime, 0.1);
    this.#panner.positionZ.setTargetAtTime(0.5, this.#ctx.currentTime, 0.1);
  }

  play(key, options = {}) {
    if (!this.enabled || !this.initialized || !this.#sounds.has(key)) return;
    if (this.isBusy && key === 'hover') return;
    const source = this.#ctx.createBufferSource();
    source.buffer = this.#sounds.get(key);
    const gain = this.#ctx.createGain();
    gain.gain.value = options.volume ?? 1.0;
    source.playbackRate.value = options.playbackRate || 1.0;
    source.connect(gain);
    if (['hover', 'beep', 'pulse', 'wind'].includes(key)) {
      gain.connect(this.#panner);
    } else {
      gain.connect(this.#masterGain);
    }
    if (options.loop) {
      source.loop = true;
      this.#ambientSources.set(key, source);
    }
    source.start(0);
  }

  async toggleMaster() {
    if (!this.initialized) {
      await this.#waitForInitialization();
    }
    this.enabled = !this.enabled;
    localStorage.setItem('audio_enabled', this.enabled);

    if (this.enabled) {
      try {
        if (this.#ctx.state === 'suspended') {
          await this.#ctx.resume();
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
      this.#ambientSources.forEach((s) => s.stop());
      this.#ambientSources.clear();
      clearTimeout(this.idleTimer);
    }
    EventBus.emit('audio:toggled', { enabled: this.enabled });
    return this.enabled;
  }

  async setEnabled(enabled) {
    if (!this.initialized) {
      return false;
    }
    if (this.enabled === enabled) return this.enabled;
    return await this.toggleMaster();
  }

  async #waitForInitialization() {
    return new Promise((resolve) => {
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
    this.idleTimer = setTimeout(() => this.#triggerRandomIdleClip(), OdysseyConfig.audio.idleDelay);
  }

  #triggerRandomIdleClip() {
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
    this.idleTimer = setTimeout(() => this.#triggerRandomIdleClip(), Math.random() * (max - min) + min);
  }

  setBusy(val) {
    this.isBusy = val;
    if (this.#masterGain)
      this.#masterGain.gain.setTargetAtTime(val ? 0.1 : OdysseyConfig.audio.masterVolume, this.#ctx.currentTime, 0.5);
  }
}
