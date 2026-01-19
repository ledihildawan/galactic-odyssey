import EventBus from '../core';
import { EVENT_KEYS } from '../core/Keys';
import { fs, vs } from './shaders/particle';

interface Particle {
  color: [number, number, number];
  decay: number;
  life: number;
  size: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

export default class ParticleEngine {
  private _buffers: Record<string, WebGLBuffer | null> | null = null;
  private _canvas: HTMLCanvasElement = document.createElement('canvas');
  private _gl: WebGLRenderingContext | null = null;
  private _particles: Particle[] = [];
  private _program: WebGLProgram | null = null;
  private _uniLocs: { isLight: WebGLUniformLocation | null; res: WebGLUniformLocation | null } | null = null;

  animationsEnabled: boolean = true;
  readonly maxParticles: number = 1200;

  constructor() {
    this.init();

    EventBus.on(EVENT_KEYS.ANIMATION_SET_ENABLED, (enabled) => {
      this.animationsEnabled = Boolean(enabled);

      if (!enabled) {
        this._particles = [];

        if (this._gl) {
          this._gl.clear(this._gl.COLOR_BUFFER_BIT);
          this._gl.clearColor(0, 0, 0, 0);
        }
      }

      if (enabled) {
        this.loop();
      }
    });
  }

  init() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    Object.assign(this._canvas.style, {
      inset: '0',
      mixBlendMode: isLight ? 'normal' : 'screen',
      pointerEvents: 'none',
      position: 'fixed',
      zIndex: '2',
    });

    document.body.appendChild(this._canvas);

    // Ambil context WebGL dari this._canvas
    this._gl = this._canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: false,
    });
    if (!this._gl) return;
    const gl = this._gl;

    this._buffers = {
      color: gl.createBuffer(),
      life: gl.createBuffer(),
      pos: gl.createBuffer(),
      size: gl.createBuffer(),
      vel: gl.createBuffer(),
    };

    this._program = this.createProgram(vs, fs);

    this.resize();

    window.addEventListener('resize', () => this.resize());

    this.loop();
  }

  resize() {
    if (!this.animationsEnabled) return;

    const dpr = Math.min(window.devicePixelRatio, 2);

    this._canvas.width = Math.round(window.innerWidth * dpr);

    this._canvas.height = Math.round(window.innerHeight * dpr);

    this._canvas.style.width = `${window.innerWidth}px`;

    this._canvas.style.height = `${window.innerHeight}px`;

    if (this._gl) {
      this._gl.viewport(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  loop() {
    if (!this.animationsEnabled) return;

    if (!this._gl) return;

    this._gl.clearColor(0, 0, 0, 0);

    this._gl.clear(this._gl.COLOR_BUFFER_BIT);

    if (this._particles.length === 0) {
      requestAnimationFrame(() => this.loop());
      return;
    }

    this._gl.enable(this._gl.BLEND);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    this._canvas.style.mixBlendMode = isLight ? 'normal' : 'screen';

    if (isLight) {
      this._gl.blendFunc(this._gl.SRC_ALPHA, this._gl.ONE_MINUS_SRC_ALPHA);
    }

    if (!isLight) {
      this._gl.blendFunc(this._gl.SRC_ALPHA, this._gl.ONE);
    }

    if (!this._uniLocs) {
      this._uniLocs = {
        isLight: this._gl.getUniformLocation(this._program!, 'u_isLight'),
        res: this._gl.getUniformLocation(this._program!, 'u_res'),
      };
    }

    const colorArr: number[] = [];

    const lifeArr: number[] = [];

    const posArr: number[] = [];

    const sizeArr: number[] = [];

    const velArr: number[] = [];

    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];

      p.x += p.vx;

      p.y += p.vy;

      p.vx *= 0.98;

      p.vy *= 0.98;

      p.life -= p.decay;

      if (p.life <= 0) {
        this._particles[i] = this._particles[this._particles.length - 1];
        this._particles.pop();
        continue;
      }

      posArr.push(p.x, p.y);

      velArr.push(p.vx, p.vy);

      lifeArr.push(p.life);

      sizeArr.push(p.size);

      colorArr.push(...p.color);
    }

    if (posArr.length > 0) {
      this.updateBuffer(new Float32Array(posArr), this._buffers!.pos!, 'a_pos', 2);

      this.updateBuffer(new Float32Array(velArr), this._buffers!.vel!, 'a_vel', 2);

      this.updateBuffer(new Float32Array(lifeArr), this._buffers!.life!, 'a_life', 1);

      this.updateBuffer(new Float32Array(sizeArr), this._buffers!.size!, 'a_size', 1);

      this.updateBuffer(new Float32Array(colorArr), this._buffers!.color!, 'a_color', 3);

      this._gl.uniform1f(this._uniLocs.isLight, isLight ? 1.0 : 0.0);

      this._gl.uniform2f(this._uniLocs.res, this._canvas.width, this._canvas.height);

      this._gl.useProgram(this._program);

      this._gl.drawArrays(this._gl.POINTS, 0, posArr.length / 2);
    }

    requestAnimationFrame(() => this.loop());
  }

  spawn(x: number, y: number, exhaust = false) {
    if (!this.animationsEnabled) return;

    const dpr = Math.min(window.devicePixelRatio, 2);

    const count = exhaust ? 2 : 12;

    let primary = this.getCSSColor('--ion-primary');

    let secondary = this.getCSSColor('--ion-secondary');

    if (document.documentElement.getAttribute('data-theme') === 'light') {
      const scale = 0.75;

      primary = primary.map((v) => v * scale) as [number, number, number];

      secondary = secondary.map((v) => v * scale) as [number, number, number];
    }

    for (let i = 0; i < count; i++) {
      if (this._particles.length >= this.maxParticles) {
        this._particles.shift();
      }

      const angle = Math.random() * Math.PI * 2;

      const force = exhaust ? Math.random() * 2 : Math.random() * 5 + 1.5;

      this._particles.push({
        color: (exhaust ? primary : secondary) as [number, number, number],
        decay: exhaust ? 0.04 : 0.015,
        life: 1.0,
        size: (exhaust ? 8 : 22) * dpr,
        vx: Math.cos(angle) * force * dpr,
        vy: Math.sin(angle) * force * dpr,
        x: x * dpr,
        y: y * dpr,
      });
    }
  }

  createProgram(vsSource: string, fsSource: string) {
    const gl = this._gl!;

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;

      gl.shaderSource(shader, src);

      gl.compileShader(shader);

      return shader;
    };

    const program = gl.createProgram()!;

    gl.attachShader(program, compile(gl.VERTEX_SHADER, vsSource));

    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fsSource));

    gl.linkProgram(program);

    return program;
  }

  updateBuffer(data: Float32Array, buffer: WebGLBuffer | null, attr: string, size: number) {
    const gl = this._gl!;

    const loc = gl.getAttribLocation(this._program!, attr);

    if (loc === -1) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    gl.enableVertexAttribArray(loc);

    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  private getCSSColor(name: string): [number, number, number] {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    if (value.startsWith('#')) {
      const r = parseInt(value.slice(1, 3), 16) / 255;

      const g = parseInt(value.slice(3, 5), 16) / 255;

      const b = parseInt(value.slice(5, 7), 16) / 255;

      return [r, g, b];
    }

    return [0.5, 0.5, 0.5];
  }
}
