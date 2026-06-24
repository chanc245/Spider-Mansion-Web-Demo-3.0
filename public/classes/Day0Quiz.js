class Day0Quiz {
  constructor(opts = {}) {
    // configurable slide durations (ms
    this.nbInDur  = opts.nbInDur  ?? 700; // bottom → visible
    this.nbOutDur = opts.nbOutDur ?? 500; // visible → offscreen
    // per-day background (defaults to day 0 attic)
    this.bgPath = opts.bgPath ?? "assets/quiz/bg_quiz_day0_attic.png";
    // decorative frame drawn on top of the quiz (spider-web corners + vignette)
    this.framePath = opts.framePath ?? "assets/ui/ui_quiz_decor_frame.png";

    // Optional extra left-side page tag (day 1+). When provided, a third
    // bookmark is added below "clues" that opens its own notebook page.
    //   opts.dayTag = { bookmark, page, label?, x?, y?, w?, h? }
    this.dayTagCfg = opts.dayTag ?? null;

    // Optional read-only "day0 notes" recap tag (Day 1+). Renders the saved
    //   Day 0 Q&A text over a notebook page. opts.day0NotesTag = { bookmark, label?, x?, y? }
    this.day0NotesCfg = opts.day0NotesTag ?? null;

    // assets
    this.bg = null;
    this.frameImg = null;
    this.notebookLog = null;
    this.notebookClues = null;
    this.notebookRules = null;
    this.notebookDayTag = null; // optional
    this.notebookDay0Notes = null; // optional — distinct QuestionLog img for text overlay
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
    this.tagDayTag = null; // optional
    this.tagDay0Notes = null; // optional

    // Left-side "page" tags (built in setup()). Each: { tag, page, hidden, lastPath }
    this._pageTags = [];

    // return-to-log coordination
    this._returningToLog = false;
    this._pendingToLogCount = 0;

    this.onScrollEnd = null;
    this._lastScrollActive = false;
  }

  preload() {
    this.bg = loadImage(this.bgPath);
    this.frameImg = loadImage(this.framePath);
    this.notebookLog = loadImage("assets/quiz/notebook_QuestionLog_1.png");
    this.notebookClues = loadImage("assets/quiz/notebook_Clues.png");
    this.notebookRules = loadImage("assets/quiz/notebook_Rules.png");
    this.userFont = loadFont("assets/fonts/BradleyHandITCTT-Bold.ttf");

    this.imgBookmarkClues = loadImage("assets/quiz/bookmark_clues.png");
    this.imgBookmarkRules = loadImage("assets/quiz/bookmark_rules.png");
    this.imgBookmarkLogs = loadImage("assets/quiz/bookmark_logs.png");

    if (this.dayTagCfg) {
      this.imgBookmarkDayTag = loadImage(this.dayTagCfg.bookmark);
      this.notebookDayTag = loadImage(this.dayTagCfg.page);
    }

    if (this.day0NotesCfg) {
      this.imgBookmarkDay0Notes = loadImage(this.day0NotesCfg.bookmark);
      // Its own QuestionLog image instance — a reference distinct from
      // notebookLog so the render layer can tell the recap page apart and
      // overlay the saved Day 0 text (instead of the live Day 1 log).
      this.notebookDay0Notes = loadImage("assets/quiz/notebook_QuestionLog_1.png");
    }
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

    // page tags (left side) in draw/eval order
    this._pageTags = [
      { tag: this.tagClues, page: this.notebookClues, hidden: false, lastPath: null },
      { tag: this.tagRules, page: this.notebookRules, hidden: false, lastPath: null },
    ];

    // optional read-only "day0 notes" recap tab — by default 5px below "clues",
    // i.e. between "clues" and the day tag. Its page is the distinct QuestionLog
    // image so the render layer overlays the saved Day 0 text on it.
    if (this.day0NotesCfg) {
      const cfg = this.day0NotesCfg;
      const w = cfg.w ?? 76;
      const h = cfg.h ?? 38;
      const x = cfg.x ?? 5 + 100 - w; // right-align with clues/rules
      const y = cfg.y ?? 750 + 50 + 5; // clues.y + clues.h + 5
      this.tagDay0Notes = new TagOverlayAnimator({
        label: cfg.label ?? "",
        labelSize: cfg.labelSize ?? 16,
        baseX: x,
        y,
        w,
        h,
        font: this.userFont,
        slideDur: 300,
        aniDirection: "LTR",
        bgImg: this.imgBookmarkDay0Notes,
      });
      this._pageTags.push({
        tag: this.tagDay0Notes,
        page: this.notebookDay0Notes,
        hidden: false,
        lastPath: null,
      });
    }

    // optional day-1+ tag: a third bookmark, by default 5px below "clues"
    if (this.dayTagCfg) {
      const cfg = this.dayTagCfg;
      // "clues" occupies screen-Y [750-height, 750-height + 50]; default 5px under it.
      const w = cfg.w ?? 76;
      const h = cfg.h ?? 38;
      // Right-align with the clues/rules tabs (baseX 5, width 100 → inner edge at
      // x=105) so this narrower tab still meets the notebook's left edge.
      const x = cfg.x ?? 5 + 100 - w;
      const y = cfg.y ?? 750 + 50 + 5; // clues.y + clues.h + 5
      this.tagDayTag = new TagOverlayAnimator({
        label: cfg.label ?? "",
        labelSize: cfg.labelSize ?? 16, // smaller — the day tab is narrower
        baseX: x,
        y,
        w,
        h,
        font: this.userFont,
        slideDur: 300,
        aniDirection: "LTR",
        bgImg: this.imgBookmarkDayTag,
      });
      this._pageTags.push({
        tag: this.tagDayTag,
        page: this.notebookDayTag,
        hidden: false,
        lastPath: null,
      });
    }
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

    // run tag tweens + handle overlay-finish for each left page tag
    for (const pt of this._pageTags) {
      const st = pt.tag.update();
      if (pt.tag.overlayActive && st.done) {
        pt.tag.overlayActive = false;
        if (pt.lastPath === "logToPage") pt.hidden = true;
        else if (pt.lastPath === "pageToLog" && this._returningToLog)
          this._decToLogAndMaybeSwitch();
        pt.lastPath = null;
      }
    }

    // LOG
    const stLog = this.tagLog.update();
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
    const onLog = this.currentNotebook === this.notebookLog;
    if (onLog) {
      // all left page tags are clickable from the log
      for (const pt of this._pageTags) {
        if (!pt.tag.overlayActive) pt.tag.drawClickable();
      }
    } else {
      // on a page: the log tag returns; the page's own tag hides while there
      if (!this.tagLog.overlayActive) this.tagLog.drawClickable();
      for (const pt of this._pageTags) {
        const isOwnPage = this.currentNotebook === pt.page;
        if (isOwnPage) {
          if (!pt.tag.overlayActive && !pt.hidden) pt.tag.drawClickable();
        } else {
          if (!pt.tag.overlayActive) pt.tag.drawClickable();
        }
      }
    }

    // 2) animated overlays
    for (const pt of this._pageTags) {
      if (pt.tag.overlayActive) pt.tag.drawUnder();
    }
    if (this.tagLog.overlayActive) this.tagLog.drawUnder();

    // 3) notebook image (currentNotebook always holds the active page image)
    image(
      this.currentNotebook,
      this.notebookX,
      this.notebookY,
      this.NOTEBOOK_W,
      this.NOTEBOOK_H
    );
    pop();
  }

  // Decorative frame on top of the whole quiz (call after the log text renders
  // so nothing is washed out). Full-screen overlay, like Dialog's _drawFrame.
  renderFrame() {
    if (!this.frameImg) return;
    push();
    image(this.frameImg, 0, 0, width, height);
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

  keyPressed() {}

  mousePressed() {
    // Left page tags (clues / rules / optional day tag)
    for (const pt of this._pageTags) {
      if (!this._canClickPage(pt) || !pt.tag.hit(mouseX, mouseY)) continue;

      const fromLog = this.currentNotebook === this.notebookLog;

      // entrance for the clicked tag
      pt.tag.startEntrance();
      pt.tag.overlayActive = true;
      pt.lastPath = "logToPage";

      // any other page tag whose page is currently shown fades back to base
      for (const other of this._pageTags) {
        if (other === pt) continue;
        if (this.currentNotebook === other.page) {
          other.tag.startReverseWithFade();
          other.tag.overlayActive = true;
          other.lastPath = "pageToBase";
        }
      }

      this.currentNotebook = pt.page;

      // others are no longer on their own page → un-hide them
      for (const other of this._pageTags) {
        if (other !== pt) other.hidden = false;
      }

      if (fromLog) this._playLogEntrance();
      return;
    }

    // LOG (on a page) → return to log
    if (this._canClickLog() && this.tagLog.hit(mouseX, mouseY)) {
      this._returningToLog = true;
      this._pendingToLogCount = 0;

      this.tagLog.startReverseWithFade();
      this.tagLog.overlayActive = true;
      this._pendingToLogCount++;

      for (const pt of this._pageTags) {
        if (this.currentNotebook === pt.page) {
          pt.tag.startReverseWithFade();
          pt.tag.overlayActive = true;
          pt.lastPath = "pageToLog";
          this._pendingToLogCount++;
        }
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
  }

  _canClickPage(pt) {
    if (this.currentNotebook === this.notebookLog)
      return !pt.tag.overlayActive;
    if (this.currentNotebook === pt.page)
      return !pt.hidden && !pt.tag.overlayActive;
    // on a different page
    return !pt.tag.overlayActive;
  }

  _canClickLog() {
    return (
      this.currentNotebook !== this.notebookLog && !this.tagLog.overlayActive
    );
  }

  // page switches
  gotoLogPage() {
    this.currentNotebook = this.notebookLog;
    for (const pt of this._pageTags) pt.hidden = false;
  }

  setQuizState(state) {
    this.quizState = state;
    this.scroll.start(this.yOffset, this.quizState ? height : 0);
  }
}
window.Day0Quiz = Day0Quiz;
