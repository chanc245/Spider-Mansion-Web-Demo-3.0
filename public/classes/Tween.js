class Tween {
  constructor({
    from = 0,
    to = 1,
    dur = 300,
    ease = Tween.easeInOutCubic,
  } = {}) {
    this.from = from;
    this.to = to;
    this.dur = dur;
    this.ease = ease;
    this.t0 = 0;
    this.active = false;
    this.value = from;
  }
  start(from = this.from, to = this.to, dur = this.dur) {
    this.from = from;
    this.to = to;
    this.dur = dur;
    this.t0 = millis();
    this.active = true;
  }
  update() {
    if (!this.active) return this.value;
    const t = constrain((millis() - this.t0) / this.dur, 0, 1);
    this.value = lerp(this.from, this.to, this.ease(t));
    if (t >= 1) this.active = false;
    return this.value;
  }
  static easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}
window.Tween = Tween;
