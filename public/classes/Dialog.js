// classes/Dialog.js
class Dialog {
  constructor(opts = {}) {
    // UI placement
    this.x = opts.x ?? 137;
    this.y = opts.y ?? 396;
    this.w = opts.w ?? 750;
    this.h = opts.h ?? 141;

    // Decorative frame — sits above BG/CG, below text
    this.frameImagePath = opts.frameImage ?? "assets/ui/ui_decor_frame.png";
    this.frameImg = null;

    // Font
    this.fontPath = opts.fontPath ?? "assets/fonts/Forum-Regular.ttf";
    this.font = null;

    // Text metrics
    this.textSize = opts.textSize ?? 20;
    this.leading = opts.leading ?? 23;
    this.nameSize = opts.nameSize ?? 24;

    // Adjust these to reposition text and name on screen
    this._textRect = { x: 195, y: 450, w: 640, h: 100 };
    this._nameRect = { x: 480, y: 525, w: 65, h: 25 };

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
      drawFn: (img) => image(img, 220, 0, 610, 576),
    });

    // Typewriter & arrow
    this.typer = new Typewriter({
      charMs: opts.charMs ?? 20,
      punctExtraMs: opts.punctExtraMs ?? 80,
    });
    this.arrow = new Blinker({ periodMs: opts.arrowBlinkPeriodMs ?? 900 });

    // Advance indicator image (replaces the ">" glyph)
    this.arrowImagePath = opts.arrowImage ?? "assets/ui/ui_text_spiderBlinker.png";
    this.arrowImg = null;

    // Wrap cache — avoid re-wrapping the same text every draw frame
    this._wrapCache = new Map();

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
    this._nextScript = null; // queued script to cross-dissolve into when this one ends

    // Called when a line has an `option` field.
    // sketch.js sets this to trigger DIA_OPTION state.
    // Call dialog.resumeFromOption() when the option is resolved.
    this.onOption = null;

    // SFX
    this.clickSfxPath = opts.clickSfxPath ?? "assets/audio/ui_clickDia.mp3";
    this.clickSfxVolume = opts.clickSfxVolume ?? 1.0;

    // Dialogue voiceover — private Audio element, isolated from AudioManager
    this._diaAudioEl = null;
    this._diaAudioPath = null;
    this.diaAudioVolume = opts.diaAudioVolume ?? 1.0;
    this.diaAudioDir = opts.diaAudioDir
      ? opts.diaAudioDir.replace(/\/?$/, "/")
      : "";
  }

  preload() {
    if (this.frameImagePath) this.frameImg = loadImage(this.frameImagePath);
    if (this.arrowImagePath) this.arrowImg = loadImage(this.arrowImagePath);
    this.font = loadFont(this.fontPath);
  }

  setScript(lines) {
    this.script = Array.isArray(lines) ? lines.slice() : [];
    this.index = 0;
    this._finished = false;
    this._nextScript = null;
  }

  // Seamlessly continue into `script` when the current one ends: the last line
  // cross-dissolves into the first line of `script` instead of fading out to
  // black and fading back in. Used to chain scenes/days without a black flash.
  queueNext(lines) {
    this._nextScript = Array.isArray(lines) ? lines.slice() : [];
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
    this._applyLine(this.script[this.index]);

    // Show the first scene's bg at full opacity immediately. Combined with the
    // bgA rule in render(), the bg appears instantly while the CG/text/frame
    // fade in — no black flash when starting after the quiz or another state.
    this.bg._fade.value = 255;
    this.bg._fade.active = false;
    this.bg.alpha = 255;
    this.bg.prev = null;
    this.bg.prevPath = null;
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
      this._stopDiaAudio();
      this.onFinish?.();
    }
  }

  render() {
    const holdingBg = this._isHoldingBg();
    if (!this._running && !this._fadingOut && !holdingBg) return;

    const uiA = this.alpha;
    // Bg stays solid while the rest of the UI fades in/out, so handing off from
    // a full-screen state (quiz, investigation) doesn't flash black — the canvas
    // is cleared each frame, so a fading bg would otherwise rise out of black.
    const bgA = this._fadingOut && !this._uiOnlyFade ? uiA : 255;

    // 1. BG
    this.bg.render(bgA);
    if (!this._running && !this._fadingOut && holdingBg) return;

    // 2. Character art (CG)
    this.cg.render(uiA);

    // 3. Decorative frame — held solid like the bg (bgA), not faded with the UI
    // text (uiA). Otherwise the frame fades in from black on every VN start,
    // making it blink at option↔VN / manager→VN handoffs where another state
    // already had a frame on screen. It still fades out on a real scene-ending
    // fade (when bgA tracks uiA).
    this._drawFrame(bgA);

    // When an external UI (e.g. DIA_OPTION) owns the screen, keep the bg, CG and
    // decorative frame but skip the nameplate / body text / arrow below.
    if (this.suppressUi) return;

    push();
    const cur = this.script[this.index] || {};

    // 4. Nameplate
    if (cur.charName) {
      const nr = this._nameRect;
      push();
      if (this.font) textFont(this.font);
      textSize(this.nameSize);
      textLeading(this.nameSize * 1.25);
      textAlign(CENTER, CENTER);
      noStroke();
      fill(0xf0, 0xf0, 0xf0, uiA);
      text(cur.charName, nr.x, nr.y, nr.w, nr.h);
      pop();
    }

    // 5. Body text
    const tr = this._textRect;
    const body = this.typer.visibleText;
    if (body) {
      push();
      if (this.font) textFont(this.font);
      textSize(this.textSize);
      textLeading(this.leading);
      textAlign(LEFT, TOP);
      noStroke();
      fill(0xf0, 0xf0, 0xf0, uiA);
      const wrapKey = body + "|" + tr.w;
      if (!this._wrapCache.has(wrapKey)) {
        this._wrapCache.set(wrapKey, this._wrap(body, tr.w));
      }
      const lines = this._wrapCache.get(wrapKey);
      const maxLines = Math.max(1, Math.floor(tr.h / this.leading));
      for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
        text(lines[i], tr.x, tr.y + i * this.leading);
      }
      pop();
    }

    // 6. Blinking advance indicator (spider image, anchored bottom-right)
    if (!this.typer.typing && uiA > 0 && this.arrowImg) {
      const aw = 24, ah = 24;
      const ax = 843, ay = 522;
      push();
      tint(255, Math.min(255, this.arrow.alpha * (uiA / 255)));
      image(this.arrowImg, ax - aw, ay - ah, aw, ah);
      noTint();
      pop();
    }

    pop();
  }

  // Decorative frame overlay — drawn above BG/CG, below text.
  _drawFrame(uiA) {
    if (!this.frameImg || this.showFrame === false) return;
    push();
    tint(255, uiA);
    image(this.frameImg, 0, 0, width, height);
    noTint();
    pop();
  }

  next() {
    if (!this._running) return;

    if (this.typer.typing) {
      if (this.audio && this.clickSfxPath) {
        this.audio.play(this.clickSfxPath, { volume: this.clickSfxVolume });
      }
      this.typer.revealAll();
      this.arrow.reset();
      return;
    }

    if (this.audio && this.clickSfxPath) {
      this.audio.play(this.clickSfxPath, { volume: this.clickSfxVolume });
    }
    this._stopDiaAudio();

    this.index++;
    if (this.index >= this.script.length) {
      // Seamlessly continue into a queued script: cross-dissolve the last line
      // into the next script's first line (no fade-out-to-black + fade-in).
      if (this._nextScript) {
        this.script = this._nextScript;
        this._nextScript = null;
        this.index = 0;
        this._finished = false;
        this._applyLine(this.script[0]);
        return;
      }
      this.cg.clearInstant();
      this._fadingOut = true;
      this._uiOnlyFade = this.preserveBgOnEnd;
      this._holdBgUntil = millis() + this.holdBgAfterFinishMs;
      this._uiFade.start(this.alpha, 0, this.fadeOutMs);
      return;
    }
    this._applyLine(this.script[this.index]);

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

  // Hard-stop the dialog WITHOUT firing onFinish. Use when another system takes
  // over the screen (e.g. a debug jump straight into a quiz/mini-game) so a
  // still-running script can't later fire a stale onFinish and hijack state.
  stop() {
    this._running = false;
    this._fadingOut = false;
    this._uiOnlyFade = false;
    this._holdBgUntil = 0;
    this._finished = true;
    this._nextScript = null;
  }

  // Call this after DIA_OPTION resolves.
  // If resultText is provided, it is shown as a dialogue line before advancing.
  resumeFromOption(resultText = null) {
    if (!this._running) return;
    if (resultText) {
      // Splice the result line in, preserving the current BG and character
      // sprite so neither fades out across the option (e.g. mid-conversation).
      this.script.splice(this.index + 1, 0, {
        text: resultText,
        bg: this.bg.curPath || undefined,
        charCG: this.cg.curPath || undefined,
      });
    }
    this.index++;
    if (this.index >= this.script.length) {
      this.cg.clearInstant();
      this._fadingOut = true;
      this._uiOnlyFade = this.preserveBgOnEnd;
      this._holdBgUntil = millis() + this.holdBgAfterFinishMs;
      this._uiFade.start(this.alpha, 0, this.fadeOutMs);
      return;
    }
    this._applyLine(this.script[this.index]);
  }

  // —— internals ——
  _applyLine(line) {
    // Option line — pause VN and hand off to onOption handler
    if (line.option) {
      if (typeof this.onOption === "function") {
        this.onOption(line.option);
      } else {
        // No handler — skip option line silently
        this.index++;
        if (this.index < this.script.length)
          this._applyLine(this.script[this.index]);
      }
      return;
    }

    // A line without a `bg` field inherits the current background.
    // Use bg: null explicitly to clear it.
    if ("bg" in line) this.bg.set(line.bg || null);
    if (line.stopSound) this._stopSoundLine(line);
    if (line.soundEffect && this.audio) this.audio.play(line.soundEffect);
    this._playDiaAudio(line.diaAudio ?? null);

    const hadCG = !!this.cg.curPath;
    if (!line.charCG) {
      if (hadCG) {
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
      this.cg.set(line.charCG);
    } else {
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
        this.cg.prev = null;
        this.cg.prevPath = null;
        this.cg._fade.start(255, 255, 1);
        this.cg.alpha = 255;
      }
    }

    this._wrapCache.clear();
    this.typer.start(line.text || "");
    this.arrow.setEnabled(!this.typer.typing);
  }

  _playDiaAudio(path) {
    this._stopDiaAudio();
    if (!path) return;
    const fullPath = this.diaAudioDir + path;
    try {
      if (this._diaAudioPath !== fullPath) {
        this._diaAudioEl = new Audio(fullPath);
        this._diaAudioPath = fullPath;
      }
      this._diaAudioEl.currentTime = 0;
      this._diaAudioEl.volume = Math.max(0, Math.min(1, this.diaAudioVolume));
      this._diaAudioEl.play().catch(() => {});
    } catch (_) {}
  }

  _stopDiaAudio() {
    if (!this._diaAudioEl) return;
    try {
      this._diaAudioEl.pause();
      this._diaAudioEl.currentTime = 0;
    } catch (_) {}
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
