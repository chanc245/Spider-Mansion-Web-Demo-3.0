// PA_GameManager.js
// Extracted from StateManagers.js — a self-contained scene/activity manager.

// ── GAME (Day 1 kitchen mini-game) ───────────────────────────────
// Full-frame falling-food "catch" game (1024×576).
//
// A pot at the bottom follows the mouse. Good food (carrot / mushroom /
// potato) and bad food (banana peel / fish bone / half apple) fall from the
// top, one of each at a time. Catch good → progress bar +1; catch bad → −1
// (clamped at 0). Missing food costs nothing. When the green bar fills to
// TARGET the round ends. A 3-2-1-Go! countdown plays before food falls.
//
// Assets are loaded in preload() — call pa_gameMgr.preload() from main preload.
//
// Config example:
//   pa_gameMgr.start({ id: "ingredients", target: 10 });

class PA_GameManager {
  constructor() {
    this.active = false;
    this.gameId = null;
    this.onFinish = null;

    // assets (filled by preload)
    this._img = null;
    this._goodImgs = [];
    this._badImgs = [];
    this._font = null;

    // tunables
    this.TARGET = 10; // net good-catches needed to fill the bar
    this.FOOD_W = 120;
    this.FOOD_H = 120;
    this.POT_W = 150;
    this.POT_H = 150;

    // progress-bar geometry (top of frame, inside the border)
    this.BAR_X = 150;
    this.BAR_Y = 38;
    this.BAR_W = 724;
    this.BAR_H = 22;

    // audio paths (registered in preload, played via the shared global audioMgr)
    const sfxBase = "assets/mini_game/audio/";
    this.SFX = {
      countdown: sfxBase + "ui_countDown.mp3", // 3-2-1-Go! chime
      good: sfxBase + "food_normal.mp3", // caught good food
      bad: sfxBase + "food_bad.mp3", // caught bad food
      success: sfxBase + "ui_success.mp3", // "Success!" banner
    };
    this.BGM = sfxBase + "bg_music.mp3"; // looping mini-game background music
  }

  // Play a one-shot mini-game sfx through the shared global AudioManager.
  // Restarts from 0 so rapid catches always re-trigger the sound.
  _playSfx(path) {
    if (typeof audioMgr !== "undefined" && audioMgr) {
      audioMgr.play(path, { from: 0 });
    }
  }

  // Call once from the main preload().
  preload() {
    const base = "assets/mini_game/day1_kichen_soup/";
    this._font = loadFont("assets/fonts/PixelMillennium.ttf"); // pixel font (Maid-to-Work)
    this._img = {
      bg: loadImage(base + "bg_chore1_kitchen.png"),
      frame: loadImage(base + "bg_frame.png"),
      pot: loadImage(base + "item_pot.png"),
      tut: loadImage(base + "tut_chore1.png"),
    };
    this._goodImgs = [
      loadImage(base + "food_good_carrot.png"),
      loadImage(base + "food_good_mushroom.png"),
      loadImage(base + "food_good_potato.png"),
    ];
    this._badImgs = [
      loadImage(base + "food_bad_bananaPeel.png"),
      loadImage(base + "food_bad_fishBone.png"),
      loadImage(base + "food_bad_halfApple.png"),
    ];

    // Register mini-game audio with the shared AudioManager (lazy-loads if absent).
    if (typeof audioMgr !== "undefined" && audioMgr) {
      audioMgr.load(this.SFX.countdown, { volume: 0.5 });
      audioMgr.load(this.SFX.good, { volume: 0.5 });
      audioMgr.load(this.SFX.bad, { volume: 0.5 });
      audioMgr.load(this.SFX.success, { volume: 0.5 });
      // exclusive: starting it fades out any other BGM (e.g. bg_ara) for the round
      audioMgr.load(this.BGM, { loop: true, volume: 0.3, exclusive: true });
    }
  }

  start(opts = {}) {
    this.gameId = opts.id ?? "unknown";
    this.TARGET = opts.target ?? this.TARGET;
    this.active = true;
    this._finished = false;
    this._progress = 0;

    // speed ramp (px per 1/60s, multiplied gradually over time)
    this._fallSpeed = opts.startSpeed ?? 3.2;
    this._speedRate = opts.speedRate ?? 1.2; // multiplier accrued per 10s — slight, steady ramp
    this._speedMult = 1.0;

    // pot — sits 9px up from the frame's bottom border
    this._pot = {
      w: this.POT_W,
      h: this.POT_H,
      x: (width - this.POT_W) / 2,
      y: height - this.POT_H - 9,
    };

    // falling items (one good, one bad at a time)
    this._good = this._makeItem(this._goodImgs);
    this._bad = this._makeItem(this._badImgs);
    this._respawn(this._good, this._bad);
    this._respawn(this._bad, this._good);

    // crisp pixel art: switch the canvas to nearest-neighbour upscaling while
    // the mini-game runs (restored in the ended hand-off so the VN art stays smooth)
    this._canvasEl =
      typeof drawingContext !== "undefined" && drawingContext.canvas
        ? drawingContext.canvas
        : null;
    if (this._canvasEl) this._canvasEl.style.imageRendering = "pixelated";

    // phase: countdown → playing → ended
    this._phase = "countdown";
    this._phaseStartMs = millis();

    // countdown chime fires once per beat (3 · 2 · 1 · Go!) — see update()
    this._cdBeatsPlayed = 0;

    // background music loops for the whole round (stopped in the ended hand-off)
    if (typeof audioMgr !== "undefined" && audioMgr) {
      audioMgr.play(this.BGM, { loop: true, volume: 0.3, from: 0, exclusive: true });
    }
  }

  _makeItem(pool) {
    return {
      x: 0,
      y: -this.FOOD_H,
      w: this.FOOD_W,
      h: this.FOOD_H,
      vy: 0,
      img: null,
      _pool: pool,
    };
  }

  // Respawn at top with a random x that doesn't horizontally overlap `other`.
  _respawn(item, other) {
    let x,
      tries = 0;
    do {
      x = floor(random(0, width - item.w));
      tries++;
    } while (other && abs(x - other.x) < item.w && tries < 50);
    item.x = x;
    item.y = -item.h - floor(random(0, 140)); // slight vertical stagger
    item.img = random(item._pool);
    item.vy = this._fallSpeed * this._speedMult;
  }

  update() {
    if (!this.active) return;
    const now = millis();
    const dt = deltaTime / 16.667; // frame-rate-independent step

    if (this._phase === "countdown") {
      // chime on each beat, matching the on-screen labels:
      // 3 (0ms) · 2 (700) · 1 (1400) · Go! (2100)
      const elapsed = now - this._phaseStartMs;
      const beat = elapsed < 700 ? 1 : elapsed < 1400 ? 2 : elapsed < 2100 ? 3 : 4;
      if (beat > this._cdBeatsPlayed) {
        this._cdBeatsPlayed = beat;
        this._playSfx(this.SFX.countdown);
      }
      // 3 → 2 → 1 → Go! (700ms each), then start falling
      if (now - this._phaseStartMs >= 2700) {
        this._phase = "playing";
        this._phaseStartMs = now;
        this._lastSpeedMs = now;
      }
      return;
    }

    if (this._phase === "playing") {
      // pot follows the mouse
      this._pot.x = constrain(mouseX - this._pot.w / 2, 0, width - this._pot.w);

      // gradual speed ramp
      const dtMs = now - this._lastSpeedMs;
      this._lastSpeedMs = now;
      this._speedMult *= Math.pow(this._speedRate, dtMs / 10000);

      this._stepItem(this._good, this._bad, dt, true);
      this._stepItem(this._bad, this._good, dt, false);

      if (this._progress >= this.TARGET) {
        this._progress = this.TARGET;
        this._phase = "ended";
        this._phaseStartMs = now;
        this._playSfx(this.SFX.success); // chime as the "Success!" banner appears
      }
      return;
    }

    if (this._phase === "ended") {
      // hold on the "Success!" banner so it's readable, then hand off
      if (!this._finished && now - this._phaseStartMs >= 1500) {
        this._finished = true;
        this.active = false;
        if (this._canvasEl) this._canvasEl.style.imageRendering = ""; // restore smooth scaling
        // fade out the mini-game BGM so it doesn't bleed into the next scene
        if (typeof audioMgr !== "undefined" && audioMgr) {
          audioMgr.stop(this.BGM, { fadeMs: 600 });
        }
        this.onFinish?.();
      }
    }
  }

  _stepItem(item, other, dt, isGood) {
    item.vy = this._fallSpeed * this._speedMult;
    item.y += item.vy * dt;

    // catch zone = the upper rim of the pot
    const z = {
      x: this._pot.x + 18,
      y: this._pot.y + 8,
      w: this._pot.w - 36,
      h: 46,
    };
    const hit =
      item.x < z.x + z.w &&
      item.x + item.w > z.x &&
      item.y < z.y + z.h &&
      item.y + item.h > z.y;

    if (hit) {
      if (isGood) {
        this._progress = Math.min(this.TARGET, this._progress + 1);
        this._playSfx(this.SFX.good);
      } else {
        this._progress = Math.max(0, this._progress - 1);
        this._playSfx(this.SFX.bad);
      }
      this._respawn(item, other);
      return;
    }

    if (item.y >= height) this._respawn(item, other); // missed → no penalty
  }

  render() {
    if (!this.active) return;

    push();
    imageMode(CORNER);
    drawingContext.imageSmoothingEnabled = false; // crisp pixel art

    // full-frame background
    if (this._img?.bg) image(this._img.bg, 0, 0, width, height);
    else background(60, 40, 25);

    // falling food (hidden during the countdown for a clean read)
    if (this._phase !== "countdown") {
      const g = this._good,
        b = this._bad;
      if (g.img) image(g.img, g.x, g.y, g.w, g.h);
      if (b.img) image(b.img, b.x, b.y, b.w, b.h);
    }

    // pot
    if (this._img?.pot)
      image(this._img.pot, this._pot.x, this._pot.y, this._pot.w, this._pot.h);

    // decorative frame border on top of the play area
    if (this._img?.frame) image(this._img.frame, 0, 0, width, height);

    this._drawBar();
    if (this._phase === "countdown") this._drawCountdown();
    if (this._phase === "ended") this._drawSuccess();

    drawingContext.imageSmoothingEnabled = true; // restore for other scenes
    pop();
  }

  _drawBar() {
    const { BAR_X: x, BAR_Y: y, BAR_W: w, BAR_H: h } = this;
    const frac = constrain(this._progress / this.TARGET, 0, 1);
    push();
    noStroke();
    fill(150, 150, 150); // track (square corners — pixel style)
    rect(x, y, w, h);
    fill(124, 207, 47); // green fill
    if (frac > 0) rect(x, y, floor(w * frac), h);
    pop();
  }

  _drawCountdown() {
    const elapsed = millis() - this._phaseStartMs;
    let label;
    if (elapsed < 700) label = "3";
    else if (elapsed < 1400) label = "2";
    else if (elapsed < 2100) label = "1";
    else label = "Go!";
    // tutorial image, shown full-frame only during the 3-2-1-Go countdown
    if (this._img?.tut) {
      push();
      imageMode(CORNER);
      image(this._img.tut, 0, 0, width, height);
      pop();
    }
    push();
    if (this._font) textFont(this._font);
    textAlign(CENTER, CENTER);
    textSize(140);
    fill(0, 0, 0, 120);
    text(label, width / 2 + 5, height / 2 + 5); // shadow
    fill(255);
    text(label, width / 2, height / 2);
    pop();
  }

  _drawSuccess() {
    push();
    if (this._font) textFont(this._font);
    textAlign(CENTER, CENTER);
    textSize(110);
    fill(0, 0, 0, 130);
    text("Success!", width / 2 + 5, height / 2 + 5); // shadow
    fill(124, 207, 47); // green, matches the bar
    text("Success!", width / 2, height / 2);
    pop();
  }

  // pot follows the mouse — no click needed
  mousePressed() {}
}

// ── expose global ─────────────────────────────────────────────────
window.PA_GameManager = PA_GameManager;
