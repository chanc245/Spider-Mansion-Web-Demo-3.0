// public/sketch.js
let audioMgr;
let quiz, logView, dialog;

let showQuizAfterDialog = true;
const QUIZ_AUTO_RETURN_DELAY_MS = 3000;

let tutorial;
let tutorialHasRun = false;

// --- Title/End screens ---
let imgTitle, imgEnd;
let appState = "TITLE"; // "TITLE" | "VN" | "QUIZ" | "END"

// Track notebook/log overlay activation
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

  // --- core scenes ---
  quiz = new Day0Quiz({ nbInDur: 700, nbOutDur: 450 });
  logView = new Day0QuizLog();

  // Dialog uses the audio manager
  dialog = new Dialog({
    audio: audioMgr,
    x: 137,
    y: 396,
    w: 750,
    h: 141,
    boxImageNormal: "assets/ui/ui_diaBox_nor.png",
    boxImageChar: "assets/ui/ui_diaBox_char.png",
    fadeInMs: 400,
    fadeOutMs: 200,
    cgFadeMs: 250,
    bgFadeMs: 300,
    holdBgAfterFinishMs: 150,
    clickSfxPath: "assets/audio/ui_clickDia.mp3",
    clickSfxVolume: 0.3,
  });

  // preload assets for each class
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

  if (typeof vnScript === "undefined") {
    console.warn("vnScript is not defined. Did you include dialog.js?");
  } else {
    dialog.setScript(vnScript);
  }

  dialog.onFinish = () => {
    if (showQuizAfterDialog) {
      quiz.setQuizState(true);
      appState = "QUIZ";
    }
  };

  // GOOD path
  logView.onSolved = () => {
    setTimeout(() => {
      showQuizAfterDialog = false;

      logView.setActive(false, "page");

      const startGoodVN = () => {
        quiz.onScrollEnd = null;
        dialog.setScript(vnScript_postQuiz_Good);

        dialog.onFinish = () => {
          appState = "END";
        };

        appState = "VN";
        dialog.start();
      };

      quiz.onScrollEnd = (state /* false */, yOffset /* ~0 */, visible) => {
        if (state === false) startGoodVN();
      };

      // Trigger the scroll (true -> false)
      quiz.setQuizState(false);
    }, QUIZ_AUTO_RETURN_DELAY_MS);
  };

  // BAD path
  logView.onExhausted = () => {
    setTimeout(() => {
      showQuizAfterDialog = false;
      logView.setActive(false, "page");

      const startBadVN = () => {
        quiz.onScrollEnd = null;
        dialog.setScript(vnScript_postQuiz_Bad);

        dialog.onFinish = () => {
          appState = "END";
        };

        appState = "VN";
        dialog.start();
      };

      quiz.onScrollEnd = (state, yOffset, visible) => {
        if (state === false) startBadVN();
      };

      quiz.setQuizState(false);
    }, QUIZ_AUTO_RETURN_DELAY_MS);
  };

  _prevNotebookReady = quiz.isNotebookShown();
  _prevNotebookImage = quiz.currentNotebook;
}

function draw() {
  // --- High-level state screens first ---
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

  // --- VN layer  ---
  dialog.update();
  dialog.render();

  if (appState === "QUIZ" && !dialog.isActive()) {
    quiz.update();

    // notebook/log overlay logic
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

    // --- Tutorial overlay ---
    if (notebookReady && !tutorialHasRun && !tutorial.active) {
      tutorial.start();
    }
    tutorial.update();
    tutorial.render();
    if (tutorial.done && !tutorialHasRun) {
      tutorialHasRun = true;
    }

    if (tutorial && tutorial.active) {
      logView.input.hide();
    } else if (logView.alpha > 200 && logView._canShowInputThisPage()) {
      logView.input.show();
    }

    _prevNotebookReady = notebookReady;
    _prevNotebookImage = quiz.currentNotebook;
  }
}

function mousePressed() {
  // Title → start INTRO VN
  if (appState === "TITLE") {
    appState = "VN";
    dialog.start();
    return;
  }

  // End screen → (no-op).
  if (appState === "END") {
    return;
  }

  // If tutorial is active, it captures the click
  if (appState === "QUIZ" && tutorial && tutorial.active) {
    tutorial.mousePressed();
    return;
  }

  // While VN is running, clicks advance the dialog only
  if (dialog.isActive()) {
    dialog.mousePressed();
    return;
  }

  // VN is done → normal quiz inputs
  if (appState === "QUIZ") {
    quiz.mousePressed();
    logView.mousePressed();
  }
}

function keyPressed() {
  if (dialog.isActive()) {
    dialog.keyPressed(key);
    return;
  }

  if (appState === "QUIZ") {
    quiz.keyPressed();
  }
}
