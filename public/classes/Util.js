class AssetCache {
  constructor(loadFn = loadImage) {
    this._cache = new Map(); // path -> asset
    this._loadFn = loadFn;
  }
  get(path) {
    return this._cache.get(path) || null;
  }
  has(path) {
    return this._cache.has(path);
  }
  load(path, cb) {
    if (!path) {
      cb?.(null);
      return;
    }
    if (this._cache.has(path)) {
      cb?.(this._cache.get(path));
      return;
    }
    this._loadFn(
      path,
      (asset) => {
        this._cache.set(path, asset);
        cb?.(asset);
      },
      (err) => {
        console.warn("Failed to load:", path, err);
        cb?.(null);
      }
    );
  }
}
window.AssetCache = AssetCache;

class CrossfadeLayer {
  /**
   * @param {Object} opts
   * @param {AssetCache} opts.cache
   * @param {number} opts.fadeMs
   * @param {(img)=>void} [opts.onChange]
   * @param {(p5.Image)=>void} [opts.drawFn]
   */
  constructor({ cache, fadeMs = 300, onChange = null, drawFn = null } = {}) {
    this.cache = cache;
    this.fadeMs = fadeMs;
    this.onChange = onChange;
    this.drawFn = drawFn || ((img) => image(img, 0, 0, width, height));

    this.prev = null;
    this.prevPath = null;
    this.cur = null;
    this.curPath = null;

    this.alpha = 255;
    this._fade = new Tween({ from: 255, to: 255, dur: fadeMs });
  }

  set(path) {
    const had = !!this.curPath;

    this.prev = this.cur;
    this.prevPath = this.curPath;

    if (!path) {
      this.cur = null;
      this.curPath = null;
      if (had) this._fade.start(0, 255, this.fadeMs);
      else this._fade.start(255, 255, 1);
      this.alpha = this._fade.value;
      return;
    }

    // same as current: no transition
    if (had && path === this.curPath) {
      this.prev = null;
      this.prevPath = null;
      this._fade.start(255, 255, 1);
      this.alpha = 255;
      return;
    }

    // load new, crossfade
    this.cache.load(path, (img) => {
      this.cur = img;
      this.curPath = path;
      this._fade.start(0, 255, this.fadeMs); // fade current in
      this.alpha = 0;
      if (typeof this.onChange === "function") this.onChange(img);
    });
  }

  /** Immediately clear current/prev (e.g., at Dialog end for CG) */
  clearInstant() {
    this.prev = null;
    this.prevPath = null;
    this.cur = null;
    this.curPath = null;
    this._fade.active = false;
    this.alpha = 255;
  }

  update() {
    this.alpha = this._fade.update();
  }

  /** Render crossfade; `layerA` lets parent decouple BG from UI alpha */
  render(layerA = 255) {
    if (this.prev && (this._fade.active || this.alpha < 255)) {
      push();
      tint(255, (255 - this.alpha) * (layerA / 255));
      this.drawFn(this.prev);
      pop();
    }
    if (this.cur) {
      push();
      tint(255, this.alpha * (layerA / 255));
      this.drawFn(this.cur);
      pop();
    }
  }
}
window.CrossfadeLayer = CrossfadeLayer;

class Typewriter {
  constructor({ charMs = 20, punctExtraMs = 80 } = {}) {
    this.charMs = charMs;
    this.punctExtraMs = punctExtraMs;
    this.full = "";
    this.visible = 0;
    this.typing = false;
    this._acc = 0;
    this._last = 0;
    this._nextDelay = charMs;
  }

  start(text) {
    this.full = String(text || "");
    this.visible = 0;
    this.typing = this.full.length > 0;
    this._acc = 0;
    this._last = millis();
    this._nextDelay = this.charMs;
  }

  revealAll() {
    this.visible = this.full.length;
    this.typing = false;
  }

  update() {
    if (!this.typing) return;
    const now = millis();
    let dt = now - this._last;
    this._last = now;

    this._acc += dt;
    while (this._acc >= this._nextDelay && this.visible < this.full.length) {
      this._acc -= this._nextDelay;
      this.visible++;
      const ch = this.full[this.visible - 1];
      this._nextDelay = /[\,\.\!\?\:\;]/.test(ch)
        ? this.charMs + this.punctExtraMs
        : this.charMs;
    }
    if (this.visible >= this.full.length) this.typing = false;
  }

  get visibleText() {
    return this.typing ? this.full.substring(0, this.visible) : this.full;
  }
}
window.Typewriter = Typewriter;

class Blinker {
  constructor({ periodMs = 900 } = {}) {
    this.periodMs = Math.max(1, periodMs);
    this.enabled = true;
    this.alpha = 0;
    this._t0 = millis();
  }
  setEnabled(on) {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) this.alpha = 0;
    else this._t0 = millis();
  }
  reset() {
    this._t0 = millis();
  }
  update() {
    if (!this.enabled) {
      this.alpha = 0;
      return;
    }
    const t = (millis() - this._t0) % this.periodMs;
    const phase = t / this.periodMs; // 0..1
    const v = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
    this.alpha = Math.floor(v * 255);
  }
}
window.Blinker = Blinker;
