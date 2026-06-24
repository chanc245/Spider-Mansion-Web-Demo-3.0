class TagOverlayAnimator {
  constructor({
    label = "clues",
    labelSize = 30,
    baseX = 5,
    y = 750,
    w = 100,
    h = 50,
    font = null,
    aniDirection = "LTR", // "LTR" or "RTL"
    overlayStartX = null,
    overlayEndX = null,
    slideDur = 300,
    bgImg = null,
    flipX = false,
  } = {}) {
    this.label = label;
    this.labelSize = labelSize;
    this.baseX = baseX;
    this.y = y;
    this.w = w;
    this.h = h;
    this.font = font;

    this.bgImg = bgImg;
    this.flipX = flipX; // mirror the bookmark art (e.g. left art reused on the right)

    this.aniDirection = aniDirection;
    const autoStart = this.aniDirection === "RTL" ? baseX - w : baseX;
    const autoEnd = this.aniDirection === "RTL" ? baseX : baseX + w;

    this.overlayStartX = overlayStartX ?? autoStart;
    this.overlayEndX = overlayEndX ?? autoEnd;

    this.slide = new Tween({ from: 0, to: 1, dur: slideDur });

    this.overlayActive = false;
    this.overlayDir = +1; // +1 forward, -1 reverse

    this.screenRect = { x: -9999, y: -9999, w: 0, h: 0 };
  }

  // Forward animation
  startEntrance() {
    this.overlayActive = true;
    this.overlayDir = +1;
    this.slide.start(0, 1);
  }

  // Reverse animation
  startReverse() {
    this.overlayActive = true;
    this.overlayDir = -1;
    this.slide.start(0, 1);
  }

  startReverseWithFade() {
    this.startReverse();
  }

  update() {
    const tSlide = this.slide.update();
    const done = !this.slide.active;
    return { tSlide, done };
  }

  // Draw stationary tag behind notebook
  drawClickable() {
    const xNow = this.baseX;
    const baseY = this.y - height;

    this.screenRect = { x: xNow, y: baseY, w: this.w, h: this.h };

    push();
    noStroke();

    if (this.bgImg) {
      this._blitBg(xNow, baseY);
    } else {
      // Fallback: white rectangle style
      fill(0, 0, 0, 120);
      rect(xNow + 3, baseY + 3, this.w, this.h);
      fill(255);
      rect(xNow, baseY, this.w, this.h);
    }

    this._drawLabel(xNow, baseY);
    pop();
  }

  // Draw the bookmark image, mirrored horizontally when flipX is set.
  _blitBg(xNow, baseY) {
    if (this.flipX) {
      push();
      translate(xNow + this.w, baseY);
      scale(-1, 1);
      image(this.bgImg, 0, 0, this.w, this.h);
      pop();
    } else {
      image(this.bgImg, xNow, baseY, this.w, this.h);
    }
  }

  // Draw the (possibly multi-line) label centered on the tag.
  _drawLabel(xNow, baseY) {
    if (!this.label) return;
    if (this.font) textFont(this.font);
    textSize(this.labelSize);
    noStroke();
    fill(0);
    textAlign(CENTER, CENTER);
    const lines = String(this.label).split("\n");
    const lh = this.labelSize;
    const cx = xNow + this.w / 2;
    const cy0 = baseY + this.h / 2 - 2 - ((lines.length - 1) * lh) / 2;
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], cx, cy0 + i * lh);
    }
  }

  // Draw animated overlay under notebook
  drawUnder() {
    const t = this.slide.value;
    const baseY = this.y - height;

    const x0 = this.overlayDir === -1 ? this.overlayEndX : this.overlayStartX;
    const x1 = this.overlayDir === -1 ? this.overlayStartX : this.overlayEndX;
    const xNow = lerp(x0, x1, t);

    push();
    noStroke();

    if (this.bgImg) {
      // Bookmark PNG underlay
      this._blitBg(xNow, baseY);
    } else {
      // Fallback: white rectangle style
      fill(0, 0, 0, 120);
      rect(xNow + 3, baseY + 3, this.w, this.h);
      fill(255);
      rect(xNow, baseY, this.w, this.h);
    }

    this._drawLabel(xNow, baseY);
    pop();
  }

  hit(mx, my) {
    const r = this.screenRect;
    return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  }
}
window.TagOverlayAnimator = TagOverlayAnimator;
