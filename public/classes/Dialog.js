// classes/Dialog.js
class Dialog {
  constructor(opts = {}) {
    // UI placement
    this.x = opts.x ?? 137;
    this.y = opts.y ?? 396;
    this.w = opts.w ?? 750;
    this.h = opts.h ?? 141;

    this.boxImagePath = opts.boxImage ?? null;

    this.boxImageNormalPath =
      opts.boxImageNormal ?? "assets/ui/ui_diaBox_nor.png";
    this.boxImageCharPath = opts.boxImageChar ?? "assets/ui/ui_diaBox_char.png";

    // Font
    this.fontPath =
      opts.fontPath ?? "assets/fonts/Lexend-VariableFont_wght.ttf";
    this.font = null;

    // Text metrics
    this.textSize = opts.textSize ?? 20;
    this.leading = opts.leading ?? 26;
    this.nameSize = opts.nameSize ?? 20;

    this._nameRect = { ox: 14, oy: 9, w: 112, h: 25 };
    this._textRect = { ox: 30, oy: 42, w: 690, h: 80 };

    // Alphas for UI/CG fade
    this.fadeInMs = opts.fadeInMs ?? 250;
    this.fadeOutMs = opts.fadeOutMs ?? 200;
    this.alpha = 0;
    this._uiFade = new Tween({ from: 0, to: 255, dur: this.fadeInMs });
    this._fadingOut = false;

    // Audio (external manager)
    this.audio = opts.audio ?? null;

    // Caches
    this.bgCache = new AssetCache();
    this.cgCache = new AssetCache();

    // BG & CG layers
    this.bg = new CrossfadeLayer({
      cache: this.bgCache,
      fadeMs: opts.bgFadeMs ?? 300,
      drawFn: (img) => image(img, 0, 0, width, height),
    });
    this.cg = new CrossfadeLayer({
      cache: this.cgCache,
      fadeMs: opts.cgFadeMs ?? 250,
      drawFn: (img) => image(img, 207, 0, 610, 576),
    });

    // Typewriter & arrow
    this.typer = new Typewriter({
      charMs: opts.charMs ?? 20,
      punctExtraMs: opts.punctExtraMs ?? 80,
    });
    this.arrow = new Blinker({ periodMs: opts.arrowBlinkPeriodMs ?? 900 });

    // Preserve end BG
    this.preserveBgOnEnd = true;
    this.holdBgAfterFinishMs = opts.holdBgAfterFinishMs ?? 150;
    this._uiOnlyFade = false;
    this._holdBgUntil = 0;

    // Script/state
    this.script = [];
    this.index = 0;
    this._running = false;
    this._finished = false;
    this.onFinish = null;

    // Assets
    this.boxImg = null;

    // SFX
    this.clickSfxPath = opts.clickSfxPath ?? "assets/audio/ui_clickDia.mp3";
    this.clickSfxVolume = opts.clickSfxVolume ?? 1.0;
  }

  preload() {
    if (this.boxImagePath) this.boxImg = loadImage(this.boxImagePath);

    this.boxImgNormal = loadImage(this.boxImageNormalPath);
    this.boxImgChar = loadImage(this.boxImageCharPath);

    this.font = loadFont(this.fontPath);
  }

  setScript(lines) {
    this.script = Array.isArray(lines) ? lines.slice() : [];
    this.index = 0;
    this._finished = false;
  }

  start() {
    if (!this.script.length) {
      this._running = false;
      this._finished = true;
      this.onFinish?.();
      return;
    }
    this._running = true;
    this._finished = false;
    this._fadingOut = false;
    this._uiOnlyFade = false;
    this._holdBgUntil = 0;
    this._uiFade.start(0, 255, this.fadeInMs);
    this.alpha = 0;
    this._applyLine(this.script[this.index], true);
  }

  update() {
    const holdingBg = this._isHoldingBg();
    if (!this._running && !this._fadingOut && !holdingBg) return;

    this.alpha = this._uiFade.update();
    this.bg.update();
    this.cg.update();
    this.typer.update();
    this.arrow.setEnabled(!this.typer.typing);
    this.arrow.update();

    if (this._fadingOut && !this._uiFade.active && this.alpha <= 1) {
      this._fadingOut = false;
      this._running = false;
      this._finished = true;
      this.onFinish?.();
    }
  }

  render() {
    const holdingBg = this._isHoldingBg();
    if (!this._running && !this._fadingOut && !holdingBg) return;

    const uiA = this.alpha;
    const bgA = this._fadingOut && this._uiOnlyFade ? 255 : uiA;

    // BG
    this.bg.render(bgA);

    if (!this._running && !this._fadingOut && holdingBg) return;

    // CG
    this.cg.render(uiA);

    // UI box
    push();
    const cur = this.script[this.index] || {};
    const hasName = !!(cur.charName && String(cur.charName).trim());

    const boxToUse = hasName
      ? this.boxImgChar || this.boxImg || null
      : this.boxImgNormal || this.boxImg || null;

    if (boxToUse) {
      tint(255, uiA);
      image(boxToUse, this.x, this.y, this.w, this.h);
    } else {
      noStroke();
      fill(255, 255, 255, uiA);
      rect(this.x, this.y, this.w, this.h, 10);
      stroke(0, 0, 0, uiA);
      noFill();
      rect(this.x, this.y, this.w, this.h, 10);
    }

    // nameplate
    if (cur.charName) {
      const nr = this._nameRect;
      push();
      if (this.font) textFont(this.font);
      textSize(this.nameSize);
      textLeading(this.nameSize * 1.25);
      textAlign(CENTER, CENTER);
      noStroke();
      fill(240, 240, 240, uiA);
      text(cur.charName, this.x + nr.ox - 7, this.y + nr.oy + 3, nr.w, nr.h);
      pop();
    }

    // body text (typewriter)
    const tr = this._textRect;
    const body = this.typer.visibleText;
    if (body) {
      push();
      if (this.font) textFont(this.font);
      textSize(this.textSize);
      textLeading(this.leading);
      textAlign(LEFT, TOP);
      noStroke();
      fill(0, 0, 0, uiA);
      const lines = this._wrap(body, tr.w);
      const maxLines = Math.max(1, Math.floor(tr.h / this.leading));
      for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
        text(
          lines[i],
          this.x + tr.ox + 6,
          this.y + tr.oy + i * this.leading + 5
        );
      }
      pop();
    }

    // blinking arrow
    if (!this.typer.typing && uiA > 0) {
      const ax = this.x + this.w - 18;
      const ay = this.y + this.h - 15;
      push();
      if (this.font) textFont(this.font);
      textSize(24);
      textAlign(RIGHT, BOTTOM);
      noStroke();
      fill(0, 0, 0, Math.min(255, this.arrow.alpha * (uiA / 255)));
      text(">", ax, ay);
      pop();
    }

    pop();
  }

  next() {
    if (!this._running) return;

    // finish typing first (user click reveals remainder)
    if (this.typer.typing) {
      // play click
      if (this.audio && this.clickSfxPath) {
        this.audio.play(this.clickSfxPath, { volume: this.clickSfxVolume });
      }
      this.typer.revealAll();
      this.arrow.reset();
      return;
    }

    // user click to advance to the next line → play click
    if (this.audio && this.clickSfxPath) {
      this.audio.play(this.clickSfxPath, { volume: this.clickSfxVolume });
    }

    // advance
    this.index++;
    if (this.index >= this.script.length) {
      // end: clear CG instantly, fade only UI, hold BG briefly
      this.cg.clearInstant();
      this._fadingOut = true;
      this._uiOnlyFade = this.preserveBgOnEnd;
      this._holdBgUntil = millis() + this.holdBgAfterFinishMs;
      this._uiFade.start(this.alpha, 0, this.fadeOutMs);
      return;
    }
    this._applyLine(this.script[this.index], false);

    // if we were mid-fading out UI (rare), brighten quickly
    if (this.alpha < 200 && !this._fadingOut) {
      this._uiFade.start(this.alpha, 255, Math.max(120, this.fadeInMs * 0.5));
    }
  }

  mousePressed() {
    if (this._running) this.next();
  }
  keyPressed(k = key) {
    if (this._running && (k === " " || k === "Enter")) this.next();
  }

  isActive() {
    return this._running;
  }
  isFinished() {
    return this._finished;
  }

  // —— internals ——
  _applyLine(line) {
    // BG
    this.bg.set(line.bg || null);

    // SFX
    if (line.stopSound) this._stopSoundLine(line);
    if (line.soundEffect && this.audio) this.audio.play(line.soundEffect);

    // CG policy: first CG fades in; CG->CG instant swap; CG->none fade out
    const hadCG = !!this.cg.curPath;
    if (!line.charCG) {
      if (hadCG) {
        // fade out previous
        this.cg.prev = this.cg.cur;
        this.cg.prevPath = this.cg.curPath;
        this.cg.cur = null;
        this.cg.curPath = null;
        this.cg._fade.start(0, 255, this.cg.fadeMs);
        this.cg.alpha = 0;
      } else {
        this.cg.clearInstant();
      }
    } else if (!hadCG) {
      this.cg.set(line.charCG); // will fade in
    } else {
      // CG->CG: instant swap (no fade)
      if (line.charCG !== this.cg.curPath) {
        this.cg.prev = null;
        this.cg.prevPath = null;
        this.cg._fade.start(255, 255, 1);
        this.cg.alpha = 255;
        this.cg.cache.load(line.charCG, (img) => {
          this.cg.cur = img || this.cg.cur;
          if (img) this.cg.curPath = line.charCG;
        });
      } else {
        // same CG again
        this.cg.prev = null;
        this.cg.prevPath = null;
        this.cg._fade.start(255, 255, 1);
        this.cg.alpha = 255;
      }
    }

    // Typewriter
    this.typer.start(line.text || "");
    this.arrow.setEnabled(!this.typer.typing);
  }

  _stopSoundLine(line) {
    const raw = line.stopSound;
    const parsed =
      typeof raw === "string"
        ? {
            path: raw,
            fadeMs:
              typeof line.fadeSoundMs === "number" ? line.fadeSoundMs : null,
          }
        : {
            path: raw?.path ?? "ALL",
            fadeMs:
              typeof raw?.fadeMs === "number"
                ? raw.fadeMs
                : typeof line.fadeSoundMs === "number"
                ? line.fadeSoundMs
                : null,
          };
    if (!this.audio) return;
    if (!this.audio) return;

    const fadeOpt = { fadeMs: parsed.fadeMs || 0 };
    if (parsed.path === "ALL") this.audio.stopAll(fadeOpt);
    else this.audio.stop(parsed.path, fadeOpt);
  }

  _isHoldingBg() {
    return (
      this._holdBgUntil &&
      millis() < this._holdBgUntil &&
      (this.bg.cur || this.bg.prev)
    );
  }

  _wrap(textStr, maxWidth) {
    if (this.font) textFont(this.font);
    textSize(this.textSize);
    const words = String(textStr || "").split(/\s+/);
    const out = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (textWidth(test) <= maxWidth) line = test;
      else {
        if (line) out.push(line);
        if (textWidth(w) > maxWidth) {
          let chunk = "";
          for (const ch of Array.from(w)) {
            const t = chunk + ch;
            if (textWidth(t) <= maxWidth) chunk = t;
            else {
              if (chunk) out.push(chunk);
              chunk = ch;
            }
          }
          line = chunk;
        } else line = w;
      }
    }
    if (line) out.push(line);
    return out;
  }
}
window.Dialog = Dialog;
