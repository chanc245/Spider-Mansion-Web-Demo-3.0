class Day0Quiz {
  constructor(opts = {}) {
    // configurable slide durations (ms
    this.nbInDur = opts.nbInDur ?? 700; // bottom → visible
    this.nbOutDur = opts.nbOutDur ?? 500; // visible → offscreen

    // assets
    this.bg = null;
    this.notebookLog = null;
    this.notebookClues = null;
    this.notebookRules = null;
    this.userFont = null;

    // scroll + notebook slide
    this.yOffset = 0;
    this.scroll = new Tween({ from: 0, to: 0, dur: 700 }); // to set in setup()
    this.nbT = 0;
    this.nbSlide = new Tween({ from: 0, to: 1, dur: this.nbInDur }); // dur will be overridden per direction

    // state
    this.quizState = false;
    this.NOTEBOOK_W = 815;
    this.NOTEBOOK_H = 510;
    this.notebookX = 0;
    this.notebookY = 0;
    this.currentNotebook = null;

    // tags
    this.tagClues = null;
    this.tagRules = null;
    this.tagLog = null;

    // page flags
    this.cluesHiddenOnClues = false;
    this.rulesHiddenOnRules = false;

    // markers
    this._cluesLastPath = null;
    this._rulesLastPath = null;

    // return-to-log coordination
    this._returningToLog = false;
    this._pendingToLogCount = 0;

    this.onScrollEnd = null;
    this._lastScrollActive = false;
  }

  preload() {
    this.bg = loadImage("assets/quiz/bg_quiz_day0_attic.png");
    this.notebookLog = loadImage("assets/quiz/notebook_QuestionLog_1.png");
    this.notebookClues = loadImage("assets/quiz/notebook_Clues.png");
    this.notebookRules = loadImage("assets/quiz/notebook_Rules.png");
    this.userFont = loadFont("assets/fonts/BradleyHandITCTT-Bold.ttf");

    this.imgBookmarkClues = loadImage("assets/quiz/bookmark_clues.png");
    this.imgBookmarkRules = loadImage("assets/quiz/bookmark_rules.png");
    this.imgBookmarkLogs = loadImage("assets/quiz/bookmark_logs.png");
  }

  setup() {
    this.notebookX = (width - this.NOTEBOOK_W) / 2;
    this.notebookY = height - this.NOTEBOOK_H;
    this.currentNotebook = this.notebookLog;

    this.scroll.start(0, height);

    // left-side tags
    this.tagClues = new TagOverlayAnimator({
      label: "clues",
      baseX: 5,
      y: 750,
      w: 100,
      h: 50,
      font: this.userFont,
      slideDur: 300,
      aniDirection: "LTR",
      bgImg: this.imgBookmarkClues,
    });

    this.tagRules = new TagOverlayAnimator({
      label: "rules",
      baseX: 5,
      y: 680,
      w: 100,
      h: 50,
      font: this.userFont,
      slideDur: 300,
      aniDirection: "LTR",
      bgImg: this.imgBookmarkRules,
    });

    this.tagLog = new TagOverlayAnimator({
      label: "log",
      baseX: 919,
      y: 680,
      w: 100,
      h: 50,
      font: this.userFont,
      slideDur: 300,
      aniDirection: "RTL",
      bgImg: this.imgBookmarkLogs,
    });
  }

  update() {
    background(220);

    // scroll & attic
    this.yOffset = this.scroll.update();
    if (this._lastScrollActive && !this.scroll.active) {
      const atBottom = Math.abs(this.yOffset - height) < 0.5;
      const visible = atBottom && this.quizState;
      try {
        this.onScrollEnd?.(this.quizState, this.yOffset, visible);
      } catch {}
    }
    this._lastScrollActive = this.scroll.active;

    image(this.bg, 0, -this.yOffset, width, height * 2);

    // notebook slide at bottom
    const atBottom = Math.abs(this.yOffset - height) < 0.5;
    const want = atBottom ? 1 : 0;
    if (
      (want === 1 && this.nbSlide.to !== 1) ||
      (want === 0 && this.nbSlide.to !== 0)
    ) {
      // use independent durations per direction
      const dur = want === 1 ? this.nbInDur : this.nbOutDur;
      this.nbSlide.start(this.nbT, want, dur);
    }
    this.nbT = this.nbSlide.update();

    // run tag tweens
    const stClues = this.tagClues.update();
    const stRules = this.tagRules.update();
    const stLog = this.tagLog.update();

    // overlay finish: CLUES
    if (this.tagClues.overlayActive && stClues.done) {
      this.tagClues.overlayActive = false;
      if (this._cluesLastPath === "logToPage") this.cluesHiddenOnClues = true;
      else if (this._cluesLastPath === "pageToLog" && this._returningToLog)
        this._decToLogAndMaybeSwitch();
      this._cluesLastPath = null;
    }

    // overlay finish: RULES
    if (this.tagRules.overlayActive && stRules.done) {
      this.tagRules.overlayActive = false;
      if (this._rulesLastPath === "logToPage") this.rulesHiddenOnRules = true;
      else if (this._rulesLastPath === "pageToLog" && this._returningToLog)
        this._decToLogAndMaybeSwitch();
      this._rulesLastPath = null;
    }

    // overlay finish: LOG
    if (this.tagLog.overlayActive && stLog.done) {
      this.tagLog.overlayActive = false;
      if (this._returningToLog) this._decToLogAndMaybeSwitch();
    }

    this.renderNotebookGroup();
  }

  renderNotebookGroup() {
    if (!(this.nbT > 0 || this.nbSlide.active)) return;
    const ySlide = lerp(height, this.notebookY, this.nbT);

    push();
    translate(0, ySlide - this.notebookY);

    // 1) stationary tags behind notebook
    if (this.currentNotebook === this.notebookLog) {
      if (!this.tagClues.overlayActive) this.tagClues.drawClickable();
      if (!this.tagRules.overlayActive) this.tagRules.drawClickable();
    } else if (this.currentNotebook === this.notebookClues) {
      if (!this.tagRules.overlayActive) this.tagRules.drawClickable();
      if (!this.tagClues.overlayActive && !this.cluesHiddenOnClues)
        this.tagClues.drawClickable();
      if (!this.tagLog.overlayActive) this.tagLog.drawClickable();
    } else if (this.currentNotebook === this.notebookRules) {
      if (!this.tagClues.overlayActive) this.tagClues.drawClickable();
      if (!this.tagRules.overlayActive && !this.rulesHiddenOnRules)
        this.tagRules.drawClickable();
      if (!this.tagLog.overlayActive) this.tagLog.drawClickable();
    }

    // 2) animated overlays
    if (this.tagClues.overlayActive) this.tagClues.drawUnder();
    if (this.tagRules.overlayActive) this.tagRules.drawUnder();
    if (this.tagLog.overlayActive) this.tagLog.drawUnder();

    // 3) notebook image
    let img = this.notebookLog;
    if (this.currentNotebook === this.notebookClues) img = this.notebookClues;
    else if (this.currentNotebook === this.notebookRules)
      img = this.notebookRules;

    image(
      img,
      this.notebookX,
      this.notebookY,
      this.NOTEBOOK_W,
      this.NOTEBOOK_H
    );
    pop();
  }

  // visible state for Day0QuizLog
  isNotebookShown() {
    return (
      this.nbT >= 0.999 &&
      !this.nbSlide.active &&
      this.quizState &&
      Math.abs(this.yOffset - height) < 0.5
    );
  }

  keyPressed() {
    // if (key === "q" || key === "Q") this.setQuizState(false);
    // else if (key === "w" || key === "W") this.setQuizState(true);
    // else if (key === "z" || key === "Z") this.gotoCluesPage();
    // else if (key === "x" || key === "X") this.gotoLogPage();
  }

  mousePressed() {
    // CLUES
    if (this._canClickClues() && this.tagClues.hit(mouseX, mouseY)) {
      const fromLog = this.currentNotebook === this.notebookLog;

      this.tagClues.startEntrance();
      this.tagClues.overlayActive = true;
      this._cluesLastPath = "logToPage";

      if (this.currentNotebook === this.notebookRules) {
        this.tagRules.startReverseWithFade();
        this.tagRules.overlayActive = true;
        this._rulesLastPath = "pageToBase";
      }

      this.gotoCluesPage();
      this.rulesHiddenOnRules = false;

      if (fromLog) this._playLogEntrance();
      return;
    }

    // RULES
    if (this._canClickRules() && this.tagRules.hit(mouseX, mouseY)) {
      const fromLog = this.currentNotebook === this.notebookLog;

      this.tagRules.startEntrance();
      this.tagRules.overlayActive = true;
      this._rulesLastPath = "logToPage";

      if (this.currentNotebook === this.notebookClues) {
        this.tagClues.startReverseWithFade();
        this.tagClues.overlayActive = true;
        this._cluesLastPath = "pageToBase";
      }

      this.gotoRulesPage();
      this.cluesHiddenOnClues = false;

      if (fromLog) this._playLogEntrance();
      return;
    }

    // LOG (on Clues/Rules)
    if (this._canClickLog() && this.tagLog.hit(mouseX, mouseY)) {
      this._returningToLog = true;
      this._pendingToLogCount = 0;

      this.tagLog.startReverseWithFade();
      this.tagLog.overlayActive = true;
      this._pendingToLogCount++;

      if (this.currentNotebook === this.notebookClues) {
        this.tagClues.startReverseWithFade();
        this.tagClues.overlayActive = true;
        this._cluesLastPath = "pageToLog";
        this._pendingToLogCount++;
      } else if (this.currentNotebook === this.notebookRules) {
        this.tagRules.startReverseWithFade();
        this.tagRules.overlayActive = true;
        this._rulesLastPath = "pageToLog";
        this._pendingToLogCount++;
      }
      return;
    }
  }

  _decToLogAndMaybeSwitch() {
    this._pendingToLogCount = Math.max(0, this._pendingToLogCount - 1);
    if (this._returningToLog && this._pendingToLogCount === 0) {
      this._returningToLog = false;
      this.gotoLogPage();
    }
  }

  _playLogEntrance() {
    this.tagLog.slide.value = 0;
    this.tagLog.startEntrance(); // entrance = start -> end
    this.tagLog.overlayActive = true;
    // this.tagLog.fade.value = 255;
    this.tagLog.startEntrance();
    this.tagLog.overlayActive = true;
  }

  _canClickClues() {
    if (this.currentNotebook === this.notebookLog)
      return !this.tagClues.overlayActive;
    if (this.currentNotebook === this.notebookClues)
      return !this.cluesHiddenOnClues && !this.tagClues.overlayActive;
    if (this.currentNotebook === this.notebookRules)
      return !this.tagClues.overlayActive;
    return true;
  }
  _canClickRules() {
    if (this.currentNotebook === this.notebookLog)
      return !this.tagRules.overlayActive;
    if (this.currentNotebook === this.notebookRules)
      return !this.rulesHiddenOnRules && !this.tagRules.overlayActive;
    if (this.currentNotebook === this.notebookClues)
      return !this.tagRules.overlayActive;
    return true;
  }
  _canClickLog() {
    return (
      this.currentNotebook !== this.notebookLog && !this.tagLog.overlayActive
    );
  }

  // page switches
  gotoCluesPage() {
    this.currentNotebook = this.notebookClues;
  }
  gotoRulesPage() {
    this.currentNotebook = this.notebookRules;
  }
  gotoLogPage() {
    this.currentNotebook = this.notebookLog;
    this.cluesHiddenOnClues = false;
    this.rulesHiddenOnRules = false;
  }

  setQuizState(state) {
    this.quizState = state;
    this.scroll.start(this.yOffset, this.quizState ? height : 0);
  }
}
window.Day0Quiz = Day0Quiz;
