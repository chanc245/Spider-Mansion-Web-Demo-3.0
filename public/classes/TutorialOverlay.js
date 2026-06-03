class TutorialOverlay {
  constructor({
    imagePaths = [],
    fadeOutMs = 400,
    fillScreen = true, // scale to 1024x576
  } = {}) {
    this.imagePaths = imagePaths;
    this.fadeOutMs = fadeOutMs;
    this.fillScreen = fillScreen;

    this.images = [];
    this.index = 0;
    this.active = false;
    this.done = false;

    this.alpha = 255;
    this._fade = new Tween({ from: 255, to: 0, dur: fadeOutMs });
    this._fadingOut = false;
  }

  preload() {
    this.images = this.imagePaths.map((p) => loadImage(p));
  }

  start() {
    if (!this.images.length) return;
    this.index = 0;
    this.alpha = 255;
    this._fadingOut = false;
    this.active = true;
    this.done = false;
  }

  update() {
    if (!this.active) return;
    if (this._fadingOut) {
      this.alpha = this._fade.update();
      if (!this._fade.active && this.alpha <= 1) {
        this.active = false;
        this.done = true;
      }
    }
  }

  render() {
    if (!this.active) return;

    const img = this.images[this.index];
    if (img) {
      push();
      tint(255, this.alpha);
      if (this.fillScreen) {
        image(img, 0, 0, 1024, 576);
      } else {
        // center at natural size
        const x = (width - img.width) / 2;
        const y = (height - img.height) / 2;
        image(img, x, y);
      }
      pop();
    }
  }

  mousePressed() {
    if (!this.active || this._fadingOut) return;

    // advance or fade out
    if (this.index + 1 < this.images.length) {
      this.index++;
    } else {
      this._fadingOut = true;
      this._fade.start(255, 0, this.fadeOutMs);
    }
  }
}
