// public/sketch.js
let audioMgr;
let quiz, logView, dialog;

// ── Day 1 quiz instances ─────────────────────────────────────────
let quiz1, logView1;
// Read-only viewer for the saved Day 0 Q&A, shown on the "day0 notes" tab.
let logViewDay0Notes;

// ── State managers (Day 1+) ───────────────────────────────────────
let pa_investigateMgr,
  dia_optionMgr,
  pa_gameMgr,
  pa_dinnerMgr,
  pr_musicSearchMgr,
  pa_webInvestigateMgr;

// Active quiz pointers — swapped between day0 and day1 instances
let _activeQuiz, _activeLogView;
let _prevNotebookReady = false;
let _prevNotebookImage = null;

let showQuizAfterDialog = true;

// Day 0 pre-quiz tutorial overlay (full-screen image carousel, runs once).
let tutorial;
let tutorialHasRun = false;

// --- Title/End screens ---
let imgTitle, imgEnd;

// appState controls which system owns the screen each frame.
// Prefixes: PA_ = daytime  |  PR_ = nighttime  |  DIA_ = dialogue overlay (any time)
//
// "TITLE"              — title screen, waiting for first click
// "DIA_VN"             — visual novel / dialogue running
// "PR_QUIZ"            — night: Eva/Ara Q&A notebook
// "PA_INVESTIGATE"     — day: player clicks all items in a room
// "DIA_OPTION"         — any: dialogue branch with 2-4 choices, rejoins DIA_VN after
// "PA_GAME"            — day: mini-game placeholder
// "PA_DINNER"          — day: dinner scene (legacy manager, unused for Day 1)
// "PR_MUSIC_SEARCH"    — night: player searches rooms for music source
// "PA_WEB_INVESTIGATE" — day: spider-web investigation overlay
// "END"                — end screen
const State = Object.freeze({
  TITLE:              "TITLE",
  DIA_VN:             "DIA_VN",
  PR_QUIZ:            "PR_QUIZ",
  PA_INVESTIGATE:     "PA_INVESTIGATE",
  DIA_OPTION:         "DIA_OPTION",
  PA_GAME:            "PA_GAME",
  PA_DINNER:          "PA_DINNER",
  PR_MUSIC_SEARCH:    "PR_MUSIC_SEARCH",
  PA_WEB_INVESTIGATE: "PA_WEB_INVESTIGATE",
  END:                "END",
});
let appState = State.TITLE;

// Scene managers that own the screen for a given appState. Built in setup()
// (after preload constructs the managers). One table drives draw / mousePressed
// / keyPressed so the three dispatch sites can't drift out of sync.
let SCENES = {};

// ─────────────────────────────────────────────────────────────────
// PRELOAD
// ─────────────────────────────────────────────────────────────────
function preload() {
  // Day 0 pre-quiz tutorial — 8 instructional images, clicked through.
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

  imgTitle = loadImage("assets/cg/title/cg_titlePage.png");
  imgEnd   = loadImage("assets/cg/title/cg_endPage.png");

  audioMgr = new AudioManager({ masterVolume: 1 });
  // The two BGM tracks are mutually exclusive — only one plays at a time.
  audioMgr.load("assets/audio/bgm/bg_ara.mp3", { loop: true, volume: 0.3, exclusive: true });
  // Day 1 music box — looping BGM for the night music search + the quiz.
  audioMgr.load("assets/audio/bgm/bg_ara_short.mp3", { loop: true, volume: 0.3, exclusive: true });
  // Day 1 quiz reading — Eva/Ara reads the puzzle aloud when the quiz opens.
  // Same volume (0.3) as the other voiceovers + BGM.
  audioMgr.load("assets/audio/voice/d1_dia/d1_dia_quizRead.mp3", { volume: 0.3 });
  audioMgr.load("assets/audio/sfx/dia_step.mp3");
  audioMgr.load("assets/audio/ui/ui_clickDia.mp3", { volume: 0.5 });

  // Day 0
  quiz    = new QuizNotebook({ nbInDur: 700, nbOutDur: 450 });
  logView = new QuizLog("day0");

  // Day 1 quiz (same notebook UI, different bg + puzzle)
  quiz1    = new QuizNotebook({
    nbInDur:  700,
    nbOutDur: 450,
    bgPath: "assets/quiz/bg_quiz_day1_dinningRoom.png",
    // Read-only "day0 logs" recap tab — on the RIGHT side, low and clear of the
    // "log" tab. Shows whatever the player wrote in the Day 0 puzzle (localStorage).
    day0NotesTag: {
      bookmark: "assets/quiz/bookmark_dayTag.png", // reuse (mirrored) art for now
      label:    "day0\nlogs",
    },
    // Day-1-only extra bookmark: "day 1 kitchen" → opens notebook_clue_d1.png.
    // Uses the same clues bookmark art (76×83) as the "day 0 clues" tab and sits
    // 5px below it (default position handled in QuizNotebook).
    dayTag: {
      bookmark: "assets/quiz/bookmark_clues.png",
      page:     "assets/quiz/notebook_clue_d1.png",
      label:    "day 1\nkitchen", // two lines to fit the narrow tab
    },
  });
  logView1 = new QuizLog("day1");
  // Read-only recap of the Day 0 log (no Eva, no input).
  logViewDay0Notes = new QuizLog("day0Notes", { readOnly: true });

  _activeQuiz    = quiz;
  _activeLogView = logView;

  dialog = new Dialog({
    audio: audioMgr,
    x: 137, y: 396, w: 750, h: 141,
    diaAudioDir:         "assets/audio/voice",
    fadeInMs:             400,
    fadeOutMs:            200,
    cgFadeMs:             250,
    bgFadeMs:             300,
    holdBgAfterFinishMs:  150,
    clickSfxPath:         "assets/audio/ui/ui_clickDia.mp3",
    clickSfxVolume:       0.3,
    diaAudioVolume:       0.3,
  });

  pa_investigateMgr    = new PA_InvestigateManager();
  dia_optionMgr        = new DIA_OptionManager();
  pa_gameMgr           = new PA_GameManager();
  pa_dinnerMgr         = new PA_DinnerManager();
  pr_musicSearchMgr    = new PR_MusicSearchManager();
  pa_webInvestigateMgr = new PA_WebInvestigateManager();

  // Mini-game assets (kitchen catch game)
  pa_gameMgr.preload();

  // Dinner picker — portraits (normal + dim), bg, and its UI chrome.
  pa_dinnerMgr.preload(
    typeof d1_dinner_characters !== "undefined" ? d1_dinner_characters : [],
  );

  // Preload investigation assets (bg + any overlay art per config)
  pa_webInvestigateMgr.preload(D1_KITCHEN_WEB_CONFIG);
  pa_webInvestigateMgr.preload(D1_ATTIC_WEB_CONFIG);

  // ── Wire DIA_OPTION into the VN ───────────────────────────────
  // Options with a branchId are routed manually; plain options resume the script.
  dialog.onOption = (optConfig) => {
    // Default: resume from next script line after option resolves.
    // Pass the chosen option's text so it's spliced in as a narration line
    // (the "option result text" feature) — without it, plain options like the
    // kitchen converge choices would silently drop their result text.
    appState = State.DIA_OPTION;
    dia_optionMgr.onFinish = (chosenText) => {
      appState = State.DIA_VN;
      dialog.resumeFromOption(chosenText ?? null);
    };
    dia_optionMgr.start(optConfig);
  };

  quiz.preload();
  logView.preload();
  quiz1.preload();
  logView1.preload();
  logViewDay0Notes.preload();
  dialog.preload();
  dia_optionMgr.preload();
  // Music search — preload every room bg the picker can show, so switching rooms
  // doesn't flash black while the option manager lazy-loads an uncached image.
  dia_optionMgr.preloadBg("assets/bg/bg_pr_ug_room1_Nanny.png");   // start (your room)
  dia_optionMgr.preloadBg("assets/bg/bg_pa_1f_Kitchen.png");       // Kitchen
  dia_optionMgr.preloadBg("assets/bg/bg_pr_3f_Attic.png");         // Attic
  dia_optionMgr.preloadBg("assets/bg/bg_pr_1f_Dining.png");        // Dining Room
  dia_optionMgr.preloadBg("assets/bg/bg_pr_1f_PortraitHallway.png"); // Portrait Hallway
}

// ─────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────
function setup() {
  const cnv = createCanvas(1024, 576);
  cnv.parent("canvas-container");

  quiz.setup();
  logView.setup();
  quiz1.setup();
  logView1.setup();
  logViewDay0Notes.setup();
  quiz.setQuizState(false);
  quiz1.setQuizState(false);

  if (typeof d0_vnScript === "undefined") {
    console.warn("d0_vnScript is not defined. Did you include d0_DialogScript.js?");
  } else {
    dialog.setScript(d0_vnScript);
  }

  // ── Day 0: VN → quiz ────────────────────────────────────────────
  dialog.onFinish = () => {
    if (showQuizAfterDialog) {
      _activeQuiz    = quiz;
      _activeLogView = logView;
      quiz.setQuizState(true);
      appState = State.PR_QUIZ;
    }
  };

  // ── Day 0 good ending ────────────────────────────────────────────
  logView.onSolved = () => {
    showQuizAfterDialog = false;
    logView.setActive(false, "page");
    const startGoodVN = () => {
      quiz.onScrollEnd = null;
      dialog.setScript(d0_vnScript_postQuiz_Good);
      // Day 0 flows straight into Day 1 with no end screen and no black flash:
      // the last line cross-dissolves into Day 1's opening (which is on black).
      // After the morning, continue to the kitchen.
      dialog.onFinish = () => startD1Kitchen();
      dialog.queueNext(d1_vnScript_morning);
      appState = State.DIA_VN;
      dialog.start();
    };
    quiz.onScrollEnd = (state) => { if (state === false) startGoodVN(); };
    quiz.setQuizState(false);
  };

  // ── Day 0 bad ending ─────────────────────────────────────────────
  logView.onExhausted = () => {
    showQuizAfterDialog = false;
    logView.setActive(false, "page");
    const startBadVN = () => {
      quiz.onScrollEnd = null;
      dialog.setScript(d0_vnScript_postQuiz_Bad);
      // Day 0 flows straight into Day 1 (no end screen, no black flash).
      // After the morning, continue to the kitchen.
      dialog.onFinish = () => startD1Kitchen();
      dialog.queueNext(d1_vnScript_morning);
      appState = State.DIA_VN;
      dialog.start();
    };
    quiz.onScrollEnd = (state) => { if (state === false) startBadVN(); };
    quiz.setQuizState(false);
  };

  // ── Day 1 quiz outcomes ──────────────────────────────────────────
  logView1.onSolved = () => {
    logView1.setActive(false, "page");
    quiz1.onScrollEnd = (state) => {
      if (state === false) {
        quiz1.onScrollEnd = null;
        startD1NightPostQuiz("good");
      }
    };
    quiz1.setQuizState(false);
  };

  // Exhaustion on Day 1 also leads to post-quiz (Ara lets it pass), but the
  // opening dialogue is slightly different — colder. (Mirrors d0 Good/Bad.)
  logView1.onExhausted = () => {
    logView1.setActive(false, "page");
    quiz1.onScrollEnd = (state) => {
      if (state === false) {
        quiz1.onScrollEnd = null;
        startD1NightPostQuiz("bad");
      }
    };
    quiz1.setQuizState(false);
  };

  _prevNotebookReady = quiz.isNotebookShown();
  _prevNotebookImage = quiz.currentNotebook;

  // appState → manager that owns the screen (and clicks/keys) for that state.
  SCENES = {
    [State.PA_INVESTIGATE]:     pa_investigateMgr,
    [State.DIA_OPTION]:         dia_optionMgr,
    [State.PA_GAME]:            pa_gameMgr,
    [State.PA_DINNER]:          pa_dinnerMgr,
    [State.PR_MUSIC_SEARCH]:    pr_musicSearchMgr,
    [State.PA_WEB_INVESTIGATE]: pa_webInvestigateMgr,
  };
}

// ─────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────
function draw() {
  if (appState === State.TITLE) {
    background(0);
    if (imgTitle) image(imgTitle, 0, 0, 1024, 576);
    return;
  }

  if (appState === State.END) {
    background(0);
    if (imgEnd) image(imgEnd, 0, 0, 1024, 576);
    return;
  }

  // Clear each frame so the semi-transparent frame draws exactly once
  // (otherwise it compounds on the un-cleared canvas and looks doubled).
  background(0);

  // VN layer — always drawn as backdrop
  // During DIA_OPTION, only render the bg so the option UI owns the screen.
  dialog.suppressUi = (appState === State.DIA_OPTION);
  dialog.update();
  dialog.render();

  // ── Quiz (day 0 and day 1 share this path via _activeQuiz) ──────
  if (appState === State.PR_QUIZ && !dialog.isActive()) {
    _activeQuiz.update();

    const notebookReady  = _activeQuiz.isNotebookShown();
    const onLogPage      = _activeQuiz.currentNotebook === _activeQuiz.notebookLog;
    const shouldBeActive = notebookReady && onLogPage;

    let profile = null;
    if (notebookReady !== _prevNotebookReady) profile = "move";
    else if (notebookReady && _activeQuiz.currentNotebook !== _prevNotebookImage)
      profile = "page";

    if (profile) _activeLogView.setActive(shouldBeActive, profile);
    else if (shouldBeActive !== _activeLogView.active)
      _activeLogView.setActive(shouldBeActive, "page");

    _activeLogView.render(_activeQuiz.notebookX, _activeQuiz.notebookY);

    // Tutorial only runs on Day 0, before the quiz Q&A begins.
    if (
      _activeQuiz === quiz &&
      notebookReady &&
      !tutorialHasRun &&
      !tutorial.active
    ) {
      tutorial.start();
    }
    const tutorialActive = _activeQuiz === quiz && tutorial.active;

    if (tutorialActive) {
      _activeLogView.input.hide();
    } else if (
      _activeLogView.alpha > 200 &&
      _activeLogView._canShowInputThisPage()
    ) {
      _activeLogView.input.show();
    }

    // Read-only Day 0 notes recap page (Day 1 quiz only): overlay the saved
    // Day 0 Q&A when that tab's page is open.
    const onDay0NotesPage =
      _activeQuiz.notebookDay0Notes &&
      _activeQuiz.currentNotebook === _activeQuiz.notebookDay0Notes;
    if (onDay0NotesPage && notebookReady) {
      if (!logViewDay0Notes.active) logViewDay0Notes.setActive(true, "page");
      logViewDay0Notes.render(_activeQuiz.notebookX, _activeQuiz.notebookY);
    } else if (logViewDay0Notes.active) {
      logViewDay0Notes.setActive(false, "page");
    }

    // Decorative frame on top of everything (bg + notebook + log text)
    _activeQuiz.renderFrame();

    // Tutorial overlay sits on top of everything (Day 0 only).
    if (_activeQuiz === quiz) {
      tutorial.update();
      tutorial.render();
      if (tutorial.done && !tutorialHasRun) tutorialHasRun = true;
    }

    _prevNotebookReady = notebookReady;
    _prevNotebookImage = _activeQuiz.currentNotebook;
  }

  // Manager-owned scenes (investigate / option / game / dinner / music / web).
  const scene = SCENES[appState];
  if (scene) {
    scene.update();
    scene.render();
  }
}

// ─────────────────────────────────────────────────────────────────
// DAY 1 FLOW — each function hands off to the next via callbacks
// ─────────────────────────────────────────────────────────────────

function startDay1() {
  showQuizAfterDialog = false;
  appState = State.DIA_VN;
  dialog.setScript(d1_vnScript_morning);
  dialog.onFinish = () => startD1Kitchen(); // morning → straight to the kitchen
  dialog.start();
}

function startD1Kitchen() {
  appState = State.DIA_VN;
  dialog.setScript(d1_vnScript_kitchen);
  dialog.onFinish = () => startPA_Game({ id: "ingredients" }, null, startD1PostCook);
  dialog.start();
}

// Short dialogue after the kitchen mini-game, then into lunch.
function startD1PostCook() {
  appState = State.DIA_VN;
  dialog.setScript(d1_vnScript_postCook);
  dialog.onFinish = () => startD1Lunch();
  dialog.start();
}

function startD1Lunch() {
  appState = State.DIA_VN;
  dialog.setScript(d1_vnScript_lunch);
  dialog.onFinish = () => startD1Afternoon();
  dialog.start();
}

function startD1Afternoon() {
  appState = State.DIA_VN;
  dialog.setScript(d1_vnScript_afternoon_pre);
  dialog.onFinish = () => startD1KitchenInvestigate();
  dialog.start();
}

function startD1KitchenInvestigate() {
  startPA_WebInvestigate(D1_KITCHEN_WEB_CONFIG, () => {
    appState = State.DIA_VN;
    dialog.setScript(d1_vnScript_afternoon_post);
    dialog.onFinish = () => startD1Dinner();
    dialog.start();
  });
}

function startD1Dinner() {
  // Reset per-character "talked" flags so replaying the dinner (incl. debug
  // re-entry) starts with no ✓ marks — the flags live on the shared script data.
  if (typeof d1_dinner_characters !== "undefined")
    d1_dinner_characters.forEach((c) => { c._talked = false; });
  appState = State.DIA_VN;
  dialog.setScript(d1_vnScript_dinner_pre);
  dialog.onFinish = () => startD1DinnerOptions();
  dialog.start();
}

// Dinner loop — image-based picker (PA_DINNER): standing portraits over the
// dining-room bg. Clicking a portrait plays that character's dialogue and
// loops back; "return to position" ends the dinner.
function startD1DinnerOptions() {
  const chars = typeof d1_dinner_characters !== "undefined" ? d1_dinner_characters : [];

  appState = State.PA_DINNER;
  pa_dinnerMgr.onPick = (ch) => {
    // Talk to this character, then loop back
    ch._talked = true;
    appState = State.DIA_VN;
    dialog.setScript(ch.script);
    dialog.onFinish = () => startD1DinnerOptions();
    dialog.start();
  };
  pa_dinnerMgr.onFinish = () => {
    // Player leaves dinner
    appState = State.DIA_VN;
    dialog.setScript(d1_vnScript_dinner_post);
    dialog.onFinish = () => startD1Night();
    dialog.start();
  };
  pa_dinnerMgr.start({ characters: chars, bg: "assets/bg/bg_pa_1f_Dining.png" });
}

function startD1Night() {
  appState = State.DIA_VN;
  dialog.setScript(d1_vnScript_night_pre);
  dialog.onFinish = () => startD1MusicSearch();
  dialog.start();
}

// Music search — presented as a DIA_OPTION (spider-web tags), looping until the
// correct room is chosen. Wrong picks show their result in the VN dialogue box,
// then re-offer the rooms.
function startD1MusicSearch(currentBg) {
  // The search starts in the nanny's room; afterwards the background stays on
  // whichever room the player last stepped into (passed back as currentBg).
  const START_BG   = "assets/bg/bg_pr_ug_room1_Nanny.png";
  const STEP_SFX    = "assets/audio/sfx/dia_step.mp3";
  const WRONG_TEXT  = "I don’t think the sound is coming from here.";
  // The faint music box (SEARCH_BGM) plays throughout the search; its volume
  // tracks how close the current room is to the source. Reference levels:
  //   Start (nanny's room, normal) ... 30%   (START_LEVEL)
  //   Kitchen ......................... 40%
  //   Attic ........................... 10%
  //   Portrait Hallway ................ 60%
  //   Dining Room (correct) ........... swaps to FOUND_BGM (full song) at 100%
  // To retune, edit START_LEVEL and each room's `level` in the rooms[] table below.
  const SEARCH_BGM  = "assets/audio/bgm/bg_ara_short.mp3";
  const FOUND_BGM   = "assets/audio/bgm/bg_ara.mp3";
  const START_LEVEL = 0.3;
  const bg = currentBg || START_BG;
  // NOTE: no night (pr) kitchen art exists, so Kitchen uses the daytime bg.
  const rooms = [
    { label: "Kitchen",          bg: "assets/bg/bg_pa_1f_Kitchen.png",         correct: false, level: 0.4,
      wrongText: "I think I’m getting closer to where the music is coming from." },
    { label: "Attic",            bg: "assets/bg/bg_pr_3f_Attic.png",           correct: false, level: 0.1 },
    { label: "Dining Room",      bg: "assets/bg/bg_pr_1f_Dining.png",          correct: true  },
    { label: "Portrait Hallway", bg: "assets/bg/bg_pr_1f_PortraitHallway.png", correct: false, level: 0.6,
      wrongText: "I think I’m getting very close to where the music is coming from." },
  ];

  // Start (or re-tune) the music box at the level of whichever room we're in.
  const curRoom = rooms.find((r) => r.bg === bg);
  const level = curRoom ? (curRoom.level ?? START_LEVEL) : START_LEVEL;
  if (audioMgr.isPlaying(SEARCH_BGM)) {
    audioMgr.setVolume(SEARCH_BGM, level);
  } else {
    audioMgr.play(SEARCH_BGM, { loop: true, volume: level, from: 0 });
  }

  appState = State.DIA_OPTION;
  dia_optionMgr.onFinish = (_text, idx) => {
    const room = rooms[idx];
    if (!room) return;
    // Footsteps as you walk into the chosen room.
    audioMgr.play(STEP_SFX, { from: 0 });
    if (room.correct) {
      // Found the source — swap the faint music box for the full song.
      audioMgr.play(FOUND_BGM, { loop: true, volume: 1, from: 0 });
      startD1NightDining();
    } else {
      // Stepping into the wrong room: the music box fades with distance.
      audioMgr.setVolume(SEARCH_BGM, room.level ?? START_LEVEL);
      // Wrong room: show that room's bg + result, then re-offer the rooms while
      // keeping the background on the room the player just entered.
      appState = State.DIA_VN;
      dialog.setScript([
        { charName: " ", bg: room.bg, text: room.wrongText || WRONG_TEXT },
      ]);
      dialog.onFinish = () => startD1MusicSearch(room.bg);
      dialog.start();
    }
  };
  dia_optionMgr.start({
    choices: rooms.map((r) => ({ label: r.label, text: r.label })),
    bg,
    prompt: "Where is the sound coming from?",
  });
}

function startD1NightDining() {
  appState = State.DIA_VN;
  dialog.setScript(d1_vnScript_night_dining);
  dialog.onFinish = () => startD1Quiz();
  dialog.start();
}

function startD1Quiz() {
  // Defensive: kill any running VN + the day-0 quiz hand-off so a stale
  // dialog.onFinish can't swap us back to the day-0 quiz (the bug seen when
  // jumping here via debug while the title VN was still active).
  showQuizAfterDialog = false;
  dialog.stop();

  _activeQuiz    = quiz1;
  _activeLogView = logView1;

  // Pick up Day 0 notes written earlier this session (no refresh needed).
  logViewDay0Notes.reloadFromStorage();

  // Start from a clean slate so the intro always plays the same way, even on
  // debug re-entry: notebook on the Log page, bg scrolled to the TOP so it
  // slides down to the bottom when the quiz opens (matches Day 0).
  quiz1.gotoLogPage();
  quiz1.yOffset = 0;
  quiz1.nbT = 0;
  quiz1.nbSlide.start(0, 0);

  _prevNotebookReady = quiz1.isNotebookShown();
  _prevNotebookImage = quiz1.currentNotebook;
  quiz1.setQuizState(true);   // scrolls 0 → height, sliding the bg down
  appState = State.PR_QUIZ;

  // Music box resumes (looping) under Eva/Ara reading the puzzle aloud.
  audioMgr.play("assets/audio/bgm/bg_ara_short.mp3", { loop: true, volume: 0.3, from: 0 });
  audioMgr.play("assets/audio/voice/d1_dia/d1_dia_quizRead.mp3", { volume: 0.3, from: 0 });

  // If the player submits before the reading finishes, stop it so it doesn't
  // play over Eva's spoken response.
  logView1.onPlayerSubmit = () => {
    audioMgr.stop("assets/audio/voice/d1_dia/d1_dia_quizRead.mp3", { fadeMs: 200 });
  };
}

// outcome: "good" (default) or "bad" — only the opening dialogue differs.
function startD1NightPostQuiz(outcome = "good") {
  // Quiz is over — gently fade the music box (and any leftover reading) away as
  // the VN scene opens, so it dissolves out instead of cutting off.
  audioMgr.stop("assets/audio/bgm/bg_ara_short.mp3", { fadeMs: 1800 });
  audioMgr.stop("assets/audio/voice/d1_dia/d1_dia_quizRead.mp3", { fadeMs: 600 });

  appState = State.DIA_VN;
  dialog.setScript(
    outcome === "bad"
      ? d1_vnScript_night_postQuiz_Bad
      : d1_vnScript_night_postQuiz_Good
  );
  dialog.onFinish = () => { appState = State.END; };
  dialog.start();
}

// ─────────────────────────────────────────────────────────────────
// HELPERS — start a named state, wire its completion callback back to VN
// ─────────────────────────────────────────────────────────────────

// Generic "enter a manager scene" used by every startX wrapper below.
//   state  — the appState to switch to
//   mgr    — the manager that owns it
//   opts   — passed to mgr.start(opts)
//   cb     — which callback the manager fires on completion (onFinish/onFound/onAllSeen)
//   next   — VN script to run after completion (ignored if onDone is given)
//   onDone — callback to run after completion instead of a VN script
function enterScene(state, mgr, opts, { cb = "onFinish", next = null, onDone = null } = {}) {
  appState = state;
  mgr[cb] = () => {
    appState = State.DIA_VN;
    if (typeof onDone === "function") onDone();
    else if (next) { dialog.setScript(next); dialog.start(); }
  };
  mgr.start(opts);
}

function startPA_Investigate(opts, nextScript) {
  enterScene(State.PA_INVESTIGATE, pa_investigateMgr, opts, { next: nextScript });
}

function startDIA_Option(opts, nextScript) {
  enterScene(State.DIA_OPTION, dia_optionMgr, opts, { next: nextScript });
}

// onDone: optional callback instead of nextScript
function startPA_Game(opts, nextScript, onDone) {
  enterScene(State.PA_GAME, pa_gameMgr, opts, { next: nextScript, onDone });
}

function startPA_Dinner(opts, nextScript) {
  enterScene(State.PA_DINNER, pa_dinnerMgr, opts, { next: nextScript });
}

function startPR_MusicSearch(opts, nextScript) {
  enterScene(State.PR_MUSIC_SEARCH, pr_musicSearchMgr, opts, { cb: "onFound", next: nextScript });
}

function startPA_WebInvestigate(config, onDone) {
  enterScene(State.PA_WEB_INVESTIGATE, pa_webInvestigateMgr, config, { cb: "onAllSeen", onDone });
}

// ─────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────
function mousePressed(event) {
  if (!dialog || !quiz || !logView) return;

  // Clicks on the floating debug panel must not advance the dialogue / game.
  if (event && event.target && event.target.closest && event.target.closest("#dbg")) {
    return;
  }

  if (appState === State.TITLE) {
    appState = State.DIA_VN;
    dialog.start();
    return;
  }

  if (appState === State.END) return;

  // Manager-owned scenes consume the click.
  const scene = SCENES[appState];
  if (scene) { scene.mousePressed(); return; }

  // Day 0 tutorial overlay swallows clicks (advance / dismiss) before the quiz.
  if (appState === State.PR_QUIZ && tutorial && tutorial.active) {
    tutorial.mousePressed();
    return;
  }

  if (dialog.isActive()) {
    dialog.mousePressed();
    return;
  }

  if (appState === State.PR_QUIZ) {
    _activeQuiz.mousePressed();
    _activeLogView.mousePressed();
    // Allow paging the read-only Day 0 notes when its page is open.
    if (
      _activeQuiz.notebookDay0Notes &&
      _activeQuiz.currentNotebook === _activeQuiz.notebookDay0Notes
    ) {
      logViewDay0Notes.mousePressed();
    }
  }
}

function keyPressed() {
  if (!dialog || !quiz || !logView) return;

  // Manager-owned scenes don't take keyboard input here.
  if (SCENES[appState]) return;

  if (dialog.isActive()) { dialog.keyPressed(key); return; }
  if (appState === State.PR_QUIZ) _activeQuiz.keyPressed();
}
