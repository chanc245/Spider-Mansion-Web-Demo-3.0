// localStorage key for the Day 0 Q&A log, saved when Day 0 ends and read back
// by the read-only "day0 notes" recap page in the Day 1 notebook.
const DAY0_NOTEBOOK_KEY = "spiderMansion_day0_notebook";

class QuizLog {
  // opts.readOnly → a paged, input-less viewer that renders saved Day 0 notes
  // (loaded from localStorage) instead of running a live Eva Q&A.
  constructor(dayKey = "day0", opts = {}) {
    this._dayKey = dayKey;
    this.readOnly = !!opts.readOnly;
    // Notebook-relative placements
    this.x1 = 135 - 95;
    this.y1 = 110 - 65;
    this.w1 = 345;
    this.h1 = 450;
    this.x2 = 546 - 95;
    this.y2 = 110 - 65;
    this.w2 = 345;
    this.h2 = 450;

    this.anchorX = 0;
    this.anchorY = 0;

    // Populated in setup() from EVA_CONFIGS so it stays in sync with the puzzle
    this.notebookContent = [];
    this.userFont = null;
    this.fontSize = 20;
    this.leading = 30;

    // Input / flow
    this.input = null;
    this.inputH = 26;
    this.inputPaddingX = 5;
    this.placeholderBase = "write whatever you want to ask....";
    this.questionCount = 0;
    this.inputLimit = 20; // overridden in setup() once eva is initialised
    this._justSubmitted = false;
    this.waitingForAI = false;

    // Cached DOM handle + last-applied input geometry so _positionInput can skip
    // redundant querySelector / position() / size() writes (which force a style
    // recalc) on the frames where nothing about the input actually moved.
    this._canvasEl = null;
    this._lastInputGeom = { x: null, y: null, w: null };

    // Outcome + transitions
    this._solved = false;
    this.onSolved = null;
    this.onExhausted = null;
    this._ending = false; // linger for 3s after final reply

    // Paging
    this.page = 0;
    this.pageStarts = [0];
    this._maxLinesPerBox = 0;

    // Nav buttons (screen coords)
    this.leftBtn = { x: 106 + 1, y: 514 - 4, w: 48, h: 52 };
    this.rightBtn = { x: 870 - 1, y: 514 - 4, w: 48, h: 52 };

    // Eva
    this.eva = null;

    // Eva TTS voice — own Audio element, isolated from all other audio
    this._evaVoiceEl = null;
    this.evaVoiceVolume = 1.0; // adjust between 0.0 and 1.0
    this.alpha = 0;
    this.fadeFrom = 0;
    this.fadeTo = 0;
    this.fadeStart = 0;
    this.fading = false;

    this.fadeDurPageIn = 220;
    this.fadeDurPageOut = 0;
    this.fadeDurMoveIn = 350;
    this.fadeDurMoveOut = 170;
    this._fadeProfile = "page";

    // Wrap cache
    this._wrapped = [];
    this._wrapVersion = -1; // tracks notebookContent.length

    // Indices into notebookContent, both preserved by the saved Day 0 log
    // (which is notebookContent verbatim):
    //   question → the one paragraph whose sentences are spaced by a half line
    //   bold     → the "Day N - Question:" heading, drawn with a faux bold
    this._questionParaIdx = 1;
    this._boldParaIdx = 0;
    this.boldStrokeWeight = 0.5;
    this.headingFontSize = 24; // heading only; everything else uses fontSize
  }

  preload() {
    this.userFont = loadFont("assets/fonts/BradleyHandITCTT-Bold.ttf");

    this.imgPageFlipLeft = loadImage("assets/ui/ui_pageFlip_left.png");
    this.imgPageFlipRight = loadImage("assets/ui/ui_pageFlip_right.png");
  }

  setup() {
    this._maxLinesPerBox = Math.floor(this.h1 / this.leading);

    // Read-only recap viewer: no Eva, no input — just paged saved text.
    if (this.readOnly) {
      this._loadNotesContent();
      return;
    }

    // dayKey selects which EVA_CONFIGS entry to use ("day0", "day1", …)
    // The host is always shown as "Eva" for now — her true name (Ara) is a
    // later reveal and must not appear in the UI yet.
    const prefix = "Eva";
    this.eva = new EvaAI(this._dayKey, { prefix, icon: "--" });
    this.inputLimit = this.eva.maxQuestions;

    const dayLabel = this._dayKey === "day0" ? "Day 0" : "Day 1";
    this.notebookContent = [
      `${dayLabel} - Question:`,
      this.eva.setup,
      this._dayKey === "day0" ? "Who am I?" : "What happened?",
      "************* Log *************",
    ];
    // Input
    this.input = createInput("");
    this.input.attribute("placeholder", this._placeholderText());
    this.input.class("notebook-input");

    // Enter handler
    this.input.elt.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const v = this.input.value().trim();
      if (!v) return;

      console.log(`---`);
      console.log(`[USER INPUT] Q${this.questionCount + 1}: ${v}`);

      if (this.questionCount >= this.inputLimit) {
        this.input.attribute(
          "placeholder",
          `Q limit reached (${this.inputLimit}).`,
        );
        this.input.value("");
        this.input.hide();
        return;
      }

      // Notify listeners the player submitted — e.g. to stop the quiz-reading
      // voiceover so it doesn't play on top of Eva's spoken response.
      this.onPlayerSubmit?.();

      // user line
      this.questionCount++;
      this.notebookContent.push(`Q${this.questionCount}: ${v}`);
      this._invalidateWrap();
      this.input.value("");
      this.input.attribute("placeholder", this._placeholderText());

      // AI placeholder
      this.waitingForAI = true;
      this._justSubmitted = true;
      this.input.hide();
      const idx =
        this.notebookContent.push(
          `${this.eva.icon}${this.eva.prefix}: (thinking…)`,
        ) - 1;
      this._invalidateWrap();

      try {
        const reply = await this.eva.ask(v);
        console.log(`[AI OUTPUT] Eva: ${reply}`);
        this.notebookContent[idx] =
          `${this.eva.icon}${this.eva.prefix}: ${reply}`;
        // Usage tally (e.g. "Q3/Q20") so the player always sees how many
        // questions they've spent. Failed asks are refunded and never get
        // here, so the tally only counts questions Eva actually answered.
        this.notebookContent.push(`Q${this.questionCount}/Q${this.inputLimit}`);
        this.notebookContent.push("***");
        // For ending replies (correct/exhausted), _afterAIReply awaits the voice itself.
        // For normal replies, fire-and-forget so the game doesn't block.
        this._afterAIReply(reply)
          .then(() => {})
          .catch(() => {});
        if (!this._ending) this._playEvaVoice(reply);
      } catch (err) {
        // EvaAI refunds a failed ask from its history — roll our counter back
        // too, so the failed attempt doesn't eat one of the limited questions
        // (the next question reuses the same Q number).
        this.questionCount--;
        this.notebookContent[idx] = `${this.eva.icon}${
          this.eva.prefix
        }: (error) ${err.message || err} — not counted, ask again.`;
        this.input.attribute("placeholder", this._placeholderText());
      } finally {
        this._invalidateWrap();
        this.waitingForAI = false;
        setTimeout(() => {
          this._justSubmitted = false;
          if (this._canShowInputThisPage()) this.input.show();
        }, 16);
      }
    });

    // start hidden
    this._applyInputOpacity();
    this.input.hide();
  }

  setActive(shouldBeActive, profile = null) {
    if (profile) this._fadeProfile = profile;
    if (shouldBeActive === this.active && !profile) return;

    const wasActive = this.active;
    this.active = shouldBeActive;

    const goingIn = shouldBeActive && !wasActive;
    const dur =
      this._fadeProfile === "move"
        ? goingIn
          ? this.fadeDurMoveIn
          : this.fadeDurMoveOut
        : goingIn
          ? this.fadeDurPageIn
          : this.fadeDurPageOut;

    this.fadeFrom = this.alpha;
    this.fadeTo = shouldBeActive ? 255 : 0;
    this.fadeStart = millis();
    this.fadeDurCurrent = max(1, dur);
    this.fading = true;

    if (!shouldBeActive && this.input) this.input.hide();
  }

  render(notebookX = 0, notebookY = 0) {
    this.anchorX = notebookX;
    this.anchorY = notebookY;

    if (this.fading) {
      const t = (millis() - this.fadeStart) / this.fadeDurCurrent;
      const clamped = constrain(t, 0, 1);
      const eased = Tween.easeInOutCubic(clamped);
      this.alpha = lerp(this.fadeFrom, this.fadeTo, eased);
      if (clamped >= 1) {
        this.fading = false;
        this.alpha = this.fadeTo;
        if (this.alpha >= 254 && this._canShowInputThisPage())
          this.input.show();
      }
      this._applyInputOpacity();
    }

    this._updateAndDraw();
  }

  mousePressed() {
    // Only react when visible
    if (!this.active || this.alpha <= 1) return;

    // Always allow paging (even during ending / AI thinking)
    if (this._hasPrev() && this._hit(this.leftBtn)) {
      this.page = max(0, this.page - 1);
      this._snapInput();
      return;
    }
    if (this._hasNext() && this._hit(this.rightBtn)) {
      this.page = min(this.pageStarts.length - 1, this.page + 1);
      this._snapInput();
      return;
    }
  }

  // ---------- internal ----------

  async _afterAIReply(reply) {
    const text = String(reply || "")
      .trim()
      .toLowerCase();

    // success if the AI begins with "that's correct!"
    if (text.startsWith("that's correct!")) {
      this._solved = true;
      this._ending = true;
      this.input.hide();
      this._persistNotebook(); // save the finished Day 0 log for the Day 1 recap
      await this._playEvaVoice(reply); // wait for voice to finish
      if (typeof this.onSolved === "function") this.onSolved();
      return;
    }

    // exhaustion if we've just hit the limit and haven't solved yet
    if (this.questionCount >= this.inputLimit && !this._solved) {
      this._ending = true;
      this.input.attribute(
        "placeholder",
        `Q limit reached (${this.inputLimit}).`,
      );
      this.input.hide();
      this._persistNotebook(); // save the finished Day 0 log for the Day 1 recap
      await this._playEvaVoice(reply); // wait for voice to finish
      if (typeof this.onExhausted === "function") this.onExhausted();
    }
  }

  _updateAndDraw() {
    if (this.userFont) textFont(this.userFont);
    textSize(this.fontSize);
    textLeading(this.leading);

    // wrap cache
    if (this._wrapVersion !== this.notebookContent.length) {
      this._wrapped = this._wrapParagraphs(this.notebookContent, this.w1);
      this._wrapVersion = this.notebookContent.length;
    }

    const capPerPage = this._maxLinesPerBox * 2;

    // Ensure current pageStart is defined
    if (!Number.isInteger(this.pageStarts[this.page])) {
      const lastKnown = this.pageStarts[this.page - 1];
      this.pageStarts[this.page] = Number.isInteger(lastKnown)
        ? min(this._wrapped.length, lastKnown + capPerPage)
        : 0;
    }

    let thisStart = this.pageStarts[this.page];
    let nextStart =
      this.page + 1 < this.pageStarts.length
        ? this.pageStarts[this.page + 1]
        : this._wrapped.length;
    let curPageLines = this._wrapped.slice(thisStart, nextStart);

    // auto paginate exactly at overflow point for the LAST page
    const linesFromCur = this._wrapped.length - thisStart;
    if (this.page === this.pageStarts.length - 1 && linesFromCur > capPerPage) {
      const overflowStart = thisStart + capPerPage;
      if (this.pageStarts[this.pageStarts.length - 1] !== overflowStart) {
        this.pageStarts.push(overflowStart);
      }
      this.page = this.pageStarts.length - 1;
      thisStart = this.pageStarts[this.page];
      nextStart = this._wrapped.length;
      curPageLines = this._wrapped.slice(thisStart, nextStart);
    }

    if (
      this.page === this.pageStarts.length - 1 &&
      this._canShowInputThisPage()
    ) {
      const used = curPageLines.length;
      const needsNext = used >= capPerPage - 1; // reserve 1 row for input
      if (needsNext) {
        const reserveStart = thisStart + capPerPage;
        if (this.pageStarts[this.pageStarts.length - 1] !== reserveStart) {
          this.pageStarts.push(reserveStart);
        }
        this.page = this.pageStarts.length - 1;
        thisStart = this.pageStarts[this.page];
        nextStart = this._wrapped.length;
        curPageLines = this._wrapped.slice(thisStart, nextStart);
      }
    }

    // draw columns
    this._drawColumns(curPageLines, this.alpha);

    // input position
    if (this._canShowInputThisPage()) this._positionInput(curPageLines);
    else if (this.input) this.input.hide();

    // nav buttons
    if (this.alpha > 1) {
      if (this._hasPrev())
        this._drawNavButton(this.leftBtn, this.page - 1 + 1, this.alpha);
      if (this._hasNext())
        this._drawNavButton(this.rightBtn, this.page + 1 + 1, this.alpha);
    }
  }

  _invalidateWrap() {
    this._wrapVersion = -1;
  }

  _hasPrev() {
    return this.page > 0;
  }
  _hasNext() {
    return this.page + 1 < this.pageStarts.length;
  }

  _canShowInputThisPage() {
    if (this.readOnly || !this.input) return false;
    return (
      this.alpha >= 200 &&
      this.page === this.pageStarts.length - 1 &&
      this.questionCount < this.inputLimit &&
      !this._justSubmitted &&
      !this.waitingForAI &&
      !this._ending
    );
  }

  _applyInputOpacity() {
    if (!this.input) return;
    const op = (this.alpha / 255).toFixed(3);
    this.input.style("opacity", op);
    this.input.style("pointer-events", this.alpha > 200 ? "auto" : "none");
    this.input.style("z-index", "10");
  }

  _snapInput() {
    if (!this.input) return;
    this._justSubmitted = true;
    this.input.hide();
    setTimeout(() => {
      this._justSubmitted = false;
      if (this._canShowInputThisPage()) {
        this.input.show();
        this.input.elt.focus();
      }
    }, 30);
  }

  _drawColumns(lines, alpha) {
    const cap = this._maxLinesPerBox;
    this._drawLines(
      lines.slice(0, cap),
      this.anchorX + this.x1,
      this.anchorY + this.y1,
      this.w1,
      this.h1,
      alpha,
    );
    this._drawLines(
      lines.slice(cap, cap * 2),
      this.anchorX + this.x2,
      this.anchorY + this.y2,
      this.w2,
      this.h2,
      alpha,
    );
  }

  _drawLines(lines, x, y, w, h, alpha) {
    const max = Math.min(Math.floor(h / this.leading), lines.length);
    push();
    noStroke();
    fill(0, 0, 0, alpha);
    strokeJoin(ROUND);
    let dy = 0;
    // The notebook font only ships in one weight and p5 ignores textStyle(BOLD)
    // for fonts loaded with loadFont, so "bold" is faked by stroking the glyphs
    // in their own colour.
    const setBold = (on) => {
      if (!on) return noStroke();
      stroke(0, 0, 0, alpha);
      strokeWeight(this.boldStrokeWeight);
    };
    for (const ln of lines.slice(0, max)) {
      setBold(ln.bold);
      textSize(ln.fs); // rows carry their own size (the heading is larger)
      text(ln.t, x, y + dy, w, this.leading);
      dy += ln.hf * this.leading;
    }
    pop();
  }

  // pageLines: the wrapped rows already drawn on this page ([{ t, hf }]).
  // The input sits right under the last row of whichever column it lands in,
  // so its offset is the summed row heights — not usedLines * leading.
  _positionInput(pageLines) {
    const cap = this._maxLinesPerBox;
    const usedLines = pageLines.length;
    if (usedLines >= cap * 2) {
      this.input.hide();
      return;
    }

    let boxX, boxY, boxW, colLines;
    if (usedLines < cap) {
      colLines = pageLines;
      boxX = this.anchorX + this.x1;
      boxY = this.anchorY + this.y1;
      boxW = this.w1;
    } else {
      colLines = pageLines.slice(cap);
      boxX = this.anchorX + this.x2;
      boxY = this.anchorY + this.y2;
      boxW = this.w2;
    }
    const colH = colLines.reduce((sum, ln) => sum + ln.hf * this.leading, 0);

    const w = boxW - 2 * this.inputPaddingX + 15;
    const y = boxY + colH + (this.leading - this.inputH) / 2;
    const x = boxX + this.inputPaddingX;

    this.input.show();
    if (!this._canvasEl || !this._canvasEl.isConnected)
      this._canvasEl = document.querySelector("canvas");
    if (!this._canvasEl) return;
    const canvasRect = this._canvasEl.getBoundingClientRect();
    const px = canvasRect.left + x - 15;
    const py = canvasRect.top + y - 20;
    // Only touch the DOM when the geometry actually changed — otherwise these
    // position()/size() calls trigger a style recalc every single frame.
    const g = this._lastInputGeom;
    if (px !== g.x || py !== g.y) {
      this.input.position(px, py);
      g.x = px;
      g.y = py;
    }
    if (w !== g.w) {
      this.input.size(w, this.inputH);
      g.w = w;
    }
  }

  _drawNavButton(btn, label1Based, alpha) {
    push();

    let img = null;
    if (btn === this.leftBtn) img = this.imgPageFlipLeft;
    else if (btn === this.rightBtn) img = this.imgPageFlipRight;

    let imgN = 5;
    if (btn === this.leftBtn) imgN = imgN;
    else if (btn === this.rightBtn) imgN = -imgN;

    if (img) {
      // Draw the image with alpha
      tint(255, alpha);
      image(img, btn.x, btn.y, btn.w, btn.h);
      noTint();
    } else {
      // Fallback to rectangle if image is missing
      noStroke();
      fill(255, 255, 255, 230 * (alpha / 255));
      rect(btn.x, btn.y, btn.w, btn.h, 8);
      stroke(0, 0, 0, alpha);
      strokeWeight(2);
      noFill();
      rect(btn.x, btn.y, btn.w, btn.h, 8);
    }

    // Draw label text on top (optional)
    noStroke();
    fill(0, 0, 0, alpha);
    textAlign(CENTER, CENTER);
    textSize(16);
    text(label1Based, btn.x + imgN + btn.w / 2, btn.y + btn.h / 2 - 10);

    pop();
  }

  // → [{ t, hf, bold, fs }] where hf is the row's height as a fraction of
  // this.leading and fs its font size. Paging and column packing still count
  // every entry as one row, so a half spacer just leaves a little slack at the
  // bottom of the page — never an overflow.
  _wrapParagraphs(paragraphs, maxWidth) {
    if (this.userFont) textFont(this.userFont);
    const out = [];
    const add = (t, hf = 1, bold = false, fs = this.fontSize) =>
      out.push({ t, hf, bold, fs });
    paragraphs.forEach((para, pIdx) => {
      // Only the question paragraph gets a gap between its sentences (half a
      // line). The Q&A log lines run with no spacer at all.
      const spacerHf = pIdx === this._questionParaIdx ? 0.5 : 0;
      // Bold rows: the "Day N - Question:" heading, and every player entry —
      // those open with "Qn:" — label and typed question alike.
      const heading = pIdx === this._boldParaIdx;
      const bold = heading || /^Q\d+:/.test(String(para).trim());
      // The heading is set larger, so measure this paragraph at its own size —
      // textWidth() below reads whatever textSize() is current.
      const fs = heading ? this.headingFontSize : this.fontSize;
      textSize(fs);
      // Break each paragraph after every full stop so each sentence starts on
      // its own line. Split only when "." is followed by whitespace (keeps the
      // period, and leaves decimals / "Q1:" style entries untouched).
      const sentences = String(para)
        .split(/(?<=\.)\s+/)
        .filter((s) => s.length);
      sentences.forEach((sentence, i) => {
        if (i > 0 && spacerHf) add("", spacerHf); // spacer row between sentences
        for (const line of this._wrapSentence(sentence, maxWidth))
          add(line, 1, bold, fs);
      });
    });
    return out;
  }

  _wrapSentence(sentence, maxWidth) {
    const out = [];
    let line = "";
    for (const word of sentence.split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (textWidth(test) <= maxWidth) line = test;
      else {
        if (line) out.push(line);
        if (textWidth(word) > maxWidth) {
          for (const chunk of this._hardBreakWord(word, maxWidth))
            out.push(chunk);
          line = out.pop();
        } else line = word;
      }
    }
    if (line) out.push(line);
    return out;
  }

  _hardBreakWord(word, maxWidth) {
    const parts = [];
    let chunk = "";
    for (const ch of Array.from(word)) {
      const test = chunk + ch;
      if (textWidth(test) <= maxWidth) chunk = test;
      else {
        if (chunk) parts.push(chunk);
        chunk = ch;
      }
    }
    if (chunk) parts.push(chunk);
    return parts;
  }

  _hit(btn) {
    return this._inRect(mouseX, mouseY, btn.x, btn.y, btn.w, btn.h);
  }
  _inRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }

  _placeholderText() {
    const n = Math.min(this.questionCount + 1, this.inputLimit);
    return `Q${n}: ${this.placeholderBase}`;
  }

  // ---------- Day 0 notes persistence (read-only recap support) ----------

  // Save the current log to localStorage. No-op unless this is the Day 0 log.
  _persistNotebook() {
    if (this._dayKey !== "day0") return;
    try {
      localStorage.setItem(
        DAY0_NOTEBOOK_KEY,
        JSON.stringify(this.notebookContent),
      );
    } catch (e) {
      console.warn("Could not save Day 0 notebook:", e);
    }
  }

  // Read the saved Day 0 log back, or null if nothing valid is stored.
  _loadPersistedNotebook() {
    try {
      const raw = localStorage.getItem(DAY0_NOTEBOOK_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch {
      return null;
    }
  }

  // Populate notebookContent for the read-only viewer + reset paging.
  _loadNotesContent() {
    const saved = this._loadPersistedNotebook();
    this.notebookContent =
      saved && saved.length
        ? saved
        : ["Day 0 - Logs:", "(No logs from Day 0 were saved.)"];
    this.page = 0;
    this.pageStarts = [0];
    this._invalidateWrap();
  }

  // Public: re-read storage (e.g. when the Day 1 quiz opens, so notes written
  // earlier this session are picked up without a page refresh).
  reloadFromStorage() {
    if (!this.readOnly) return;
    this._loadNotesContent();
  }

  // Fetch TTS audio from the server and play it.
  // Uses a blob URL so nothing is written to disk.
  // Returns a promise that resolves when the audio finishes playing.
  // Resolves immediately (silently) if TTS is unavailable — game logic is unaffected.
  async _playEvaVoice(text) {
    return new Promise(async (resolve) => {
      try {
        // Stop any currently playing Eva voice first
        if (this._evaVoiceEl) {
          this._evaVoiceEl.pause();
          this._evaVoiceEl = null;
        }

        const res = await fetch("/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          console.warn("TTS request failed:", res.status);
          resolve();
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        const cleanup = () => {
          URL.revokeObjectURL(url);
          resolve();
        };

        audio.addEventListener("ended", cleanup);
        audio.addEventListener("error", cleanup);

        audio.volume = Math.max(0, Math.min(1, this.evaVoiceVolume));
        this._evaVoiceEl = audio;
        audio.play().catch(() => {
          resolve();
        });
      } catch (err) {
        console.warn("TTS error (non-fatal):", err);
        resolve();
      }
    });
  }
}
window.QuizLog = QuizLog;
