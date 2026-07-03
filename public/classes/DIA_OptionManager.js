// DIA_OptionManager.js
// Extracted from StateManagers.js — a self-contained scene/activity manager.

// ── DIA_OPTION ───────────────────────────────────────────────────
// Spider-web hover option UI.
// Assets needed:
//   assets/ui/ui_optionTag_Left.png   (55x35)
//   assets/ui/ui_optionTag_Right.png  (55x35)
//   assets/fonts/Forum-Regular.ttf
//
// Config example:
//   dia_optionMgr.start({
//     choices: [
//       { label: "Wake Eva gently",   text: "You softly call her name." },
//       { label: "Open the curtains", text: "You quietly open the curtains." },
//     ],
//   });

class DIA_OptionManager {
  // ── constants ───────────────────────────────────────────────────
  static TAG_W = 55;
  static TAG_H = 35;
  static PAD = 20;
  static GAP = 10;
  static OVERFLOW = 12;
  static EXPAND = 30;

  constructor() {
    this.active = false;
    this.choices = []; // { label, text }

    this._result = null;
    this.onFinish = null;

    // Layout & web state (reset each start())
    this._layout = []; // { label, x, y, w }
    this._bounds = null; // cached layout bbox {minX,minY,maxX,maxY}, set in _computeLayout
    this._webBufs = []; // p5.Graphics per option
    this._webProg = []; // strand count drawn so far

    // Preloaded assets (set by preload())
    this._tagLeft = null;
    this._tagRight = null;
    this._font = null;

    // Optional full-screen background (used when no VN bg is behind us, e.g.
    // the dinner option loop runs after the VN has faded out).
    this._bgCache = {};
    this._bgImg = null;

    // Optional prompt/question drawn above the choices (e.g. music search).
    this._prompt = null;
  }

  // Call once after p5 preload — reuses dialog's font if available
  preload() {
    this._tagLeft = loadImage("assets/ui/ui_optionTag_Left.png");
    this._tagRight = loadImage("assets/ui/ui_optionTag_Right.png");
    // Same decorative frame the VN uses — drawn on top when this manager owns
    // the screen (its own bg, i.e. the VN has faded out, e.g. the dinner loop).
    // The option screen has no speaker, so use the nameless VN frame.
    this._frameImg = loadImage("assets/ui/ui_dia_decor_frame_noName.png");
    // Font is shared with Dialog; load independently here as fallback
    this._font = loadFont("assets/fonts/Forum-Regular.ttf");
  }

  // Preload any background images that start({ bg }) may reference.
  preloadBg(path) {
    if (path && !this._bgCache[path]) this._bgCache[path] = loadImage(path);
  }

  // ── start ────────────────────────────────────────────────────────
  // opts.bg — optional full-screen background path (cached via preloadBg)
  start(opts = {}) {
    this.choices = opts.choices ?? [];
    this._columns = Math.max(1, opts.columns ?? 1); // multi-column option grid
    this._prompt = opts.prompt ?? null;             // optional question header
    this._result = null;
    this._layout = [];
    this._webBufs = [];
    this._webProg = [];
    if (opts.bg) {
      if (!this._bgCache[opts.bg]) this._bgCache[opts.bg] = loadImage(opts.bg);
      this._bgImg = this._bgCache[opts.bg];
    } else {
      this._bgImg = null;
    }
    this.active = true;
    this._computeLayout();
    this._ensureBuffers();
  }

  // ── update ───────────────────────────────────────────────────────
  update() {
    if (!this.active) return;
    const { TAG_H, OVERFLOW } = DIA_OptionManager;

    for (let i = 0; i < this._layout.length; i++) {
      const { x, y, w } = this._layout[i];
      const hovered =
        mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + TAG_H;
      if (hovered) {
        if (this._webProg[i] < 800) {
          const burst = this._webProg[i] < 20 ? 12 : 24;
          this._addWebStrands(
            this._webBufs[i],
            burst,
            i * 77.3 + this._webProg[i] * 0.5,
          );
          this._webProg[i] += burst;
        }
      } else {
        if (this._webProg[i] > 0) {
          this._webBufs[i].clear();
          this._webProg[i] = 0;
        }
      }
    }
  }

  // ── render ───────────────────────────────────────────────────────
  render() {
    if (!this.active) return;

    // Only one phase now — "choose". Result goes straight to Dialog.
    this._drawBg();
    if (this._prompt) this._drawPrompt();
    for (let i = 0; i < this._layout.length; i++) {
      this._drawOptionRow(i);
    }

    // Decorative frame on top — only when WE painted the bg (the VN has faded
    // out, so it isn't drawing its own frame behind us, e.g. the dinner loop).
    if (this._bgImg && this._frameImg) {
      push();
      image(this._frameImg, 0, 0, width, height);
      pop();
    }
  }

  // ── input ────────────────────────────────────────────────────────
  mousePressed() {
    if (!this.active) return;

    const { TAG_H } = DIA_OptionManager;
    for (let i = 0; i < this._layout.length; i++) {
      const { x, y, w } = this._layout[i];
      if (
        mouseX >= x &&
        mouseX <= x + w &&
        mouseY >= y &&
        mouseY <= y + TAG_H
      ) {
        this._result = this.choices[i].text;
        this.active = false;
        this._cleanupBuffers();
        // onFinish receives (chosenText, choiceIndex) — index lets sketch.js branch
        this.onFinish?.(this._result, i);
        return;
      }
    }
  }

  // ── layout ───────────────────────────────────────────────────────
  _computeLayout() {
    const { TAG_W, TAG_H, PAD, GAP } = DIA_OptionManager;

    // Temporarily apply font for textWidth measurements
    if (this._font) {
      push();
      textFont(this._font);
      textSize(20);
    }

    const widths = this.choices.map((ch) => {
      const tw = textWidth(ch.label);
      return TAG_W + PAD + tw + PAD + TAG_W;
    });

    if (this._font) pop();

    // Grid layout: fill each column top-to-bottom (column-major). With cols=1
    // this is identical to the old single centered column.
    const cols = this._columns ?? 1;
    const n = this.choices.length;
    const rows = Math.ceil(n / cols);

    const COL_GAP = 50;
    const maxW = Math.max(...widths);
    const colSpacing = maxW + COL_GAP; // distance between column centers
    const firstColCenter = width / 2 - (colSpacing * (cols - 1)) / 2;

    const totalH = rows * TAG_H + (rows - 1) * GAP;
    const startY = (height - totalH) / 2;

    this._layout = this.choices.map((ch, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const cx = firstColCenter + col * colSpacing;
      return {
        label: ch.label,
        x: cx - widths[i] / 2,
        y: startY + row * (TAG_H + GAP),
        w: widths[i],
      };
    });

    // Cache the layout bounding box — the layout is fixed while the screen is
    // shown, so _drawBg/_drawPrompt read these instead of recomputing min/max
    // (with throwaway map() arrays) every frame.
    this._bounds = null;
    if (this._layout.length) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const o of this._layout) {
        if (o.x < minX) minX = o.x;
        if (o.y < minY) minY = o.y;
        if (o.x + o.w > maxX) maxX = o.x + o.w;
        if (o.y + TAG_H > maxY) maxY = o.y + TAG_H;
      }
      this._bounds = { minX, minY, maxX, maxY };
    }
  }

  _ensureBuffers() {
    const { TAG_H, OVERFLOW } = DIA_OptionManager;
    this._webBufs = this._layout.map((l) =>
      createGraphics(l.w + OVERFLOW * 2, TAG_H + OVERFLOW * 2),
    );
    this._webProg = new Array(this._layout.length).fill(0);
  }

  _cleanupBuffers() {
    for (const buf of this._webBufs) buf.remove();
    this._webBufs = [];
    this._webProg = [];
  }

  // ── draw helpers ─────────────────────────────────────────────────
  // Question/header centered above the option tags (e.g. music search).
  _drawPrompt() {
    if (!this._bounds) return;
    const minY = this._bounds.minY;
    push();
    if (this._font) textFont(this._font);
    textAlign(CENTER, BOTTOM);
    textSize(28);
    noStroke();
    fill(0, 0, 0, 180);            // soft shadow for readability
    text(this._prompt, width / 2 + 2, minY - 32);
    fill(240);
    text(this._prompt, width / 2, minY - 34);
    pop();
  }

  _drawBg() {
    if (!this._layout.length) return;
    const { EXPAND } = DIA_OptionManager;

    // Full-screen bg image first (only when one was provided), then the
    // radial vignette darkens around the option tags.
    if (this._bgImg) image(this._bgImg, 0, 0, width, height);

    const { minX, minY, maxX, maxY } = this._bounds;

    const rx = minX - EXPAND,
      ry = minY - EXPAND;
    const rw = maxX - minX + EXPAND * 2;
    const rh = maxY - minY + EXPAND * 2;
    const cx = rx + rw / 2,
      cy = ry + rh / 2;

    const ctx = drawingContext;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rw / 2, rh / 2);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, "rgba(0,0,0,0.85)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.70)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  _drawOptionRow(i) {
    const { TAG_W, TAG_H, PAD, OVERFLOW } = DIA_OptionManager;
    const { label, x, y, w } = this._layout[i];
    const tw = w - TAG_W * 2 - PAD * 2;

    // Spiderweb overlay
    if (this._webProg[i] > 0 && this._webBufs[i]) {
      image(this._webBufs[i], x - OVERFLOW, y - OVERFLOW);
    }

    // Tag images
    if (this._tagLeft) image(this._tagLeft, x, y, TAG_W, TAG_H);
    if (this._tagRight)
      image(this._tagRight, x + TAG_W + PAD + tw + PAD, y, TAG_W, TAG_H);

    // Label text
    push();
    if (this._font) textFont(this._font);
    fill(255);
    noStroke();
    textSize(20);
    textAlign(LEFT, CENTER);
    text(label, x + TAG_W + PAD, y + TAG_H / 2);
    pop();
  }

  // ── web strand generation ────────────────────────────────────────
  _addWebStrands(buf, count, seed) {
    const { OVERFLOW } = DIA_OptionManager;
    const w = buf.width,
      h = buf.height;
    buf.noFill();

    // Radial spokes
    for (let i = 0; i < count; i++) {
      const ax = OVERFLOW + random(w - OVERFLOW * 2);
      const ay = OVERFLOW + random(h - OVERFLOW * 2);
      const spokes = floor(random(2, 5));
      for (let s = 0; s < spokes; s++) {
        const angle = (TWO_PI / spokes) * s + noise(seed + i + s) * 1.0;
        const len = random(4, 18);
        const ex = ax + cos(angle) * len;
        const ey = ay + sin(angle) * len;
        buf.stroke(0, 0, 0, random(140, 230));
        buf.strokeWeight(random(0.3, 0.9));
        buf.beginShape();
        for (let t = 0; t <= 8; t++) {
          const tt = t / 8;
          const px = lerp(ax, ex, tt);
          const py = lerp(ay, ey, tt);
          const warp = noise(px * 0.1 + seed + i, py * 0.1) * 3 - 1.5;
          buf.vertex(px + warp, py + warp);
        }
        buf.endShape();
      }
    }

    // Concentric rings
    for (let i = 0; i < floor(count * 0.4); i++) {
      const ax = OVERFLOW + random(w - OVERFLOW * 2);
      const ay = OVERFLOW + random(h - OVERFLOW * 2);
      for (let r = 1; r <= floor(random(1, 3)); r++) {
        const radius = r * random(2, 6);
        buf.stroke(0, 0, 0, random(80, 160));
        buf.strokeWeight(0.4);
        buf.beginShape();
        for (let p = 0; p <= 16; p++) {
          const angle = (TWO_PI / 16) * p;
          const px = ax + cos(angle) * radius * random(0.8, 1.1);
          const py = ay + sin(angle) * radius * random(0.8, 1.1);
          const warp = noise(px * 0.08 + seed + r, py * 0.08) * 2 - 1;
          buf.vertex(px + warp, py + warp);
        }
        buf.endShape(CLOSE);
      }
    }

    // Short crossing threads
    for (let i = 0; i < floor(count * 1.2); i++) {
      const sx = OVERFLOW + random(w - OVERFLOW * 2);
      const sy = OVERFLOW + random(h - OVERFLOW * 2);
      const angle = random(TWO_PI);
      const len = random(5, 20);
      buf.stroke(0, 0, 0, random(60, 150));
      buf.strokeWeight(random(0.2, 0.5));
      buf.beginShape();
      for (let t = 0; t <= 8; t++) {
        const tt = t / 8;
        const px = lerp(sx, sx + cos(angle) * len, tt);
        const py = lerp(sy, sy + sin(angle) * len, tt);
        const warp = noise(px * 0.09 + seed + i * 0.1, py * 0.09) * 4 - 2;
        buf.vertex(px + warp, py + warp);
      }
      buf.endShape();
    }
  }
}

// ── expose global ─────────────────────────────────────────────────
window.DIA_OptionManager = DIA_OptionManager;
