import EventBus from '../core';
import { OdysseyConfig } from '../core/Config';
import { EVENT_KEYS, STORAGE_KEYS } from '../core/Keys';
import { showToast } from '../ui/Toast';
import { setCSS } from '../utils/domUtils';
import { debounce } from '../utils/functionUtils';
import ParticleEngine from './ParticleSystem';

export default class GridArchitect {
  private readonly _activeYears = new Map<number, HTMLElement>();
  private readonly _today = new Date();
  private readonly _particles = new ParticleEngine();
  private readonly _viewport: HTMLElement = document.getElementById('viewport') as HTMLElement;
  private readonly _canvas: HTMLElement = document.getElementById('infinite-canvas') as HTMLElement;
  private readonly _ionDrive: HTMLElement = document.getElementById('ion-drive') as HTMLElement;
  private _lastScrollPos = 0;
  private _isScrolling = false;
  private _isWarping = false;
  private _isInteractingAllowed = true;
  private readonly _mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  private readonly _current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  private _lastMouse = { x: 0, y: 0 };
  private _isRandomMode = OdysseyConfig.display.defaultMode === 'random';

  static readonly shortcutMap: Record<string, (e: KeyboardEvent, self: GridArchitect) => void> = {
    'ctrl+t': (e: KeyboardEvent, self: GridArchitect) => {
      e.preventDefault();
      EventBus.emit(EVENT_KEYS.AUDIO_PLAY, { key: 'theme' });
      self._toggleTheme();
    },
    m: (_e: KeyboardEvent, self: GridArchitect) => {
      EventBus.emit(EVENT_KEYS.AUDIO_TOGGLE_MASTER);
    },
    home: (e: KeyboardEvent, self: GridArchitect) => {
      e.preventDefault();
      self.jumpToToday();
    },
    r: (_e: KeyboardEvent, self: GridArchitect) => {
      self._setMode(true);
    },
    c: (_e: KeyboardEvent, self: GridArchitect) => {
      self._setMode(false);
    },
  };

  totalYears: number;
  yearHeight: number;
  startY: number;
  animationsEnabled: boolean;
  observer: IntersectionObserver | null = null;
  ticking = false;

  constructor() {
    this.totalYears = OdysseyConfig.temporal.totalYears;
    this.yearHeight = window.innerHeight;
    this.startY = (this.totalYears / 2) * this.yearHeight;

    this.animationsEnabled = true;

    this._loadState();

    EventBus.on(EVENT_KEYS.AUDIO_TOGGLED, (p?: { enabled: boolean }) => {
      const payload = p ?? { enabled: false };
      showToast(payload.enabled ? 'Ion Drive System Online' : 'Audio Systems Disabled');
      this._saveState();
    });

    EventBus.on(EVENT_KEYS.ANIMATION_SET_ENABLED, (enabled: boolean) => {
      this.animationsEnabled = enabled;
      if (enabled) {
        this._cursorLoop();
      }
    });

    setTimeout(() => void this._runBoot(), 0);
  }

  private _loadState() {
    const saved = localStorage.getItem(STORAGE_KEYS.ODYSSEY_STATE);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        this._isRandomMode = state.isRandomMode ?? this._isRandomMode;
        if (state.scrollPosition) {
          this.startY = state.scrollPosition;
        }
        EventBus.emit(EVENT_KEYS.STATE_RESTORED, state);
      } catch (e) {
        console.error('State restore failed', e);
        showToast('System State Restoration Failed', 2000);
      }
    }
  }

  private _saveState() {
    try {
      const audioEnabled = localStorage.getItem(STORAGE_KEYS.AUDIO_ENABLED) !== 'false';
      const state = {
        theme: document.documentElement.dataset.theme,
        isRandomMode: this._isRandomMode,
        scrollPosition: this._viewport?.scrollTop || this.startY,
        audioEnabled,
        lastVisit: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.ODYSSEY_STATE, JSON.stringify(state));
      EventBus.emit(EVENT_KEYS.STATE_SAVED, state);
    } catch (e) {
      console.error('State save failed', e);
      showToast('System State Backup Failed', 2000);
    }
  }

  private async _runBoot() {
    const bar = document.getElementById('load-progress');
    const steps = [
      { p: 40, t: 'Initializing Navigation Systems' },
      { p: 80, t: 'Calibrating Audio Processors' },
      { p: 100, t: 'Systems Ready for Departure' },
    ];
    for (const s of steps) {
      await new Promise((r) => setTimeout(r, 400));
      if (bar instanceof HTMLElement) bar.style.width = `${s.p}%`;
      const statusEl = document.getElementById('load-status');
      if (statusEl instanceof HTMLElement) statusEl.innerText = s.t;
    }
    this._init();
    EventBus.emit(EVENT_KEYS.APP_BOOTED, { architect: this });
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen instanceof HTMLElement) setTimeout(() => loadingScreen.classList.add('hidden'), 600);
  }

  private _init() {
    this._applyTheme(localStorage.getItem(STORAGE_KEYS.THEME) || 'dark');
    this._canvas.style.height = `${this.totalYears * this.yearHeight}px`;
    this._viewport.scrollTop = this.startY;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._saveState();
    });
    window.addEventListener('beforeunload', () => this._saveState());
    setInterval(() => this._saveState(), 30000);

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const b = e.target as HTMLElement;
          const year = Number.parseInt(b.dataset.year || '0', 10);
          const wasActive = b.classList.contains('active');
          b.classList.toggle('active', e.isIntersecting);
          if (e.isIntersecting && !wasActive && 'vibrate' in navigator) navigator.vibrate?.(8);
          if (!e.isIntersecting) {
            const currentIdx = Math.round(this._viewport.scrollTop / this.yearHeight);
            const currentYear = this._today.getFullYear() + (currentIdx - this.totalYears / 2);
            if (Math.abs(year - currentYear) > 2) {
              this._activeYears.delete(year);
              this.observer!.unobserve(b);
              b.remove();
            }
          }
          if (e.isIntersecting && this._viewport.scrollTop < this._lastScrollPos) {
            const c = b.querySelector('.grid-container');
            if (c instanceof HTMLElement && b.classList.contains('is-scrolling')) c.scrollTop = c.scrollHeight;
          }
        });
        this._lastScrollPos = this._viewport.scrollTop;
      },
      { threshold: 0.05, rootMargin: '20% 0px' }
    );

    this._setupListeners();
    this._cursorLoop();
    this._render();
    setTimeout(() => this.jumpToToday(true), 150);
  }

  private _setIonGlow(value: string) {
    document.documentElement.style.setProperty('--ion-glow', value);
  }

  private _lockInteractions() {
    this._isInteractingAllowed = false;
    this._viewport.classList.add('is-locked');
    this._setIonGlow('200px');
    EventBus.emit(EVENT_KEYS.AUDIO_SET_BUSY, true);
  }

  private _unlockInteractions() {
    setTimeout(() => {
      this._isInteractingAllowed = true;
      EventBus.emit(EVENT_KEYS.AUDIO_SET_BUSY, false);
      this._viewport.classList.remove('is-locked');
      this._setIonGlow('700px');
    }, 400);
  }

  jumpToToday(isInitial = false) {
    if (this._isWarping) return;
    const targetYear = this._today.getFullYear();
    const todayScrollTop =
      (targetYear - (this._today.getFullYear() - Math.floor(this.totalYears / 2))) * this.yearHeight;
    const currentYear =
      this._today.getFullYear() + (Math.round(this._viewport.scrollTop / this.yearHeight) - this.totalYears / 2);
    const distance = Math.abs(targetYear - currentYear);
    this._isWarping = true;
    this._lockInteractions();
    EventBus.emit(EVENT_KEYS.NAV_WARP_START, { currentYear, targetYear, distance, isInitial });
    this._ionDrive.classList.add('jumping');
    let warpClass = '';
    let duration = OdysseyConfig.display.warpDuration;
    if (distance > 20) {
      warpClass = 'warping-far';
      EventBus.emit(EVENT_KEYS.AUDIO_PLAY, { key: 'jump', options: { volume: 0.8 } });
      duration = 1800;
      for (let i = 0; i < 15; i++) {
        this._particles.spawn(this._current.x, this._current.y, false);
      }
    } else if (distance >= 2) {
      warpClass = 'warping-near';
      EventBus.emit(EVENT_KEYS.AUDIO_PLAY, { key: 'warp', options: { volume: 0.5 } });
      duration = 1200;
    } else {
      EventBus.emit(EVENT_KEYS.AUDIO_PLAY, { key: 'scroll' });
    }
    if (warpClass) this._viewport.classList.add(warpClass);
    this._viewport.style.scrollBehavior = 'smooth';
    this._viewport.scrollTo({ top: todayScrollTop, behavior: 'smooth' });
    if (isInitial) {
      /* initial boot - no toast */
    } else {
      showToast(distance > 20 ? 'Initiating Interstellar Jump Sequence' : 'Executing Local Warp Protocol');
    }
    setTimeout(() => {
      this._viewport.classList.remove('warping-far', 'warping-near');
      this._ionDrive.classList.remove('jumping');
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          this._particles.spawn(this._current.x, this._current.y, false);
        }, i * 50);
      }
      const b = this._activeYears.get(targetYear);
      if (b) {
        const t = b.querySelector('.cell.today');
        const c = b.querySelector('.grid-container');
        if (t instanceof HTMLElement && c instanceof HTMLElement)
          c.scrollTo({ top: t.offsetTop - globalThis.innerHeight / 3, behavior: 'smooth' });
      }
      EventBus.emit(EVENT_KEYS.AUDIO_PLAY, { key: 'beep' });
      this._isWarping = false;
      EventBus.emit(EVENT_KEYS.NAV_WARP_END, { targetYear, duration });
      this._unlockInteractions();
    }, duration);
  }

  private _setupListeners() {
    globalThis.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        this._mouse.x = e.clientX;
        this._mouse.y = e.clientY;
        const velocity = Math.sqrt(
          Math.pow(e.clientX - this._lastMouse.x, 2) + Math.pow(e.clientY - this._lastMouse.y, 2)
        );
        if (velocity > OdysseyConfig.physics.exhaustThreshold) {
          this._particles.spawn(e.clientX, e.clientY, true);
        }
        EventBus.emit(EVENT_KEYS.AUDIO_INJECT_ENGINE_POWER, velocity);
        EventBus.emit(EVENT_KEYS.INPUT_POINTER_MOVE, { x: e.clientX, y: e.clientY, velocity });
        this._lastMouse = { x: e.clientX, y: e.clientY };
        EventBus.emit(EVENT_KEYS.AUDIO_RESET_IDLE_TIMER);
      },
      { passive: true }
    );

    document.addEventListener(
      'mouseover',
      (e: MouseEvent) => {
        if (!this._isInteractingAllowed || this._isWarping || this._isScrolling) return;
        const maybeCell = (e.target as Element).closest('.cell');
        if (maybeCell instanceof HTMLElement) {
          const isF = maybeCell.classList.contains('filler');
          this._ionDrive.classList.add('active');
          this._setIonGlow(isF ? '200px' : '900px');
          EventBus.emit(EVENT_KEYS.AUDIO_PLAY, {
            key: 'hover',
            options: { volume: isF ? 0.04 : 0.25, playbackRate: isF ? 0.5 : 1 },
          });
          EventBus.emit(EVENT_KEYS.INPUT_HOVER, { filler: isF });
        }
      },
      { passive: true }
    );

    document.addEventListener(
      'mouseout',
      (e: MouseEvent) => {
        const maybe = (e.target as Element).closest('.cell');
        if (maybe instanceof HTMLElement && this._isInteractingAllowed) {
          this._ionDrive.classList.remove('active');
          this._setIonGlow('700px');
        }
      },
      { passive: true }
    );

    const handleScrollEnd = debounce(() => {
      this._isScrolling = false;
      this._unlockInteractions();
      EventBus.emit(EVENT_KEYS.NAV_SCROLL_END, { top: this._viewport.scrollTop });
      setCSS(document.documentElement, { '--chroma-dist': 0 });
    }, 150);

    this._viewport.addEventListener(
      'scroll',
      () => {
        if (!this._isScrolling) {
          this._lockInteractions();
          EventBus.emit(EVENT_KEYS.NAV_SCROLL_START, { top: this._viewport.scrollTop });
          EventBus.emit(EVENT_KEYS.AUDIO_PLAY, { key: 'scroll' });
        }
        this._isScrolling = true;
        if (!this.ticking) {
          globalThis.requestAnimationFrame(() => {
            this._render();
            this._handleParallax();
            const velocity = Math.abs(this._viewport.scrollTop - this._lastScrollPos);
            if (velocity > 1) {
              const chromaAmount = Math.min(12, velocity / 10);
              setCSS(document.documentElement, { '--chroma-dist': chromaAmount });
            }
            this._lastScrollPos = this._viewport.scrollTop;
            this.ticking = false;
          });
          this.ticking = true;
        }
        handleScrollEnd();
      },
      { passive: true }
    );

    globalThis.addEventListener('keydown', (e: KeyboardEvent) => {
      let k = e.key.toLowerCase();
      if ((e as KeyboardEvent & { ctrlKey?: boolean }).ctrlKey) k = 'ctrl+' + k;
      const handler = (GridArchitect.shortcutMap as Record<string, (e: KeyboardEvent, self: GridArchitect) => void>)[k];
      if (typeof handler === 'function') handler(e, this);
    });

    document.addEventListener('click', (e: MouseEvent) => {
      if (!this._isInteractingAllowed) return;
      this._particles.spawn(e.clientX, e.clientY, false);
      EventBus.emit(EVENT_KEYS.AUDIO_PLAY, { key: 'beep', options: { volume: 0.15 } });
      EventBus.emit(EVENT_KEYS.INPUT_CLICK, { x: e.clientX, y: e.clientY });
    });

    globalThis.addEventListener('resize', () => {
      this.yearHeight = globalThis.innerHeight;
      this._canvas.style.height = `${this.totalYears * this.yearHeight}px`;
      this._particles.resize?.();
      this._render();
    });
  }

  private _cursorLoop() {
    if (!this.animationsEnabled) return;
    if (globalThis.matchMedia('(pointer: coarse)').matches) return;
    this._current.x += (this._mouse.x - this._current.x) * OdysseyConfig.physics.cursorInertia;
    this._current.y += (this._mouse.y - this._current.y) * OdysseyConfig.physics.cursorInertia;
    document.documentElement.style.setProperty('--ion-x', String(this._current.x));
    document.documentElement.style.setProperty('--ion-y', String(this._current.y));
    EventBus.emit(EVENT_KEYS.AUDIO_UPDATE_SPATIAL_POSITION, { x: this._current.x, y: this._current.y });
    globalThis.requestAnimationFrame(() => this._cursorLoop());
  }

  private _handleParallax() {
    if (!this.animationsEnabled) return;
    const idx = Math.round(this._viewport.scrollTop / this.yearHeight);
    const y = this._today.getFullYear() + (idx - this.totalYears / 2);
    const b = this._activeYears.get(y);
    if (b && !this._isScrolling) {
      const offset = (this._viewport.scrollTop % this.yearHeight) - this.yearHeight / 2;
      const wm = b.querySelector('.watermark-embedded');
      if (wm instanceof HTMLElement) wm.style.transform = `translate3d(0, ${offset * 0.06}px, 0)`;
    }
  }

  private _render() {
    if (!this.animationsEnabled) return;
    const idx = Math.round(this._viewport.scrollTop / this.yearHeight);
    const base = this._today.getFullYear() + (idx - this.totalYears / 2);
    for (let i = -1; i <= 1; i++) {
      this._drawYear(base + i, (idx + i) * this.yearHeight);
    }
  }

  private _drawYear(year: number, yPos: number) {
    if (this._activeYears.has(year)) return;
    const block = document.createElement('section');
    block.className = 'year-block';
    block.style.top = `${yPos}px`;
    block.dataset.year = String(year);
    const jan1 = new Date(year, 0, 1);
    const days = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    let cols = vw >= 600 ? Math.ceil(Math.ceil(Math.sqrt(373 * (vw / vh))) / 7) * 7 : 7;
    let gO = this._isRandomMode ? Math.floor(jan1.getTime() / 86400000) % cols : (jan1.getDay() + 6) % 7;
    const rows = Math.ceil((days + gO) / cols);
    const isSc = vh / rows < 60;
    if (isSc) block.classList.add('is-scrolling');
    const cont = document.createElement('div');
    cont.className = 'grid-container';
    cont.style.overflowY = isSc ? 'auto' : 'hidden';
    const wm = document.createElement('div');
    wm.className = 'watermark-embedded';
    wm.innerText = String(year);
    cont.append(wm);
    const grid = document.createElement('div');
    grid.className = 'grid-layer';
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = isSc ? `repeat(${rows}, minmax(60px, 1fr))` : `repeat(${rows}, 1fr)`;
    grid.style.height = isSc ? 'auto' : '100%';
    const frag = document.createDocumentFragment();
    const itD = new Date(year, 0, 1 - gO);
    for (let s = 0; s < cols * rows; s++) {
      const isM = itD.getFullYear() === year;
      const cell = document.createElement('div');
      let fC = !isM ? (itD.getFullYear() < year ? 'filler-past' : 'filler-future') : '';
      cell.className = `cell ${!isM ? 'filler ' + fC : ''} ${
        itD.toDateString() === this._today.toDateString() && isM ? 'today' : ''
      } ${isM && itD.getDate() === 1 ? 'month-start' : ''} ${
        isM && (itD.getDay() === 0 || itD.getDay() === 6) ? 'weekend' : ''
      } ${isM && itD.getDay() === 1 ? 'week-start' : ''}`;
      cell.innerHTML = `<div class="cell-content"><span class="info-meta ${
        itD.getDate() === 1 && isM ? 'top-label' : ''
      }">${
        isM && (itD.getDate() === 1 || s === gO) ? OdysseyConfig.temporal.monthsShort[itD.getMonth()] : ''
      }</span><span class="date-num">${itD.getDate()}</span><span class="info-meta">${
        isM ? OdysseyConfig.temporal.daysShort[itD.getDay()] : ''
      }</span></div>`;
      frag.append(cell);
      itD.setDate(itD.getDate() + 1);
    }
    grid.append(frag);
    cont.append(grid);
    block.append(cont);
    this._canvas.append(block);
    this._activeYears.set(year, block);
    this.observer!.observe(block);
  }

  private _setMode(r: boolean) {
    if (this._isRandomMode === r) return;
    this._isRandomMode = r;
    this._activeYears.forEach((b) => {
      this.observer!.unobserve(b);
      b.remove();
    });
    this._activeYears.clear();
    this._render();
    this._saveState();
    EventBus.emit(EVENT_KEYS.AUDIO_PLAY, { key: 'beep' });
    EventBus.emit(EVENT_KEYS.NAV_MODE_CHANGED, { isRandomMode: r });
    showToast(r ? 'Randomized Navigation Mode Activated' : 'Chronological Calendar Mode Activated');
  }

  private _applyTheme(t: string) {
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
  }

  private _toggleTheme() {
    const v = document.getElementById('theme-veil');
    if (!(v instanceof HTMLElement)) return;
    v.classList.add('active');
    setTimeout(() => {
      const current = document.documentElement.dataset.theme;
      const next = current === 'light' ? 'dark' : 'light';
      this._applyTheme(next);
      localStorage.setItem('theme', next);
      EventBus.emit(EVENT_KEYS.UI_THEME_CHANGED, { theme: next });
      this._saveState();
      setTimeout(() => v.classList.remove('active'), 200);
    }, 400);
  }
}
