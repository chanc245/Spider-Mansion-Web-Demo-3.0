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
    tuckSliver = 0, // px left poking out past the notebook edge when tucked in
    // Which animation hides the tab: page tags tuck in on "entrance" (end at
    // overlayEndX); the log tab tucks away on "reverse" (rests at overlayStartX).
    hideVia = "entrance",
  } = {}) {
    this.label = label;
    // Pre-split the (possibly multi-line) label once. _drawLabel runs several
    // times per frame during the quiz, so re-splitting every draw is wasteful.
    this._labelLines = String(label ?? "").split("\n");
    this.labelSize = labelSize;
    this.baseX = baseX;
    this.y = y;
    this.w = w;
    this.h = h;
    this.font = font;

    this.bgImg = bgImg;
    this.flipX = flipX; // mirror the bookmark art (e.g. left art reused on the right)

    this.aniDirection = aniDirection;
    // Stop the tuck a few px short (tuckSliver) so a little of the tab still
    // pokes out past the notebook edge instead of hiding completely. The sliver
    // is applied to whichever end is the tucked/hidden one for this direction:
    // LTR tabs tuck toward overlayEndX (right); RTL tabs toward overlayStartX (left).
    const autoStart = this.aniDirection === "RTL" ? baseX - w + tuckSliver : baseX;
    const autoEnd = this.aniDirection === "RTL" ? baseX : baseX + w - tuckSliver;

    this.overlayStartX = overlayStartX ?? autoStart;
    this.overlayEndX = overlayEndX ?? autoEnd;

    // Resting position while hidden — used to keep a sliver visible behind the
    // notebook once the tab is fully tucked.
    this.hideVia = hideVia;
    this.tuckedX =
      this.hideVia === "reverse" ? this.overlayStartX : this.overlayEndX;

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
    const lines = this._labelLines;
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

  // Draw the tag frozen at its tucked-in position (overlayEndX). Used to keep a
  // sliver poking out behind the notebook once the tag's page is open. Drawn
  // before the notebook image so only the sliver past the edge stays visible.
  drawTucked() {
    const xNow = this.tuckedX;
    const baseY = this.y - height;

    push();
    noStroke();
    if (this.bgImg) {
      this._blitBg(xNow, baseY);
    } else {
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
