class TagOverlayAnimator {
  constructor({
    label = "clues",
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
  } = {}) {
    this.label = label;
    this.baseX = baseX;
    this.y = y;
    this.w = w;
    this.h = h;
    this.font = font;

    this.bgImg = bgImg;

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
      image(this.bgImg, xNow, baseY, this.w, this.h);
    } else {
      // Fallback: white rectangle style
      fill(0, 0, 0, 120);
      rect(xNow + 3, baseY + 3, this.w, this.h);
      fill(255);
      rect(xNow, baseY, this.w, this.h);
    }

    if (this.font) textFont(this.font);
    textSize(30);
    noStroke();
    fill(0);
    textAlign(CENTER, CENTER);
    text(this.label, xNow + this.w / 2, baseY + this.h / 2 - 2);
    pop();
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
      image(this.bgImg, xNow, baseY, this.w, this.h);
    } else {
      // Fallback: white rectangle style
      fill(0, 0, 0, 120);
      rect(xNow + 3, baseY + 3, this.w, this.h);
      fill(255);
      rect(xNow, baseY, this.w, this.h);
    }

    if (this.font) textFont(this.font);
    textSize(30);
    noStroke();
    fill(0);
    textAlign(CENTER, CENTER);
    text(this.label, xNow + this.w / 2, baseY + this.h / 2 - 2);
    pop();
  }

  hit(mx, my) {
    const r = this.screenRect;
    return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  }
}
window.TagOverlayAnimator = TagOverlayAnimator;
