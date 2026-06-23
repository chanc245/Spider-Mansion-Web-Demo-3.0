// public/sketch.js
let audioMgr;
let quiz, logView, dialog;

// ── State managers (Day 1+) ───────────────────────────────────────
let pa_investigateMgr,
  dia_optionMgr,
  pa_gameMgr,
  pa_dinnerMgr,
  pr_musicSearchMgr;

let showQuizAfterDialog = true;

let tutorial;
let tutorialHasRun = false;

// --- Title/End screens ---
let imgTitle, imgEnd;

// appState controls which system owns the screen each frame.
// Prefixes: PA_ = daytime  |  PR_ = nighttime  |  DIA_ = dialogue overlay (any time)
//
// "TITLE"            — title screen, waiting for first click
// "DIA_VN"           — visual novel / dialogue running
// "PR_QUIZ"          — night: Eva Q&A notebook
// "PA_INVESTIGATE"   — day: player clicks all items in a room (required, no early exit)
// "DIA_OPTION"       — any: dialogue branch with 2-4 choices, rejoins DIA_VN after
// "PA_GAME"          — day: mini-game placeholder
// "PA_DINNER"        — day: dinner scene, click characters (per-day config), tray to leave
// "PR_MUSIC_SEARCH"  — night: player searches rooms for Eva before quiz
// "END"              — end screen
let appState = "TITLE";

// Track notebook/log overlay activation (Day 0)
let _prevNotebookReady = false;
let _prevNotebookImage = null;

function preload() {
  // --- tutorial images ---
  tutorial = new TutorialOverlay({
    imagePaths: [
      "assets/tutorial/tut_1.png",
      "assets/tutorial/tut_2.png",
      "assets/tutorial/tut_3.png",
      "assets/tutorial/tut_4.png",
      "assets/tutorial/tut_5.png",
      "assets/tutorial/tut_6.png",
      "assets/tutorial/tut_7.png",
      "assets/tutorial/tut_8.png",
    ],
    fadeOutMs: 450,
  });
  tutorial.preload();

  // --- title/end images ---
  imgTitle = loadImage("assets/cg_titlePage.png");
  imgEnd = loadImage("assets/cg_endPage.png");

  // --- audio manager ---
  audioMgr = new AudioManager({ masterVolume: 1 });
  audioMgr.load("assets/audio/bg_ara.mp3", { loop: true, volume: 0.3 });
  audioMgr.load("assets/audio/dia_step.mp3");
  audioMgr.load("assets/audio/ui_clickDia.mp3", { volume: 0.5 });

  // --- Day 0 scenes ---
  quiz = new Day0Quiz({ nbInDur: 700, nbOutDur: 450 });
  logView = new Day0QuizLog();

  dialog = new Dialog({
    audio: audioMgr,
    x: 137,
    y: 396,
    w: 750,
    h: 141,
    diaAudioDir: "assets/dia_audio",
    fadeInMs: 400,
    fadeOutMs: 200,
    cgFadeMs: 250,
    bgFadeMs: 300,
    holdBgAfterFinishMs: 150,
    clickSfxPath: "assets/audio/ui_clickDia.mp3",
    clickSfxVolume: 0.3,
    diaAudioVolume: 0.3,
  });

  // --- State managers (Day 1+) ---
  pa_investigateMgr = new PA_InvestigateManager();
  dia_optionMgr = new DIA_OptionManager();
  pa_gameMgr = new PA_GameManager();
  pa_dinnerMgr = new PA_DinnerManager();
  pr_musicSearchMgr = new PR_MusicSearchManager();

  // preload assets
  quiz.preload();
  logView.preload();
  dialog.preload();
}

function setup() {
  const cnv = createCanvas(1024, 576);
  cnv.parent("canvas-container");

  quiz.setup();
  logView.setup();
  quiz.setQuizState(false);

  if (typeof d0_vnScript === "undefined") {
    console.warn(
      "d0_vnScript is not defined. Did you include dialogScript.js?",
    );
  } else {
    dialog.setScript(d0_vnScript);
  }

  // ── Day 0 VN → QUIZ ─────────────────────────────────────────────
  dialog.onFinish = () => {
    if (showQuizAfterDialog) {
      quiz.setQuizState(true);
      appState = "PR_QUIZ";
    }
  };

  // ── Day 0 GOOD ending ───────────────────────────────────────────
  logView.onSolved = () => {
    showQuizAfterDialog = false;
    logView.setActive(false, "page");

    const startGoodVN = () => {
      quiz.onScrollEnd = null;
      dialog.setScript(d0_vnScript_postQuiz_Good);
      dialog.onFinish = () => {
        appState = "END";
      };
      appState = "DIA_VN";
      dialog.start();
    };

    quiz.onScrollEnd = (state) => {
      if (state === false) startGoodVN();
    };
    quiz.setQuizState(false);
  };

  // ── Day 0 BAD ending ────────────────────────────────────────────
  logView.onExhausted = () => {
    showQuizAfterDialog = false;
    logView.setActive(false, "page");

    const startBadVN = () => {
      quiz.onScrollEnd = null;
      dialog.setScript(d0_vnScript_postQuiz_Bad);
      dialog.onFinish = () => {
        appState = "END";
      };
      appState = "DIA_VN";
      dialog.start();
    };

    quiz.onScrollEnd = (state) => {
      if (state === false) startBadVN();
    };
    quiz.setQuizState(false);
  };

  _prevNotebookReady = quiz.isNotebookShown();
  _prevNotebookImage = quiz.currentNotebook;
}

// ─────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────
function draw() {
  // ── Static screens ──────────────────────────────────────────────
  if (appState === "TITLE") {
    background(0);
    if (imgTitle) image(imgTitle, 0, 0, 1024, 576);
    return;
  }

  if (appState === "END") {
    background(0);
    if (imgEnd) image(imgEnd, 0, 0, 1024, 576);
    return;
  }

  // ── VN layer (always drawn as backdrop for overlay states) ───────
  dialog.update();
  dialog.render();

  // ── Day 0 QUIZ ───────────────────────────────────────────────────
  if (appState === "PR_QUIZ" && !dialog.isActive()) {
    quiz.update();

    const notebookReady = quiz.isNotebookShown();
    const onLogPage = quiz.currentNotebook === quiz.notebookLog;
    const shouldBeActive = notebookReady && onLogPage;

    let profile = null;
    if (notebookReady !== _prevNotebookReady) profile = "move";
    else if (notebookReady && quiz.currentNotebook !== _prevNotebookImage)
      profile = "page";

    if (profile) logView.setActive(shouldBeActive, profile);
    else if (shouldBeActive !== logView.active)
      logView.setActive(shouldBeActive, "page");

    logView.render(quiz.notebookX, quiz.notebookY);

    if (notebookReady && !tutorialHasRun && !tutorial.active) tutorial.start();
    tutorial.update();
    tutorial.render();
    if (tutorial.done && !tutorialHasRun) tutorialHasRun = true;

    if (tutorial && tutorial.active) {
      logView.input.hide();
    } else if (logView.alpha > 200 && logView._canShowInputThisPage()) {
      logView.input.show();
    }

    _prevNotebookReady = notebookReady;
    _prevNotebookImage = quiz.currentNotebook;
  }

  // ── INVESTIGATE ─────────────────────────────────────────────────
  if (appState === "PA_INVESTIGATE") {
    pa_investigateMgr.update();
    pa_investigateMgr.render();
  }

  // ── OPTION ──────────────────────────────────────────────────────
  if (appState === "DIA_OPTION") {
    dia_optionMgr.update();
    dia_optionMgr.render();
  }

  // ── GAME ────────────────────────────────────────────────────────
  if (appState === "PA_GAME") {
    pa_gameMgr.update();
    pa_gameMgr.render();
  }

  // ── DINNER ──────────────────────────────────────────────────────
  if (appState === "PA_DINNER") {
    pa_dinnerMgr.update();
    pa_dinnerMgr.render();
  }

  // ── NIGHT_SEARCH ────────────────────────────────────────────────
  if (appState === "PR_MUSIC_SEARCH") {
    pr_musicSearchMgr.update();
    pr_musicSearchMgr.render();
  }
}

// ─────────────────────────────────────────────────────────────────
// HELPERS — start a state and wire its onFinish back to VN
// ─────────────────────────────────────────────────────────────────

// Start an INVESTIGATE block, resume VN when done.
function startPA_Investigate(opts, nextScript) {
  appState = "PA_INVESTIGATE";
  pa_investigateMgr.onFinish = () => {
    appState = "DIA_VN";
    if (nextScript) {
      dialog.setScript(nextScript);
      dialog.start();
    }
  };
  pa_investigateMgr.start(opts);
}

// Start an OPTION block, resume VN when done.
function startDIA_Option(opts, nextScript) {
  appState = "DIA_OPTION";
  dia_optionMgr.onFinish = () => {
    appState = "DIA_VN";
    if (nextScript) {
      dialog.setScript(nextScript);
      dialog.start();
    }
  };
  dia_optionMgr.start(opts);
}

// Start a GAME, resume VN when done.
function startPA_Game(opts, nextScript) {
  appState = "PA_GAME";
  pa_gameMgr.onFinish = () => {
    appState = "DIA_VN";
    if (nextScript) {
      dialog.setScript(nextScript);
      dialog.start();
    }
  };
  pa_gameMgr.start(opts);
}

// Start DINNER, resume VN when done.
function startPA_Dinner(opts, nextScript) {
  appState = "PA_DINNER";
  pa_dinnerMgr.onFinish = () => {
    appState = "DIA_VN";
    if (nextScript) {
      dialog.setScript(nextScript);
      dialog.start();
    }
  };
  pa_dinnerMgr.start(opts);
}

// Start NIGHT_SEARCH, resume VN when correct room found.
function startPR_MusicSearch(opts, nextScript) {
  appState = "PR_MUSIC_SEARCH";
  pr_musicSearchMgr.onFound = () => {
    appState = "DIA_VN";
    if (nextScript) {
      dialog.setScript(nextScript);
      dialog.start();
    }
  };
  pr_musicSearchMgr.start(opts);
}

// ─────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────
function mousePressed() {
  if (!dialog || !quiz || !logView) return; // guard: not yet initialised

  if (appState === "TITLE") {
    appState = "DIA_VN";
    dialog.start();
    return;
  }

  if (appState === "END") return;

  // State managers handle their own clicks first
  if (appState === "PA_INVESTIGATE") {
    pa_investigateMgr.mousePressed();
    return;
  }
  if (appState === "DIA_OPTION") {
    dia_optionMgr.mousePressed();
    return;
  }
  if (appState === "PA_GAME") {
    pa_gameMgr.mousePressed();
    return;
  }
  if (appState === "PA_DINNER") {
    pa_dinnerMgr.mousePressed();
    return;
  }
  if (appState === "PR_MUSIC_SEARCH") {
    pr_musicSearchMgr.mousePressed();
    return;
  }

  if (appState === "PR_QUIZ" && tutorial && tutorial.active) {
    tutorial.mousePressed();
    return;
  }

  if (dialog.isActive()) {
    dialog.mousePressed();
    return;
  }

  if (appState === "PR_QUIZ") {
    quiz.mousePressed();
    logView.mousePressed();
  }
}

function keyPressed() {
  if (!dialog || !quiz || !logView) return; // guard: not yet initialised

  // State managers don't use keyboard — VN and QUIZ do
  if (
    appState === "PA_INVESTIGATE" ||
    appState === "DIA_OPTION" ||
    appState === "PA_GAME" ||
    appState === "PA_DINNER" ||
    appState === "PR_MUSIC_SEARCH"
  )
    return;

  if (dialog.isActive()) {
    dialog.keyPressed(key);
    return;
  }

  if (appState === "PR_QUIZ") quiz.keyPressed();
}
