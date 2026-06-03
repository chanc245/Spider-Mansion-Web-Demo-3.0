class Day0QuizLog {
  constructor() {
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

    this.notebookContent = [
      "Day 0 - Question:",
      "I built a house, but the guests didn’t realize it was there and accidentally entered. Afterward, the guests, who were trapped in the house, became my dinner.",
      "Who am I?",
      "*********** QnA Log ***********",
    ];
    this.userFont = null;
    this.fontSize = 20;
    this.leading = 30;

    // Input / flow
    this.input = null;
    this.inputH = 26;
    this.inputPaddingX = 5;
    this.placeholderBase = "write whatever you want to ask....";
    this.questionCount = 0;
    this.inputLimit = 20;
    this._justSubmitted = false;
    this.waitingForAI = false;

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

    // Fade state
    this.active = false;
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
  }

  preload() {
    this.userFont = loadFont("assets/fonts/BradleyHandITCTT-Bold.ttf");

    this.imgPageFlipLeft = loadImage("assets/ui/ui_pageFlip_left.png");
    this.imgPageFlipRight = loadImage("assets/ui/ui_pageFlip_right.png");
  }

  setup() {
    this._maxLinesPerBox = Math.floor(this.h1 / this.leading);

    // Eva init
    const setupText =
      "I built a house, but the guests didn’t realize it was there and accidentally entered. Afterward, the guests, who were trapped in the house, became my dinner. Who am I?";
    const solutionText =
      "I am a spider, and the house is my web. The guests were bugs that got caught in the web because they couldn’t see the transparent threads while flying.";
    this.eva = new Day0Eva(setupText, solutionText, {
      prefix: "Eva",
      icon: "--",
    });

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
        this.input.attribute("placeholder", "Q limit reached (20).");
        this.input.value("");
        this.input.hide();
        return;
      }

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
          `${this.eva.icon}${this.eva.prefix}: (thinking…)`
        ) - 1;
      this._invalidateWrap();

      try {
        const reply = await this.eva.ask(v);
        console.log(`[AI OUTPUT] Eva: ${reply}`);
        this.notebookContent[
          idx
        ] = `${this.eva.icon}${this.eva.prefix}: ${reply}`;
        this.notebookContent.push("***");
        this._afterAIReply(reply);
      } catch (err) {
        this.notebookContent[idx] = `${this.eva.icon}${
          this.eva.prefix
        }: (error) ${err.message || err}`;
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

    if (!shouldBeActive) this.input.hide();
  }

  render(notebookX = 0, notebookY = 0) {
    this.anchorX = notebookX;
    this.anchorY = notebookY;

    if (this.fading) {
      const t = (millis() - this.fadeStart) / this.fadeDurCurrent;
      const clamped = constrain(t, 0, 1);
      const eased = this._easeInOutCubic(clamped);
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

  _afterAIReply(reply) {
    const text = String(reply || "")
      .trim()
      .toLowerCase();

    // success if the AI begins with "that's correct!"
    if (text.startsWith("that's correct!")) {
      this._solved = true;
      this._ending = true;
      this.input.hide();
      if (typeof this.onSolved === "function") this.onSolved();
      return;
    }

    // exhaustion if we've just hit the limit and haven't solved yet
    if (this.questionCount >= this.inputLimit && !this._solved) {
      this._ending = true;
      this.input.attribute("placeholder", "Q limit reached (20).");
      this.input.hide();
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
    if (this._canShowInputThisPage()) this._positionInput(curPageLines.length);
    else this.input.hide();

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
      alpha
    );
    this._drawLines(
      lines.slice(cap, cap * 2),
      this.anchorX + this.x2,
      this.anchorY + this.y2,
      this.w2,
      this.h2,
      alpha
    );
  }

  _drawLines(lines, x, y, w, h, alpha) {
    const max = Math.min(Math.floor(h / this.leading), lines.length);
    push();
    noStroke();
    fill(0, 0, 0, alpha);
    for (let i = 0; i < max; i++) {
      text(lines[i], x, y + i * this.leading, w, this.leading);
    }
    pop();
  }

  _positionInput(usedLines) {
    const cap = this._maxLinesPerBox;
    if (usedLines >= cap * 2) {
      this.input.hide();
      return;
    }

    let boxX, boxY, boxW, row;
    if (usedLines < cap) {
      row = usedLines;
      boxX = this.anchorX + this.x1;
      boxY = this.anchorY + this.y1;
      boxW = this.w1;
    } else {
      row = usedLines - cap;
      boxX = this.anchorX + this.x2;
      boxY = this.anchorY + this.y2;
      boxW = this.w2;
    }

    const w = boxW - 2 * this.inputPaddingX + 15;
    const y = boxY + row * this.leading + (this.leading - this.inputH) / 2;
    const x = boxX + this.inputPaddingX;

    this.input.show();
    const canvasRect = document.querySelector("canvas").getBoundingClientRect();
    this.input.position(canvasRect.left + x - 15, canvasRect.top + y - 20);
    this.input.size(w, this.inputH);
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

  _wrapParagraphs(paragraphs, maxWidth) {
    if (this.userFont) textFont(this.userFont);
    textSize(this.fontSize);
    const out = [];
    for (const para of paragraphs) {
      const words = para.split(/\s+/);
      let line = "";
      for (const word of words) {
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
    }
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

  _easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}
window.Day0QuizLog = Day0QuizLog;
