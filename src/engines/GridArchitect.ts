// =====================================================
// FILE: GridArchitect.ts (File Utama - Orchestrator)
// =====================================================

import EventBus from '../core';
import { OdysseyConfig } from '../core/Config';
import { EVENT_KEYS, STORAGE_KEYS } from '../core/Keys';
import { showToast } from '../ui/Toast';
import { setCSS } from '../utils/domUtils';
import { debounce } from '../utils/functionUtils';
import ParticleEngine from './ParticleSystem';

/**
 * GridArchitect acts as the main orchestrator for the application.
 * It initializes and coordinates all other specialized controllers.
 */
export default class GridArchitect {
  private readonly _viewport = document.getElementById('viewport') as HTMLElement;
  private readonly _canvas = document.getElementById('infinite-canvas') as HTMLElement;

  private readonly _particles = new ParticleEngine();
  private readonly _stateManager = new StateManager();
  private readonly _gridRenderer = new GridRenderer(this._canvas);
  private readonly _effectsController = new EffectsController(this._particles);
  private readonly _navigationController = new NavigationController(
    this._viewport,
    this._gridRenderer,
    this._stateManager,
    this._effectsController
  );
  private readonly _interactionManager = new InteractionManager(this._navigationController, this._effectsController);

  constructor() {
    this._setupEventBusListeners();
    this._runBootSequence();
  }

  private _setupEventBusListeners() {
    EventBus.on(EVENT_KEYS.AUDIO_TOGGLED, (p?: { enabled: boolean }) => {
      const payload = p ?? { enabled: false };
      showToast(payload.enabled ? 'Ion Drive System Online' : 'Audio Systems Disabled');
      this._stateManager.save();
    });

    EventBus.on(EVENT_KEYS.ANIMATION_SET_ENABLED, (enabled: boolean) => {
      this._effectsController.setAnimationsEnabled(enabled);
    });
  }

  private async _runBootSequence() {
    const bar = document.getElementById('load-progress');
    const statusEl = document.getElementById('load-status');
    const steps = [
      { p: 40, t: 'Initializing Navigation Systems' },
      { p: 80, t: 'Calibrating Audio Processors' },
      { p: 100, t: 'Systems Ready for Departure' },
    ];

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (bar instanceof HTMLElement) bar.style.width = `${step.p}%`;
      if (statusEl instanceof HTMLElement) statusEl.innerText = step.t;
    }

    this._initializeApp();
    EventBus.emit(EVENT_KEYS.APP_BOOTED, { architect: this });

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen instanceof HTMLElement) {
      setTimeout(() => loadingScreen.classList.add('hidden'), 600);
    }
  }

  private _initializeApp() {
    this._stateManager.load();
    this._navigationController.initialize();
    this._interactionManager.initialize();
    this._effectsController.startCursorLoop();
  }

  public destroy() {
    this._effectsController.destroy();
    this._navigationController.destroy();
    this._interactionManager.destroy();
    this._gridRenderer.destroy();
    this._stateManager.destroy();
    EventBus.off(EVENT_KEYS.AUDIO_TOGGLED);
    EventBus.off(EVENT_KEYS.ANIMATION_SET_ENABLED);
  }
}

// =====================================================
// FILE: controllers/StateManager.ts
// =====================================================

export class StateManager {
  private _saveInterval: any;
  private _isPendingSave = false;

  constructor() {
    this._setupAutoSave();
  }

  private _setupAutoSave() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
    globalThis.addEventListener('beforeunload', () => this.save());
    this._saveInterval = globalThis.setInterval(() => this.save(), 30000);
  }

  public save() {
    if (this._isPendingSave) return;

    this._isPendingSave = true;
    // Debounce save to avoid rapid calls
    setTimeout(() => {
      try {
        const viewport = document.getElementById('viewport') as HTMLElement;
        const currentScroll = viewport?.scrollTop || 0;
        const yearHeight = globalThis.innerHeight;
        const totalYears = OdysseyConfig.temporal.totalYears;
        const baseYearOffset = Math.floor(totalYears / 2);
        const currentYearIndex = Math.round(currentScroll / yearHeight);

        const state = {
          theme: document.documentElement.dataset.theme,
          yearIndex: currentYearIndex,
          scrollPosition: currentScroll,
          audioEnabled: localStorage.getItem(STORAGE_KEYS.AUDIO_ENABLED) !== 'false',
          lastVisit: new Date().toISOString(),
        };

        localStorage.setItem(STORAGE_KEYS.ODYSSEY_STATE, JSON.stringify(state));
        EventBus.emit(EVENT_KEYS.STATE_SAVED, state);
      } catch (error) {
        console.error('Failed to save state:', error);
      } finally {
        this._isPendingSave = false;
      }
    }, 500);
  }

  public load() {
    const saved = localStorage.getItem(STORAGE_KEYS.ODYSSEY_STATE);
    if (!saved) return;

    try {
      const state = JSON.parse(saved);
      // This state should be passed to relevant controllers, not set globally
      EventBus.emit(EVENT_KEYS.STATE_RESTORED, state);
      return state;
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
      return null;
    }
  }

  public destroy() {
    globalThis.clearInterval(this._saveInterval);
  }
}

// =====================================================
// FILE: controllers/GridRenderer.ts
// =====================================================

export class GridRenderer {
  private readonly _canvas: HTMLElement;
  private readonly _activeYears = new Map<number, HTMLElement>();
  private _isRandomMode = OdysseyConfig.display.defaultMode === 'random';

  constructor(canvas: HTMLElement) {
    this._canvas = canvas;
  }

  public setCanvasHeight(totalYears: number, yearHeight: number) {
    this._canvas.style.height = `${totalYears * yearHeight}px`;
  }

  public renderYear(year: number, yPos: number) {
    if (this._activeYears.has(year)) {
      const existing = this._activeYears.get(year)!;
      existing.style.top = `${yPos}px`;
      return;
    }

    const block = this._createYearBlock(year, yPos);
    this._canvas.append(block);
    this._activeYears.set(year, block);
  }

  public destroyYear(year: number) {
    const block = this._activeYears.get(year);
    if (block) {
      block.remove();
      this._activeYears.delete(year);
    }
  }

  public destroyAllYears() {
    this._activeYears.forEach((block) => block.remove());
    this._activeYears.clear();
  }

  public getActiveYearElement(year: number): HTMLElement | null {
    return (
      this._activeYears.get(year) ||
      (this._canvas.querySelector(`.year-block[data-year="${year}"]`) as HTMLElement | null)
    );
  }

  private _createYearBlock(year: number, yPos: number): HTMLElement {
    const block = document.createElement('section');
    block.className = 'year-block';
    block.style.top = `${yPos}px`;
    block.style.zIndex = String(year);
    block.dataset.year = String(year);

    const jan1 = new Date(year, 0, 1);
    const days = this._isLeapYear(year) ? 366 : 365;
    const { vw, vh } = this._getViewportSize();
    let cols = vw >= 600 ? Math.ceil(Math.ceil(Math.sqrt(373 * (vw / vh))) / 7) * 7 : 7;
    // Grid offset calculation
    let gridOffset = this._isRandomMode ? Math.floor(jan1.getTime() / 86400000) % cols : (jan1.getDay() + 6) % 7;

    const rows = Math.ceil((days + gridOffset) / cols);
    const isScrolling = vh / rows < 60;
    if (isScrolling) block.classList.add('is-scrolling');

    const container = document.createElement('div');
    container.className = 'grid-container';
    container.style.overflowY = isScrolling ? 'auto' : 'hidden';

    const watermark = document.createElement('div');
    watermark.className = 'watermark-embedded';
    watermark.innerText = String(year);
    container.append(watermark);

    const grid = document.createElement('div');
    grid.className = 'grid-layer';
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = isScrolling ? `repeat(${rows}, minmax(60px, 1fr))` : `repeat(${rows}, 1fr)`;
    grid.style.height = isScrolling ? 'auto' : '100%';

    const fragment = document.createDocumentFragment();
    const iteratorDate = new Date(year, 0, 1 - gridOffset);

    for (let step = 0; step < cols * rows; step++) {
      const isMonthStart = iteratorDate.getDate() === 1 && iteratorDate.getFullYear() === year;
      const isGutter = step === gridOffset && iteratorDate.getFullYear() === year;
      const label = isMonthStart || isGutter ? OdysseyConfig.temporal.monthsShort[iteratorDate.getMonth()] : undefined;
      const cell = this._createCell(iteratorDate, year, label, isMonthStart);
      fragment.append(cell);
      iteratorDate.setDate(iteratorDate.getDate() + 1);
    }

    grid.append(fragment);
    container.append(grid);
    block.append(container);

    return block;
  }

  private _createCell(date: Date, year: number, label?: string, isTopLabel?: boolean): HTMLElement {
    const cell = document.createElement('div');
    const dateKey = date.toDateString();
    cell.dataset.dateRef = dateKey;
    cell.className = this._getCellClassName(date, year, dateKey);

    const monthLabel =
      label ??
      (date.getFullYear() === year && date.getDate() === 1 ? OdysseyConfig.temporal.monthsShort[date.getMonth()] : '');
    cell.innerHTML = `
      <div class="cell-content">
        <span class="info-meta ${isTopLabel ? 'top-label' : ''}">${monthLabel}</span>
        <span class="date-num">${date.getDate()}</span>
        <span class="info-meta">${
          date.getFullYear() === year ? OdysseyConfig.temporal.daysShort[date.getDay()] : ''
        }</span>
      </div>`;
    return cell;
  }

  private _getCellClassName(date: Date, year: number, dateKey: string): string {
    const isCurrentYear = date.getFullYear() === year;
    const isToday = dateKey === new Date().toDateString();
    const isWeekend = isCurrentYear && (date.getDay() === 0 || date.getDay() === 6);

    let className = 'cell';
    if (!isCurrentYear) {
      className += ` filler ${date.getFullYear() < year ? 'filler-past' : 'filler-future'}`;
    }
    if (isToday) className += ' today';
    if (isCurrentYear && date.getDate() === 1) className += ' month-start';
    if (isWeekend) className += ' weekend';
    if (isCurrentYear && date.getDay() === 1) className += ' week-start';

    return className;
  }

  private _isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  private _getViewportSize() {
    return { vw: globalThis.innerWidth, vh: globalThis.innerHeight };
  }

  public destroy() {
    this.destroyAllYears();
  }
}

// =====================================================
// FILE: controllers/NavigationController.ts
// =====================================================

interface WarpOptions {
  distance?: number;
  isInitial?: boolean;
  landingDateKey?: string;
  emitAudioKey?: string;
}

export class NavigationController {
  private static readonly SCROLL_SNAP_CLASS = 'no-snap';
  private static readonly BOOT_JUMP_DELAY = 50;

  private readonly _viewport: HTMLElement;
  private readonly _gridRenderer: GridRenderer;
  private readonly _stateManager: StateManager;
  private readonly _effectsController: EffectsController;

  private readonly _today = new Date();
  private _totalYears: number;
  private _yearHeight: number;
  private _startY: number;
  private _baseYearOffset: number;

  private _lastScrollPos = 0;
  private _isScrolling = false;
  private _isWarping = false;
  private _isInteractingAllowed = true;
  private _quantumLandingDate: Date | null = null;

  private observer: IntersectionObserver | null = null;
  private _observerPaused = false;
  private ticking = false;

  private _handleScrollEnd = debounce(() => this._onScrollEnd(), 150);

  constructor(
    viewport: HTMLElement,
    gridRenderer: GridRenderer,
    stateManager: StateManager,
    effectsController: EffectsController
  ) {
    this._viewport = viewport;
    this._gridRenderer = gridRenderer;
    this._stateManager = stateManager;
    this._effectsController = effectsController;

    this._totalYears = OdysseyConfig.temporal.totalYears;
    this._yearHeight = globalThis.innerHeight;
    this._baseYearOffset = Math.floor(this._totalYears / 2);
    this._startY = this._baseYearOffset * this._yearHeight;

    this._setupEventBusListeners();
  }

  private _setupEventBusListeners() {
    EventBus.on(EVENT_KEYS.STATE_RESTORED, (state: any) => {
      if (state.yearIndex !== undefined) this._startY = state.yearIndex * this._yearHeight;
      else if (state.scrollPosition && !isNaN(state.scrollPosition)) this._startY = state.scrollPosition;
    });
  }

  public initialize() {
    this._gridRenderer.setCanvasHeight(this._totalYears, this._yearHeight);
    this._setupIntersectionObserver();
    this._setupScrollListener();

    requestAnimationFrame(() => {
      this._viewport.scrollTop = this._startY;
      this._render();
      setTimeout(() => {
        this._lastScrollPos = this._viewport.scrollTop;
        this.jumpToToday(true);
      }, NavigationController.BOOT_JUMP_DELAY);
    });
  }

  public jumpToToday(isInitial = false) {
    if (this._isWarping && !isInitial) return;

    this._yearHeight = globalThis.innerHeight;
    const targetScrollTop = this._baseYearOffset * this._yearHeight;
    const targetYear = this._today.getFullYear();
    const { currentYear } = this._getCurrentScrollData();
    const distance = Math.abs(targetYear - currentYear);

    if (distance === 0 && Math.abs(this._viewport.scrollTop - targetScrollTop) < 1 && !isInitial) return;

    const audioKey = !isInitial ? (distance > 20 ? 'jump' : distance >= 2 ? 'warp' : 'scroll') : undefined;
    if (!isInitial) showToast(distance > 20 ? 'Executing Quantum Home Sequence' : 'Returning to Local Timeline');
    this._warpTo(targetYear, targetScrollTop, { distance, isInitial, emitAudioKey: audioKey });
  }

  public jumpToRandom() {
    if (this._isWarping) return;
    this._yearHeight = globalThis.innerHeight;
    const randomOffset = Math.floor(Math.random() * this._totalYears);
    const targetYear = this._today.getFullYear() + (randomOffset - this._baseYearOffset);
    const targetScrollTop = randomOffset * this._yearHeight;

    const isLeap = this._isLeapYear(targetYear);
    const randomDayOfYear = Math.floor(Math.random() * (isLeap ? 366 : 365)) + 1;
    const landingDate = new Date(targetYear, 0, 1);
    landingDate.setDate(randomDayOfYear);
    this._quantumLandingDate = landingDate;

    const { currentYear } = this._getCurrentScrollData();
    const distance = Math.abs(targetYear - currentYear);

    showToast(`Quantum Jump: Heading to ${landingDate.toDateString()}`, 3000);
    this._effectsController.playAudio('jump', { volume: 0.9 });
    this._warpTo(targetYear, targetScrollTop, {
      distance,
      isInitial: false,
      landingDateKey: landingDate.toDateString(),
      duration: 2000,
    });
  }

  public handleScroll() {
    if (!this._isScrolling) {
      this._lockInteractions();
      EventBus.emit(EVENT_KEYS.NAV_SCROLL_START, { top: this._viewport.scrollTop });
      this._effectsController.playAudio('scroll');
    }
    this._isScrolling = true;
    if (!this.ticking) {
      requestAnimationFrame(() => {
        this._render();
        this._handleParallax();
        const velocity = Math.abs(this._viewport.scrollTop - this._lastScrollPos);
        if (velocity > 1) setCSS(document.documentElement, { '--chroma-dist': Math.min(12, velocity / 10) });
        this._lastScrollPos = this._viewport.scrollTop;
        this.ticking = false;
      });
      this.ticking = true;
    }
    this._handleScrollEnd();
  }

  public handleResize() {
    this._yearHeight = globalThis.innerHeight;
    this._gridRenderer.setCanvasHeight(this._totalYears, this._yearHeight);
    this._gridRenderer.destroyAllYears();
    this._effectsController.resizeParticles();
    this.jumpToToday(true);
  }

  private _setupScrollListener() {
    this._viewport.addEventListener('scroll', () => this.handleScroll(), { passive: true });
  }

  private _setupIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const block = entry.target as HTMLElement;
          const year = Number.parseInt(block.dataset.year || '0', 10);
          const wasActive = block.classList.contains('active');
          block.classList.toggle('active', entry.isIntersecting);
          if (entry.isIntersecting && !wasActive && 'vibrate' in navigator) navigator.vibrate?.(8);

          if (!entry.isIntersecting && block.dataset.keep !== 'true') {
            const currentYear = this._getCurrentYearFromScroll();
            if (Math.abs(year - currentYear) > 2) {
              this._gridRenderer.destroyYear(year);
              this.observer!.unobserve(block);
            }
          }
        });
      },
      { threshold: 0.01, rootMargin: '50% 0px' }
    );
  }

  private _warpTo(targetYear: number, targetScrollTop: number, opts?: WarpOptions) {
    const { currentYear } = this._getCurrentScrollData();
    const distance = opts?.distance ?? Math.abs(targetYear - currentYear);
    const isInitial = !!opts?.isInitial;
    const duration = opts?.duration ?? (isInitial ? 0 : distance > 20 ? 2000 : distance >= 2 ? 1200 : 500);

    this._prepareWarp(distance);
    this._executeWarp(targetYear, targetScrollTop, targetYear, duration, opts);
    this._finalizeWarp(targetYear, duration, opts);
  }

  private _prepareWarp(distance: number) {
    this._isWarping = true;
    this._lockInteractions();
    this._effectsController.setIonDriveActive(true);
    this._viewport.classList.add(distance > 20 ? 'warping-far' : distance >= 2 ? 'warping-near' : '');
    this._viewport.classList.add(NavigationController.SCROLL_SNAP_CLASS);
    if (this.observer && !this._observerPaused) {
      this.observer.disconnect();
      this._observerPaused = true;
    }
  }

  private _executeWarp(
    targetYear: number,
    targetScrollTop: number,
    targetIdx: number,
    duration: number,
    opts?: WarpOptions
  ) {
    if (opts?.emitAudioKey) this._effectsController.playAudio(opts.emitAudioKey);

    const windowSize = this._getPreRenderWindowSize(opts?.distance ?? 0);
    for (let y = targetYear - windowSize; y <= targetYear + windowSize; y++) {
      const idx = targetIdx + (y - targetYear);
      const yPos = idx * this._yearHeight;
      this._gridRenderer.renderYear(y, yPos);
    }

    const immediateBlock = this._gridRenderer.getActiveYearElement(targetYear);
    if (immediateBlock) {
      immediateBlock.dataset.keep = 'true';
      setTimeout(() => delete immediateBlock.dataset.keep, duration + 500);
    }

    requestAnimationFrame(() => {
      this._viewport.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    });
  }

  private _finalizeWarp(targetYear: number, duration: number, opts?: WarpOptions) {
    setTimeout(() => {
      this._viewport.classList.remove('warping-far', 'warping-near', NavigationController.SCROLL_SNAP_CLASS);
      this._effectsController.setIonDriveActive(false);
      this._isWarping = false;
      this._unlockInteractions();

      let block = this._gridRenderer.getActiveYearElement(targetYear);
      if (block) {
        block.dataset.keep = 'true';
        this._scrollContainerToCell(block, opts?.landingDateKey, !!opts?.isInitial);
        setTimeout(() => delete block.dataset.keep, 800);
      }

      this._stateManager.save();
      this._render();

      if (this._observerPaused) {
        this._reobserveActiveYears();
        this._observerPaused = false;
      }
      EventBus.emit(EVENT_KEYS.NAV_WARP_END, { targetYear, duration });
      this._effectsController.playAudio('beep');
    }, duration);
  }

  private _scrollContainerToCell(block: HTMLElement, dateKey?: string, isInitial?: boolean) {
    const container = block.querySelector('.grid-container') as HTMLElement;
    if (!container) return;

    const targetCell = dateKey
      ? (block.querySelector(`.cell[data-date-ref="${dateKey}"]`) as HTMLElement)
      : (block.querySelector('.cell.today') as HTMLElement);

    if (targetCell) {
      requestAnimationFrame(() => {
        try {
          container.scrollTo({
            top: targetCell.offsetTop - globalThis.innerHeight / 3,
            behavior: isInitial ? 'auto' : 'smooth',
          });
        } catch {
          container.scrollTop = Math.max(0, targetCell.offsetTop - globalThis.innerHeight / 3);
        }
      });
    }
  }

  private _render() {
    const currentIdx = Math.floor(this._viewport.scrollTop / this._yearHeight);
    const baseYear = this._today.getFullYear() + (currentIdx - this._baseYearOffset);
    for (let i = -1; i <= 1; i++) {
      const targetYear = baseYear + i;
      const targetYPos = (currentIdx + i) * this._yearHeight;
      this._gridRenderer.renderYear(targetYear, targetYPos);
    }
  }

  private _onScrollEnd() {
    this._isScrolling = false;
    this._unlockInteractions();
    this._stateManager.save();
    EventBus.emit(EVENT_KEYS.NAV_SCROLL_END, { top: this._viewport.scrollTop });
    setCSS(document.documentElement, { '--chroma-dist': 0 });
  }

  private _handleParallax() {
    if (!this._effectsController.animationsEnabled) return;
    const year = this._getCurrentYearFromScroll();
    const block = this._gridRenderer.getActiveYearElement(year);
    if (block) {
      const offset = (this._viewport.scrollTop % this._yearHeight) - this._yearHeight / 2;
      const watermark = block.querySelector('.watermark-embedded') as HTMLElement;
      if (watermark) watermark.style.transform = `translate3d(0, ${offset * 0.06}px, 0)`;
    }
  }

  private _getCurrentScrollData() {
    const currentScroll = this._viewport.scrollTop === 0 ? this._startY : this._viewport.scrollTop;
    const currentIdx = Math.round(currentScroll / this._yearHeight);
    const currentYear = this._today.getFullYear() + (currentIdx - this._baseYearOffset);
    return { currentScroll, currentIdx, currentYear };
  }

  private _getCurrentYearFromScroll(): number {
    return this._getCurrentScrollData().currentYear;
  }

  private _getPreRenderWindowSize(distance: number): number {
    if (distance > 50) return 5;
    if (distance > 20) return 3;
    return 2;
  }

  private _reobserveActiveYears() {
    if (!this.observer) return;
    document.querySelectorAll('.year-block').forEach((block) => this.observer!.observe(block));
  }

  private _lockInteractions() {
    this._isInteractingAllowed = false;
    this._viewport.classList.add('is-locked');
    this._effectsController.setIonGlow('200px');
    EventBus.emit(EVENT_KEYS.AUDIO_SET_BUSY, true);
  }

  private _unlockInteractions() {
    setTimeout(() => {
      this._isInteractingAllowed = true;
      EventBus.emit(EVENT_KEYS.AUDIO_SET_BUSY, false);
      this._viewport.classList.remove('is-locked');
      this._effectsController.setIonGlow('700px');
    }, 400);
  }

  private _isLeapYear(y: number) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  public destroy() {
    this.observer?.disconnect();
  }
}

// =====================================================
// FILE: controllers/InteractionManager.ts
// =====================================================

export class InteractionManager {
  private _boundKeydown?: (e: KeyboardEvent) => void;
  private _boundClick?: (e: MouseEvent) => void;
  private _boundResize?: () => void;

  constructor(
    private readonly _navigationController: NavigationController,
    private readonly _effectsController: EffectsController
  ) {}

  public initialize() {
    this._boundKeydown = (e: KeyboardEvent) => this._handleKeyboardInput(e);
    this._boundClick = (e: MouseEvent) => this._handleClick(e);
    this._boundResize = () => this._navigationController.handleResize();

    globalThis.addEventListener('keydown', this._boundKeydown);
    document.addEventListener('click', this._boundClick);
    globalThis.addEventListener('resize', this._boundResize);

    this._effectsController.setupMouseListeners();
  }

  private _handleKeyboardInput(e: KeyboardEvent) {
    let key = e.key.toLowerCase();
    if (e.ctrlKey) key = 'ctrl+' + key;
    switch (key) {
      case 'ctrl+.':
        e.preventDefault();
        this._effectsController.playAudio('theme');
        this._effectsController.toggleTheme();
        break;
      case 'm':
        EventBus.emit(EVENT_KEYS.AUDIO_TOGGLE_MASTER);
        break;
      case 'home':
        e.preventDefault();
        this._navigationController.jumpToToday();
        break;
      case 'r':
        this._setMode(true);
        break;
      case 'c':
        this._setMode(false);
        break;
      case 'x':
        this._navigationController.jumpToRandom();
        break;
    }
  }

  private _handleClick(e: MouseEvent) {
    this._effectsController.spawnClickParticles(e.clientX, e.clientY);
    this._effectsController.playAudio('beep', { volume: 0.15 });
    EventBus.emit(EVENT_KEYS.INPUT_CLICK, { x: e.clientX, y: e.clientY });
  }

  private _setMode(isRandom: boolean) {
    // This logic needs to be communicated to the GridRenderer
    EventBus.emit(EVENT_KEYS.NAV_MODE_CHANGED, { isRandomMode: isRandom });
    showToast(isRandom ? 'Randomized Navigation Mode Activated' : 'Chronological Calendar Mode Activated');
  }

  public destroy() {
    if (this._boundKeydown) globalThis.removeEventListener('keydown', this._boundKeydown);
    if (this._boundClick) document.removeEventListener('click', this._boundClick);
    if (this._boundResize) globalThis.removeEventListener('resize', this._boundResize);
    this._effectsController.removeMouseListeners();
  }
}

// =====================================================
// FILE: controllers/EffectsController.ts
// =====================================================

export class EffectsController {
  private readonly _particles: ParticleEngine;
  private readonly _ionDrive = document.getElementById('ion-drive') as HTMLElement;

  private readonly _mouse = { x: globalThis.innerWidth / 2, y: globalThis.innerHeight / 2 };
  private readonly _current = { x: globalThis.innerWidth / 2, y: globalThis.innerHeight / 2 };
  private _lastMouse = { x: 0, y: 0 };

  private _boundPointerMove?: (e: PointerEvent) => void;
  private _boundMouseOver?: (e: MouseEvent) => void;
  private _boundMouseOut?: (e: MouseEvent) => void;

  animationsEnabled = true;

  constructor(particles: ParticleEngine) {
    this._particles = particles;
  }

  public setAnimationsEnabled(enabled: boolean) {
    this.animationsEnabled = enabled;
    if (enabled) this.startCursorLoop();
  }

  public startCursorLoop() {
    if (!this.animationsEnabled || globalThis.matchMedia('(pointer: coarse)').matches) return;
    this._cursorAnimationLoop();
  }

  private _cursorAnimationLoop() {
    if (!this.animationsEnabled) return;
    this._current.x += (this._mouse.x - this._current.x) * OdysseyConfig.physics.cursorInertia;
    this._current.y += (this._mouse.y - this._current.y) * OdysseyConfig.physics.cursorInertia;
    document.documentElement.style.setProperty('--ion-x', String(this._current.x));
    document.documentElement.style.setProperty('--ion-y', String(this._current.y));
    EventBus.emit(EVENT_KEYS.AUDIO_UPDATE_SPATIAL_POSITION, { x: this._current.x, y: this._current.y });
    requestAnimationFrame(() => this._cursorAnimationLoop());
  }

  public setupMouseListeners() {
    this._boundPointerMove = (e: PointerEvent) => this._onPointerMove(e);
    this._boundMouseOver = (e: MouseEvent) => this._onMouseOver(e);
    this._boundMouseOut = (e: MouseEvent) => this._onMouseOut(e);

    globalThis.addEventListener('pointermove', this._boundPointerMove, { passive: true });
    document.addEventListener('mouseover', this._boundMouseOver, { passive: true });
    document.addEventListener('mouseout', this._boundMouseOut, { passive: true });
  }

  public removeMouseListeners() {
    if (this._boundPointerMove) globalThis.removeEventListener('pointermove', this._boundPointerMove);
    if (this._boundMouseOver) document.removeEventListener('mouseover', this._boundMouseOver);
    if (this._boundMouseOut) document.removeEventListener('mouseout', this._boundMouseOut);
  }

  private _onPointerMove(e: PointerEvent) {
    this._mouse.x = e.clientX;
    this._mouse.y = e.clientY;
    const velocity = Math.hypot(e.clientX - this._lastMouse.x, e.clientY - this._lastMouse.y);
    if (velocity > OdysseyConfig.physics.exhaustThreshold) this._particles.spawn(e.clientX, e.clientY, true);
    EventBus.emit(EVENT_KEYS.AUDIO_INJECT_ENGINE_POWER, velocity);
    EventBus.emit(EVENT_KEYS.INPUT_POINTER_MOVE, { x: e.clientX, y: e.clientY, velocity });
    this._lastMouse = { x: e.clientX, y: e.clientY };
    EventBus.emit(EVENT_KEYS.AUDIO_RESET_IDLE_TIMER);
  }

  private _onMouseOver(e: MouseEvent) {
    const maybeCell = (e.target as Element).closest('.cell');
    if (!(maybeCell instanceof HTMLElement)) return;
    const isFiller = maybeCell.classList.contains('filler');
    this._ionDrive.classList.add('active');
    this.setIonGlow(isFiller ? '200px' : '900px');
    this.playAudio('hover', { volume: isFiller ? 0.04 : 0.25, playbackRate: isFiller ? 0.5 : 1 });
    EventBus.emit(EVENT_KEYS.INPUT_HOVER, { filler: isFiller });
  }

  private _onMouseOut(e: MouseEvent) {
    const maybe = (e.target as Element).closest('.cell');
    if (maybe instanceof HTMLElement) {
      this._ionDrive.classList.remove('active');
      this.setIonGlow('700px');
    }
  }

  public spawnClickParticles(x: number, y: number) {
    this._particles.spawn(x, y, false);
  }

  public playAudio(key: string, options?: Record<string, any>) {
    EventBus.emit(EVENT_KEYS.AUDIO_PLAY, { key, options });
  }

  public setIonGlow(value: string) {
    document.documentElement.style.setProperty('--ion-glow', value);
  }

  public setIonDriveActive(isActive: boolean) {
    this._ionDrive.classList.toggle('jumping', isActive);
  }

  public toggleTheme() {
    const veil = document.getElementById('theme-veil');
    if (!(veil instanceof HTMLElement)) return;
    veil.classList.add('active');
    setTimeout(() => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      this._applyTheme(next);
      localStorage.setItem(STORAGE_KEYS.THEME, next);
      EventBus.emit(EVENT_KEYS.UI_THEME_CHANGED, { theme: next });
      setTimeout(() => veil.classList.remove('active'), 200);
    }, 400);
  }

  private _applyTheme(theme: string) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    document.documentElement.dataset.theme = theme;
  }

  public resizeParticles() {
    this._particles.resize?.();
  }

  public destroy() {
    this.animationsEnabled = false;
    this.removeMouseListeners();
  }
}
