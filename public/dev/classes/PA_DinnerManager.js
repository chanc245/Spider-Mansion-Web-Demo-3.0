// PA_DinnerManager.js (dev overlay)
// Image-based dinner picker — replaces the old text-list version.
//
// Seven standing portraits (assets/dinner_char/ui_dinner_*.png, drawn 115x380)
// over the dining-room bg. Hovering one portrait triggers "web vision":
// the whole screen dims, a full-screen spider web (ported from
// PA_WebInvestigateManager) animates out from the hovered character, and every
// OTHER portrait crossfades to its *_dim.png variant. The hovered portrait is
// drawn on top of the dim + web layers, so the web never overlaps it.
// Clicking a portrait fires onPick(char); the "return to position" row at the
// bottom fires onFinish.
//
// Config example (characters come from d1_dinner_characters):
//   pa_dinnerMgr.start({
//     characters: [
//       { id: "eva", label: "Eva", img: "...", imgDim: "...", script: [...] },
//     ],
//     bg: "assets/bg/bg_pa_1f_Dining.png",
//   });

class PA_DinnerManager {
  // Portrait size fixed by the art (source PNGs are 230x760, drawn at half).
  static CHAR_W = 115;
  static CHAR_H = 380;
  static CHAR_GAP = 0;
  static CHAR_Y = 75;

  // "return to position" row — same tag chrome as the DIA_OPTION rows.
  static TAG_W = 55;
  static TAG_H = 35;
  static PAD = 20;
  static ROW_Y = 480;

  // Hover dim swap crossfades (fast) instead of hard-switching.
  static DIM_FADE_MS = 120;

  // Web vision on hover — full-screen dim + animated radial web
  // (constants mirror PA_WebInvestigateManager).
  static WEB_DIM_ALPHA = 140; // full-screen dim strength at full hover
  static WEB_ANIM_SPEED = 0.05; // web draw-on progress per frame
  static WEB_FADE_MS = 160; // dim+web fade in/out

  constructor() {
    this.active = false;
    this.characters = []; // { ref, img, imgDim, x, y, dimA }
    this.onPick = null;   // (characterRef) => {} — portrait clicked
    this.onFinish = null; // () => {} — "return to position" clicked
    this._hover = -1;     // hovered portrait index, -1 = none
    this._hoverReturn = false;
    this._returnRow = null; // { x, y, w, h, tw } computed in start()
    this._imgCache = {};
    this._bgImg = null;

    // Web-vision state
    this._webA = 0;        // dim+web master alpha 0..255
    this._webHover = -1;   // portrait the current web belongs to
    this._webProgress = 0; // 0..1 draw-on animation
    this._webPoints = [];
    this._segStyles = [];
    this._rings = 0;
    this._spokes = 0;
    this._noiseOff = 0;

    // Once the draw-on animation completes, the web is baked into this
    // full-screen buffer and blitted per frame (~600 stroked segments → one
    // image call). Allocated lazily, reused across webs/starts.
    this._webBuf = null;
    this._webBufValid = false;
  }

  // Call during p5 preload. `charList` lets us preload every portrait
  // (normal + dim) so hover swaps never flash while lazy-loading.
  preload(charList = []) {
    this._frameImg = loadImage("assets/ui/ui_dia_decor_frame_noName.png");
    this._tagLeft = loadImage("assets/ui/ui_optionTag_Left.png");
    this._tagRight = loadImage("assets/ui/ui_optionTag_Right.png");
    this._font = loadFont("assets/fonts/Forum-Regular.ttf");
    this._img("assets/bg/bg_pa_1f_Dining.png");
    for (const c of charList) {
      this._img(c.img);
      this._img(c.imgDim);
    }
  }

  _img(path) {
    if (!path) return null;
    if (!this._imgCache[path]) this._imgCache[path] = loadImage(path);
    return this._imgCache[path];
  }

  start(opts = {}) {
    const { CHAR_W, CHAR_GAP, CHAR_Y, TAG_W, TAG_H, PAD, ROW_Y } =
      PA_DinnerManager;

    this._bgImg = this._img(opts.bg ?? "assets/bg/bg_pa_1f_Dining.png");

    const chars = opts.characters ?? [];
    const totalW = chars.length * CHAR_W + (chars.length - 1) * CHAR_GAP;
    const startX = (width - totalW) / 2;
    this.characters = chars.map((c, i) => ({
      ref: c,
      img: this._img(c.img),
      imgDim: this._img(c.imgDim),
      x: startX + i * (CHAR_W + CHAR_GAP),
      y: CHAR_Y,
      dimA: 0, // dim-art alpha 0..255, tweened toward hover state
    }));

    // "return to position" row, centered like a DIA_OPTION row.
    push();
    if (this._font) textFont(this._font);
    textSize(20);
    const tw = textWidth(PA_DinnerManager.RETURN_LABEL);
    pop();
    const rowW = TAG_W + PAD + tw + PAD + TAG_W;
    this._returnRow = { x: (width - rowW) / 2, y: ROW_Y, w: rowW, h: TAG_H, tw };

    this._hover = -1;
    this._hoverReturn = false;
    this._webA = 0;
    this._webHover = -1;
    this.active = true;
  }

  // Hit tests read mouseX/mouseY directly so update() (hover art) and
  // mousePressed() (clicks) can never disagree within a frame.
  _charAtMouse() {
    const { CHAR_W, CHAR_H } = PA_DinnerManager;
    for (let i = 0; i < this.characters.length; i++) {
      const ch = this.characters[i];
      if (
        mouseX >= ch.x &&
        mouseX <= ch.x + CHAR_W &&
        mouseY >= ch.y &&
        mouseY <= ch.y + CHAR_H
      )
        return i;
    }
    return -1;
  }

  _returnAtMouse() {
    const r = this._returnRow;
    return (
      !!r &&
      mouseX >= r.x &&
      mouseX <= r.x + r.w &&
      mouseY >= r.y &&
      mouseY <= r.y + r.h
    );
  }

  update() {
    if (!this.active) return;
    this._hover = this._charAtMouse();
    this._hoverReturn = this._returnAtMouse();

    // Crossfade each portrait's dim art toward its hover state.
    const step = (deltaTime / PA_DinnerManager.DIM_FADE_MS) * 255;
    for (let i = 0; i < this.characters.length; i++) {
      const ch = this.characters[i];
      const dimmed = this._hover !== -1 && this._hover !== i;
      ch.dimA = constrain(ch.dimA + (dimmed ? step : -step), 0, 255);
    }

    // Web vision: fade the full-screen dim + web with hover, animate the web
    // drawing on. A new web is spun when hover lands on a (new) portrait.
    const webStep = (deltaTime / PA_DinnerManager.WEB_FADE_MS) * 255;
    if (this._hover !== -1) {
      if (this._webHover !== this._hover || this._webA <= 0) {
        this._webHover = this._hover;
        const ch = this.characters[this._hover];
        this._generateWeb(
          ch.x + PA_DinnerManager.CHAR_W * (2 / 3),
          ch.y + PA_DinnerManager.CHAR_H * 0.32,
        );
      }
      this._webA = constrain(this._webA + webStep, 0, 255);
      this._webProgress = min(1, this._webProgress + PA_DinnerManager.WEB_ANIM_SPEED);
    } else {
      this._webA = constrain(this._webA - webStep, 0, 255);
    }
  }

  render() {
    if (!this.active) return;
    const { TAG_W, TAG_H, PAD } = PA_DinnerManager;

    if (this._bgImg) image(this._bgImg, 0, 0, width, height);

    // Portraits under the web layer — the hovered one (web owner) is skipped
    // here and drawn after the dim + web so nothing overlaps it.
    // True crossfade: normal fades OUT as dim fades in. The two exports are
    // different drawings, so at rest exactly one of them may be visible —
    // layering dim over an always-opaque normal would show both ghosted.
    const top = this._webA > 0 ? this._webHover : -1;
    for (let i = 0; i < this.characters.length; i++) {
      if (i === top) continue;
      this._drawPortrait(this.characters[i]);
    }

    // Full-screen dim + spider web (web vision), fading with hover.
    if (this._webA > 0) {
      const af = this._webA / 255;
      noStroke();
      fill(0, 0, 0, PA_DinnerManager.WEB_DIM_ALPHA * af);
      rect(0, 0, width, height);
      if (this._webProgress >= 1) {
        // Fully spun: blit the baked web instead of re-stroking every segment.
        if (!this._webBufValid) this._bakeWeb();
        const ctx = drawingContext;
        const prevA = ctx.globalAlpha;
        ctx.globalAlpha = prevA * af;
        image(this._webBuf, 0, 0);
        ctx.globalAlpha = prevA;
      } else {
        this._drawWeb(af);
      }
      // Hovered portrait rides on top of the dim + web, fully lit.
      if (top !== -1) this._drawPortrait(this.characters[top]);
    }

    // Decorative web frame (includes the edge/bottom vignette) on top of the
    // portraits, matching the VN look; the return row stays above it.
    if (this._frameImg) image(this._frameImg, 0, 0, width, height);

    // "return to position" row
    const r = this._returnRow;
    if (r) {
      if (this._tagLeft) image(this._tagLeft, r.x, r.y, TAG_W, TAG_H);
      if (this._tagRight)
        image(this._tagRight, r.x + r.w - TAG_W, r.y, TAG_W, TAG_H);
      push();
      if (this._font) textFont(this._font);
      noStroke();
      fill(this._hoverReturn ? 255 : 215);
      textSize(20);
      textAlign(LEFT, CENTER);
      text(PA_DinnerManager.RETURN_LABEL, r.x + TAG_W + PAD, r.y + TAG_H / 2);
      pop();
    }
  }

  // Alpha fades go through canvas globalAlpha, NOT p5 tint(): with a tint set,
  // p5 pushes every image() through an offscreen tint-canvas (even at alpha
  // 255), which would tax all seven portraits every idle frame.
  _drawPortrait(ch) {
    const { CHAR_W, CHAR_H } = PA_DinnerManager;
    const ctx = drawingContext;
    const prevA = ctx.globalAlpha;
    if (ch.img && ch.dimA < 255) {
      ctx.globalAlpha = prevA * ((255 - ch.dimA) / 255);
      image(ch.img, ch.x, ch.y, CHAR_W, CHAR_H);
    }
    if (ch.imgDim && ch.dimA > 0) {
      ctx.globalAlpha = prevA * (ch.dimA / 255);
      image(ch.imgDim, ch.x, ch.y, CHAR_W, CHAR_H);
    }
    ctx.globalAlpha = prevA;
  }

  // ── web generation / drawing ─────────────────────────────────────
  // Ported from PA_WebInvestigateManager (_generateWeb/_drawWeb), minus the
  // object-rect deformation; `af` scales all strand alphas for fade in/out.
  _generateWeb(cx, cy) {
    this._webPoints = [];
    this._segStyles = [];
    // Denser and wider than the investigate web — more rings/spokes, and the
    // strands reach further out so the web covers the whole scene.
    this._rings = floor(random(14, 22));
    this._spokes = floor(random(18, 28));
    this._noiseOff = random(1000);
    this._webProgress = 0;
    this._webBufValid = false; // new geometry → previous bake is stale

    const maxR = max(width, height) * 1.05;

    let angles = [],
      running = 0;
    for (let s = 0; s < this._spokes; s++) {
      running += (TWO_PI / this._spokes) * random(0.55, 1.6);
      angles.push(running);
    }
    const norm = TWO_PI / running;
    angles = angles.map((a) => a * norm);

    for (let s = 0; s < this._spokes; s++) {
      const col = [],
        lenMult = random(0.7, 1.15);
      for (let r = 0; r <= this._rings; r++) {
        const t = r / this._rings;
        const radWobble = map(
          noise(this._noiseOff + s * 0.7, r * 0.5),
          0,
          1,
          0.75,
          1.28,
        );
        const rad = t * maxR * lenMult * radWobble;
        const latDrift =
          map(
            noise(this._noiseOff + s * 1.3, r * 0.9 + 99),
            0,
            1,
            -0.12,
            0.12,
          ) * t;
        col.push({
          x: cx + cos(angles[s] + latDrift) * rad,
          y: cy + sin(angles[s] + latDrift) * rad,
        });
      }
      this._webPoints.push(col);
    }

    for (let r = 1; r <= this._rings; r++) {
      const row = [];
      for (let s = 0; s < this._spokes; s++)
        row.push({
          alphaMult: random(0.75, 1.1),
          weightMult: random(0.6, 1.4),
          sag: random(0.04, 0.14),
        });
      this._segStyles.push(row);
    }
  }

  // Render the finished web once into the offscreen buffer; render() then
  // blits it with globalAlpha until the geometry changes.
  _bakeWeb() {
    if (!this._webBuf) this._webBuf = createGraphics(width, height);
    this._webBuf.clear();
    this._drawWeb(1, this._webBuf);
    this._webBufValid = true;
  }

  // Draw the web at its current progress. `R` is the render target — the
  // global canvas by default, or a p5.Graphics when baking (both expose the
  // same drawing API in global mode).
  _drawWeb(af, R = window) {
    R.noFill();
    const spokeT = min(1, this._webProgress / 0.35);
    const showSpokes = floor(spokeT * this._spokes);
    const spokeFrac = (spokeT * this._spokes) % 1;

    for (let s = 0; s < showSpokes + 1; s++) {
      if (s >= this._spokes) break;
      const frac = s < showSpokes ? 1 : spokeFrac;
      for (let r = 0; r < this._rings; r++) {
        const t = r / this._rings;
        R.stroke(200, 210, 255, lerp(210, 45, t) * af);
        R.strokeWeight(lerp(1.4, 0.35, t));
        const a = this._webPoints[s][r];
        const b = this._webPoints[s][r + 1];
        R.line(a.x, a.y, lerp(a.x, b.x, frac), lerp(a.y, b.y, frac));
        if (frac < 1) break;
      }
    }

    const ringT =
      this._webProgress > 0.35 ? min(1, (this._webProgress - 0.35) / 0.65) : 0;
    const showRings = floor(ringT * this._rings);
    const ringFrac = (ringT * this._rings) % 1;

    for (let r = 1; r <= showRings + 1; r++) {
      if (r > this._rings) break;
      const frac = r <= showRings ? 1 : ringFrac;
      const t = r / this._rings;
      const baseA = lerp(185, 35, t);
      const baseW = lerp(1.0, 0.3, t);
      const segsShow = floor(frac * this._spokes);
      const segFrac = (frac * this._spokes) % 1;

      for (let s = 0; s < segsShow + 1; s++) {
        if (s >= this._spokes) break;
        const sf = s < segsShow ? 1 : segFrac;
        const next = (s + 1) % this._spokes;
        const style = this._segStyles[r - 1][s];
        const a = this._webPoints[s][r];
        const nb = this._webPoints[next][r];
        const bx = lerp(a.x, nb.x, sf),
          by = lerp(a.y, nb.y, sf);

        R.stroke(200, 210, 255, baseA * style.alphaMult * af);
        R.strokeWeight(baseW * style.weightMult);

        const mx = (a.x + bx) / 2,
          my = (a.y + by) / 2;
        const dx = bx - a.x,
          dy = by - a.y;
        const len = sqrt(dx * dx + dy * dy) || 1;

        R.beginShape();
        R.vertex(a.x, a.y);
        R.quadraticVertex(
          mx + (-dy / len) * len * style.sag * sf,
          my + (dx / len) * len * style.sag * sf,
          bx,
          by,
        );
        R.endShape();
      }
    }

    // Center dot
    R.noStroke();
    R.fill(210, 215, 255, 200 * af);
    if (this._webPoints[0]?.[0]) {
      R.circle(this._webPoints[0][0].x, this._webPoints[0][0].y, 4);
    }
  }

  mousePressed() {
    if (!this.active) return;

    const hit = this._charAtMouse();
    if (hit !== -1) {
      const picked = this.characters[hit].ref;
      this.active = false;
      this.onPick?.(picked);
      return;
    }

    if (this._returnAtMouse()) {
      this.active = false;
      this.onFinish?.();
    }
  }
}

PA_DinnerManager.RETURN_LABEL = "return to position";

// ── expose global ─────────────────────────────────────────────────
window.PA_DinnerManager = PA_DinnerManager;
