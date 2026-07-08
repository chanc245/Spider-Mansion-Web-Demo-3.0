// PA_DinnerManager.js (dev overlay)
// Image-based dinner picker — replaces the old text-list version.
//
// Seven standing portraits (assets/dinner_char/ui_dinner_*.png, drawn 115x380)
// over the dining-room bg. Hovering one portrait keeps it lit and swaps every
// OTHER portrait to its *_dim.png variant. Clicking a portrait fires
// onPick(char); the "return to position" row at the bottom fires onFinish.
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

  constructor() {
    this.active = false;
    this.characters = []; // { ref, img, imgDim, x, y }
    this.onPick = null;   // (characterRef) => {} — portrait clicked
    this.onFinish = null; // () => {} — "return to position" clicked
    this._hover = -1;     // hovered portrait index, -1 = none
    this._hoverReturn = false;
    this._returnRow = null; // { x, y, w, h, tw } computed in start()
    this._imgCache = {};
    this._bgImg = null;
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
    const { CHAR_W, CHAR_H, CHAR_GAP, CHAR_Y, TAG_W, TAG_H, PAD, ROW_Y } =
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
  }

  render() {
    if (!this.active) return;
    const { CHAR_W, CHAR_H, TAG_W, TAG_H, PAD } = PA_DinnerManager;

    if (this._bgImg) image(this._bgImg, 0, 0, width, height);

    // Portraits — while one is hovered, all the OTHERS fade to their dim art.
    // True crossfade: normal fades OUT as dim fades in. The two exports are
    // different drawings, so at rest exactly one of them may be visible —
    // layering dim over an always-opaque normal would show both ghosted.
    for (const ch of this.characters) {
      if (ch.img && ch.dimA < 255) {
        push();
        tint(255, 255 - ch.dimA);
        image(ch.img, ch.x, ch.y, CHAR_W, CHAR_H);
        pop();
      }
      if (ch.imgDim && ch.dimA > 0) {
        push();
        tint(255, ch.dimA);
        image(ch.imgDim, ch.x, ch.y, CHAR_W, CHAR_H);
        pop();
      }
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
