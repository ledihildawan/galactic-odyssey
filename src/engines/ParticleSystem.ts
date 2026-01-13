import EventBus from '../core';
import { EVENT_KEYS } from '../core/Keys';
import { fs, vs } from './shaders/particle';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: [number, number, number];
}

export default class ParticleEngine {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | null;
  particles: Particle[];
  maxParticles: number;
  animationsEnabled: boolean;
  buffers: { [k: string]: WebGLBuffer | null } | null = null;
  program: WebGLProgram | null = null;
  uniLocs: any = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: false,
    });
    this.particles = [];
    this.maxParticles = 1200;
    this.animationsEnabled = true;
    this.init();
    EventBus.on(EVENT_KEYS.ANIMATION_SET_ENABLED, (enabled) => {
      this.animationsEnabled = Boolean(enabled);
      if (!enabled) {
        this.particles = [];
        if (this.gl) {
          this.gl.clearColor(0, 0, 0, 0);
          this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        }
      } else {
        this.loop();
      }
    });
  }

  getCSSColor(varName: string): [number, number, number] {
    const color = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;
      return [r, g, b];
    }
    return [0.5, 0.5, 0.5];
  }

  init() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2',
      pointerEvents: 'none',
      mixBlendMode: isLight ? 'normal' : 'screen',
    } as any);
    document.body.appendChild(this.canvas);
    if (!this.gl) return;
    const gl = this.gl;
    this.buffers = {
      pos: gl.createBuffer(),
      vel: gl.createBuffer(),
      life: gl.createBuffer(),
      size: gl.createBuffer(),
      color: gl.createBuffer(),
    };

    this.program = this.createProgram(vs, fs);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  createProgram(vsSource: string, fsSource: string) {
    const gl = this.gl!;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(p);
    return p;
  }

  resize() {
    if (!this.animationsEnabled) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  spawn(x: number, y: number, isExhaust = false) {
    if (!this.animationsEnabled) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const count = isExhaust ? 2 : 12;
    let primary = this.getCSSColor('--ion-primary');
    let secondary = this.getCSSColor('--ion-secondary');
    if (document.documentElement.getAttribute('data-theme') === 'light') {
      const contrastScale = 0.75;
      primary = primary.map((v) => v * contrastScale) as [number, number, number];
      secondary = secondary.map((v) => v * contrastScale) as [number, number, number];
    }
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const force = isExhaust ? Math.random() * 2 : Math.random() * 5 + 1.5;
      this.particles.push({
        x: x * dpr,
        y: y * dpr,
        vx: Math.cos(angle) * force * dpr,
        vy: Math.sin(angle) * force * dpr,
        life: 1.0,
        decay: isExhaust ? 0.04 : 0.015,
        size: (isExhaust ? 8 : 22) * dpr,
        color: (isExhaust ? primary : secondary) as [number, number, number],
      });
    }
  }

  loop() {
    if (!this.animationsEnabled) return;
    const gl = this.gl;
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.particles.length === 0) {
      requestAnimationFrame(() => this.loop());
      return;
    }
    gl.enable(gl.BLEND);
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    this.canvas.style.mixBlendMode = isLight ? 'normal' : 'screen';
    if (isLight) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }
    if (!this.uniLocs) {
      this.uniLocs = {
        isLight: gl.getUniformLocation(this.program!, 'u_isLight'),
        res: gl.getUniformLocation(this.program!, 'u_res'),
      };
    }
    const posArr: number[] = [],
      velArr: number[] = [],
      lifeArr: number[] = [],
      sizeArr: number[] = [],
      colorArr: number[] = [];
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      posArr.push(p.x, p.y);
      velArr.push(p.vx, p.vy);
      lifeArr.push(p.life);
      sizeArr.push(p.size);
      colorArr.push(...p.color);
    }
    if (posArr.length > 0) {
      gl.useProgram(this.program);
      this.updateBuffer(new Float32Array(posArr), this.buffers!.pos!, 'a_pos', 2);
      this.updateBuffer(new Float32Array(velArr), this.buffers!.vel!, 'a_vel', 2);
      this.updateBuffer(new Float32Array(lifeArr), this.buffers!.life!, 'a_life', 1);
      this.updateBuffer(new Float32Array(sizeArr), this.buffers!.size!, 'a_size', 1);
      this.updateBuffer(new Float32Array(colorArr), this.buffers!.color!, 'a_color', 3);
      gl.uniform1f(this.uniLocs.isLight, isLight ? 1.0 : 0.0);
      gl.uniform2f(this.uniLocs.res, this.canvas.width, this.canvas.height);
      gl.drawArrays(gl.POINTS, 0, posArr.length / 2);
    }
    requestAnimationFrame(() => this.loop());
  }

  updateBuffer(data: Float32Array, buffer: WebGLBuffer | null, attrName: string, size: number) {
    const gl = this.gl!;
    const loc = gl.getAttribLocation(this.program!, attrName);
    if (loc === -1) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
}
