// Audio is now decoupled via EventBus; do not import or instantiate directly
import { OdysseyConfig } from '../core/Config.js';
import EventBus from '../core/EventBus.js';
import { showToast } from '../ui/Toast.js';
import { debounce, setCSS } from '../utils/helpers.js';
import ParticleEngine from './ParticleSystem.js';

export default class GridArchitect {
  #activeYears = new Map();
  #today = new Date();
  // audio handled via EventBus
  #particles = new ParticleEngine();
  #viewport = document.getElementById('viewport');
  #canvas = document.getElementById('infinite-canvas');
  #ionDrive = document.getElementById('ion-drive');
  #lastScrollPos = 0;
  #isScrolling = false;
  #isWarping = false;
  #isInteractingAllowed = true;
  #mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  #current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  #lastMouse = { x: 0, y: 0 };
  #isRandomMode = OdysseyConfig.display.defaultMode === 'random';

  constructor() {
    this.totalYears = OdysseyConfig.temporal.totalYears;
    this.yearHeight = window.innerHeight;
    this.startY = (this.totalYears / 2) * this.yearHeight;

    // Load saved state from localStorage
    this.#loadState();

    // Listen for audio toggle events to show a toast (decoupled via EventBus)
    EventBus.on('audio:toggled', (p = {}) => {
      showToast(p.enabled ? 'Ion Drive System Online' : 'Audio Systems Disabled');
      // Save audio state when toggled
      this.#saveState();
    });

    this.#runBoot();
  }

  #loadState() {
    const saved = localStorage.getItem('odyssey_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        this.#isRandomMode = state.isRandomMode ?? this.#isRandomMode;
        if (state.scrollPosition) {
          this.startY = state.scrollPosition;
        }
        // Don't auto-restore audio state due to browser autoplay policy
        // User must manually enable audio via interaction
      } catch (e) {
        showToast('System State Restoration Failed', 2000);
      }
    }
  }

  #saveState() {
    try {
      // Get audio state via localStorage (AudioEngine saves it)
      const audioEnabled = localStorage.getItem('audio_enabled') !== 'false';
      const state = {
        theme: document.documentElement.getAttribute('data-theme'),
        isRandomMode: this.#isRandomMode,
        scrollPosition: this.#viewport?.scrollTop || this.startY,
        audioEnabled: audioEnabled,
        lastVisit: new Date().toISOString(),
      };
      localStorage.setItem('odyssey_state', JSON.stringify(state));
    } catch (e) {
      showToast('System State Backup Failed', 2000);
    }
  }

  async #runBoot() {
    const bar = document.getElementById('load-progress');
    const steps = [
      { p: 40, t: 'Initializing Navigation Systems' },
      { p: 80, t: 'Calibrating Audio Processors' },
      { p: 100, t: 'Systems Ready for Departure' },
    ];
    for (const s of steps) {
      await new Promise((r) => setTimeout(r, 400));
      bar.style.width = `${s.p}%`;
      document.getElementById('load-status').innerText = s.t;
    }
    this.#init();
    EventBus.emit('app:booted', { architect: this });
    setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 600);
  }

  #init() {
    this.#applyTheme(localStorage.getItem('theme') || 'dark');
    this.#canvas.style.height = `${this.totalYears * this.yearHeight}px`;
    this.#viewport.scrollTop = this.startY;

    // Save state on visibility change or before unload
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.#saveState();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.#saveState();
    });

    // Auto-save every 30 seconds
    setInterval(() => this.#saveState(), 30000);

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const b = e.target;
          const year = parseInt(b.dataset.year);
          const wasActive = b.classList.contains('active');
          b.classList.toggle('active', e.isIntersecting);
          if (e.isIntersecting && !wasActive && 'vibrate' in navigator) {
            navigator.vibrate(8);
          }
          if (!e.isIntersecting) {
            const currentIdx = Math.round(this.#viewport.scrollTop / this.yearHeight);
            const currentYear = this.#today.getFullYear() + (currentIdx - this.totalYears / 2);
            if (Math.abs(year - currentYear) > 2) {
              this.#activeYears.delete(year);
              this.observer.unobserve(b);
              b.remove();
            }
          }
          if (e.isIntersecting && this.#viewport.scrollTop < this.#lastScrollPos) {
            const c = b.querySelector('.grid-container');
            if (c && b.classList.contains('is-scrolling')) c.scrollTop = c.scrollHeight;
          }
        });
        this.#lastScrollPos = this.#viewport.scrollTop;
      },
      { threshold: 0.05, rootMargin: '20% 0px' }
    );

    this.#setupListeners();
    this.#cursorLoop();
    this.#render();
    setTimeout(() => this.jumpToToday(true), 150);
  }

  // toasts are handled via EventBus -> src/ui/Toast.js

  #lockInteractions() {
    this.#isInteractingAllowed = false;
    EventBus.emit('audio:setBusy', true);
    this.#viewport.classList.add('is-locked');
    document.documentElement.style.setProperty('--ion-glow', '200px');
  }
  #unlockInteractions() {
    setTimeout(() => {
      this.#isInteractingAllowed = true;
      EventBus.emit('audio:setBusy', false);
      this.#viewport.classList.remove('is-locked');
      document.documentElement.style.setProperty('--ion-glow', '700px');
    }, 400);
  }

  jumpToToday(isInitial = false) {
    if (this.#isWarping) return;
    const currentYear =
      this.#today.getFullYear() + (Math.round(this.#viewport.scrollTop / this.yearHeight) - this.totalYears / 2);
    const targetYear = this.#today.getFullYear();
    const distance = Math.abs(targetYear - currentYear);
    this.#isWarping = true;
    this.#lockInteractions();
    this.#ionDrive.classList.add('jumping');
    let warpClass = '';
    let duration = OdysseyConfig.display.warpDuration;
    if (distance > 20) {
      warpClass = 'warping-far';
      EventBus.emit('audio:play', { key: 'jump', options: { volume: 0.8 } });
      duration = 1800;
      for (let i = 0; i < 15; i++) {
        this.#particles.spawn(this.#current.x, this.#current.y, false);
      }
    } else if (distance >= 2) {
      warpClass = 'warping-near';
      EventBus.emit('audio:play', { key: 'warp', options: { volume: 0.5 } });
      duration = 1200;
    } else {
      EventBus.emit('audio:play', { key: 'scroll' });
    }
    if (warpClass) this.#viewport.classList.add(warpClass);
    this.#viewport.style.scrollBehavior = 'smooth';
    this.#viewport.scrollTo({ top: this.startY, behavior: 'smooth' });
    if (!isInitial)
      showToast(distance > 20 ? 'Initiating Interstellar Jump Sequence' : 'Executing Local Warp Protocol');
    setTimeout(() => {
      this.#viewport.classList.remove('warping-far', 'warping-near');
      this.#ionDrive.classList.remove('jumping');
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          this.#particles.spawn(this.#current.x, this.#current.y, false);
        }, i * 50);
      }
      const b = this.#activeYears.get(targetYear);
      if (b) {
        const t = b.querySelector('.cell.today'),
          c = b.querySelector('.grid-container');
        if (t && c) c.scrollTo({ top: t.offsetTop - window.innerHeight / 3, behavior: 'smooth' });
      }
      EventBus.emit('audio:play', { key: 'beep' });
      this.#isWarping = false;
      this.#unlockInteractions();
    }, duration);
  }

  #setupListeners() {
    window.addEventListener(
      'pointermove',
      (e) => {
        this.#mouse.x = e.clientX;
        this.#mouse.y = e.clientY;
        const velocity = Math.sqrt(
          Math.pow(e.clientX - this.#lastMouse.x, 2) + Math.pow(e.clientY - this.#lastMouse.y, 2)
        );
        if (velocity > OdysseyConfig.physics.exhaustThreshold) {
          this.#particles.spawn(e.clientX, e.clientY, true);
        }
        EventBus.emit('audio:injectEnginePower', velocity);
        this.#lastMouse = { x: e.clientX, y: e.clientY };
        EventBus.emit('audio:resetIdleTimer');
      },
      { passive: true }
    );

    document.addEventListener(
      'mouseover',
      (e) => {
        if (!this.#isInteractingAllowed || this.#isWarping || this.#isScrolling) return;
        const cell = e.target.closest('.cell');
        if (cell) {
          const isF = cell.classList.contains('filler');
          this.#ionDrive.classList.add('active');
          document.documentElement.style.setProperty('--ion-glow', isF ? '200px' : '900px');
          EventBus.emit('audio:play', {
            key: 'hover',
            options: { volume: isF ? 0.04 : 0.25, playbackRate: isF ? 0.5 : 1.0 },
          });
        }
      },
      { passive: true }
    );

    document.addEventListener(
      'mouseout',
      (e) => {
        if (e.target.closest('.cell') && this.#isInteractingAllowed) {
          this.#ionDrive.classList.remove('active');
          document.documentElement.style.setProperty('--ion-glow', '700px');
        }
      },
      { passive: true }
    );

    const handleScrollEnd = debounce(() => {
      this.#isScrolling = false;
      this.#unlockInteractions();
      setCSS(document.documentElement, { '--chroma-dist': 0 });
    }, 150);

    this.#viewport.addEventListener(
      'scroll',
      () => {
        if (!this.#isScrolling) {
          this.#lockInteractions();
          EventBus.emit('audio:play', { key: 'scroll' });
        }
        this.#isScrolling = true;
        if (!this.ticking) {
          window.requestAnimationFrame(() => {
            this.#render();
            this.#handleParallax();
            const velocity = Math.abs(this.#viewport.scrollTop - this.#lastScrollPos);
            if (velocity > 1) {
              const chromaAmount = Math.min(12, velocity / 10);
              setCSS(document.documentElement, { '--chroma-dist': chromaAmount });
            }
            this.#lastScrollPos = this.#viewport.scrollTop;
            this.ticking = false;
          });
          this.ticking = true;
        }
        handleScrollEnd();
      },
      { passive: true }
    );

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 't') {
        EventBus.emit('audio:play', { key: 'theme' });
        this.#toggleTheme();
      }
      if (k === 'm') {
        EventBus.emit('audio:toggleMaster');
      }
      if (k === ' ') {
        e.preventDefault();
        this.jumpToToday();
      }
      if (k === 'r') this.#setMode(true);
      if (k === 's') this.#setMode(false);
    });

    document.addEventListener('click', (e) => {
      if (!this.#isInteractingAllowed) return;
      this.#particles.spawn(e.clientX, e.clientY, false);
      EventBus.emit('audio:play', { key: 'beep', options: { volume: 0.15 } });
    });
    window.addEventListener('resize', () => {
      this.yearHeight = window.innerHeight;
      this.#canvas.style.height = `${this.totalYears * this.yearHeight}px`;
      this.#particles.resize && this.#particles.resize();
      this.#render();
    });
  }

  #cursorLoop() {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    this.#current.x += (this.#mouse.x - this.#current.x) * OdysseyConfig.physics.cursorInertia;
    this.#current.y += (this.#mouse.y - this.#current.y) * OdysseyConfig.physics.cursorInertia;
    document.documentElement.style.setProperty('--ion-x', this.#current.x);
    document.documentElement.style.setProperty('--ion-y', this.#current.y);
    EventBus.emit('audio:updateSpatialPosition', { x: this.#current.x, y: this.#current.y });
    requestAnimationFrame(() => this.#cursorLoop());
  }

  #handleParallax() {
    const idx = Math.round(this.#viewport.scrollTop / this.yearHeight);
    const y = this.#today.getFullYear() + (idx - this.totalYears / 2);
    const b = this.#activeYears.get(y);
    if (b && !this.#isScrolling) {
      const offset = (this.#viewport.scrollTop % this.yearHeight) - this.yearHeight / 2;
      const wm = b.querySelector('.watermark-embedded');
      if (wm) wm.style.transform = `translate3d(0, ${offset * 0.06}px, 0)`;
    }
  }

  #render() {
    const idx = Math.round(this.#viewport.scrollTop / this.yearHeight);
    const base = this.#today.getFullYear() + (idx - this.totalYears / 2);
    for (let i = -1; i <= 1; i++) this.#drawYear(base + i, (idx + i) * this.yearHeight);
  }

  #drawYear(year, yPos) {
    if (this.#activeYears.has(year)) return;
    const block = document.createElement('section');
    block.className = 'year-block';
    block.style.top = `${yPos}px`;
    block.dataset.year = year;
    const jan1 = new Date(year, 0, 1);
    const days = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    let cols = vw >= 600 ? Math.ceil(Math.ceil(Math.sqrt(373 * (vw / vh))) / 7) * 7 : 7;
    let gO = this.#isRandomMode ? Math.floor(jan1.getTime() / 86400000) % cols : (jan1.getDay() + 6) % 7;
    const rows = Math.ceil((days + gO) / cols);
    const isSc = vh / rows < 60;
    if (isSc) block.classList.add('is-scrolling');
    const cont = document.createElement('div');
    cont.className = 'grid-container';
    cont.style.overflowY = isSc ? 'auto' : 'hidden';
    const wm = document.createElement('div');
    wm.className = 'watermark-embedded';
    wm.innerText = year;
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
        itD.toDateString() === this.#today.toDateString() && isM ? 'today' : ''
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
    this.#canvas.append(block);
    this.#activeYears.set(year, block);
    this.observer.observe(block);
  }

  #setMode(r) {
    if (this.#isRandomMode === r) return;
    this.#isRandomMode = r;
    this.#activeYears.forEach((b) => {
      this.observer.unobserve(b);
      b.remove();
    });
    this.#activeYears.clear();
    this.#render();
    this.#saveState();
    EventBus.emit('audio:play', { key: 'beep' });
    showToast(r ? 'Randomized Navigation Mode Activated' : 'Chronological Calendar Mode Activated');
  }

  #applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
  }
  #toggleTheme() {
    const v = document.getElementById('theme-veil');
    v.classList.add('active');
    setTimeout(() => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      this.#applyTheme(next);
      localStorage.setItem('theme', next);
      this.#saveState();
      setTimeout(() => v.classList.remove('active'), 200);
    }, 400);
  }
}
