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
let appState = "TITLE";

// ─── Kitchen investigation config ────────────────────────────────
// Positions and asset paths match the spider-web investigation art.
const D1_KITCHEN_OBJECTS = [
  {
    name: "window",
    imgLine: "assets/inv_obj/obtLine_ktcn_01_Window.png",
    imgFull: "assets/inv_obj/obt_ktcn_01_Window.png",
    img: { x: 483, y: 104, w: 123, h: 106.66 },
    text: "The window is open, letting in a slight breeze.",
  },
  {
    name: "ashes",
    imgLine: "assets/inv_obj/obtLine_ktcn_02_Ashes.png",
    imgFull: "assets/inv_obj/obt_ktcn_02_Ashes.png",
    img: { x: 270, y: 421, w: 41, h: 28 },
    text: "You notice ashes on the ground. They smell like more than just burnt food; there's something else in the scent.",
  },
  {
    name: "cigarette butts",
    imgLine: "assets/inv_obj/obtLine_ktcn_03_CigaretteButt.png",
    imgFull: "assets/inv_obj/obt_ktcn_03_CigaretteButt.png",
    img: { x: 306, y: 401, w: 39, h: 24 },
    text: "You find cigarette butts on the floor. Master Von Silken won't be pleased if he finds out Cook Harris is smoking in the kitchen. The smell is strong and herbal.",
  },
  {
    name: "cigarette box",
    imgLine: "assets/inv_obj/obtLine_ktcn_04_CigeretteBox.png",
    imgFull: "assets/inv_obj/obt_ktcn_04_CigeretteBox.png",
    img: { x: 859, y: 371, w: 60, h: 33 },
    text: "A doctor's note reads: \"If you smoke too often, your sense of taste and smell may become dull.\"",
  },
  {
    name: "recipe book",
    imgLine: "assets/inv_obj/obtLine_ktcn_05_RecipeBook.png",
    imgFull: "assets/inv_obj/obt_ktcn_05_RecipeBook.png",
    img: { x: 510, y: 213, w: 70, h: 58.17 },
    text: "You see a book near the window, its pages fluttering in the wind.",
    subOptions: [
      { label: "Read the book",  text: "There are no pictures at all. Instead, you see extremely detailed notes about flavors — so detailed they almost feel unnatural." },
      { label: "Close the book", text: "The cover shows that it is a recipe book." },
    ],
  },
  {
    name: "ingredients",
    imgLine: "assets/inv_obj/obtLine_ktcn_06_Ingredients.png",
    imgFull: "assets/inv_obj/obt_ktcn_06_Ingredients.png",
    img: { x: 387, y: 299, w: 166, h: 86 },
    text: "All the ingredients are in good condition. You've heard he uses only high-quality produce. Not for Eva, though.",
  },
  {
    name: "pot",
    imgLine: "assets/inv_obj/obtLine_ktcn_07_Pot.png",
    imgFull: "assets/inv_obj/obt_ktcn_07_Pot.png",
    img: { x: 317, y: 224, w: 57, h: 66 },
    text: "There is leftover soup in the pot.",
    subOptions: [
      { label: "Taste the soup", text: "You dip your finger in and taste the soup. … It tastes subtle… Anyone who takes a bite can't help but frown at the strange, uncanny flavor." },
      { label: "Step away",      text: "You step away from the pot." },
    ],
  },
];

const D1_KITCHEN_WEB_CONFIG = {
  bg: "assets/bg/bg_pa_1f_Kitchen.png",
  webCenter: { x: 545, y: 208 },
  objects: D1_KITCHEN_OBJECTS,
};

// Attic objects — same mechanic as the kitchen. One clickable object for now;
// add more (bed, bookshelf) once their overlay art exists. Objects with no
// imgLine/imgFull still work: the spider-web threads + hotspot make them
// clickable, they just don't draw an overlay highlight yet.
const D1_ATTIC_OBJECTS = [
  {
    name: "music box",
    // imgLine / imgFull: add when attic overlay art is ready.
    img: { x: 95, y: 150, w: 110, h: 70 }, // on the dresser, left side
    text: "A delicate, round-looking music box that seems to have been taken very carefully care of. This might be the most expensive item you can see in this room.",
  },
  // { name: "bed",       img: { x:0,y:0,w:0,h:0 }, text: "A narrow daybed that looks very uncomfortable to sleep on; the bedsheet is clean but worn out." },
  // { name: "bookshelf", img: { x:0,y:0,w:0,h:0 }, text: "An old, large bookshelf with only a few items on it: a handful of books that seem a little worn out." },
];

const D1_ATTIC_WEB_CONFIG = {
  bg: "assets/bg/bg_pa_3f_Attic.png",
  webCenter: { x: 512, y: 288 },               // placeholder
  objects: D1_ATTIC_OBJECTS,
};

// ─────────────────────────────────────────────────────────────────
// PRELOAD
// ─────────────────────────────────────────────────────────────────
function preload() {
  imgTitle = loadImage("assets/cg_titlePage.png");
  imgEnd   = loadImage("assets/cg_endPage.png");

  audioMgr = new AudioManager({ masterVolume: 1 });
  audioMgr.load("assets/audio/bg_ara.mp3", { loop: true, volume: 0.3 });
  audioMgr.load("assets/audio/dia_step.mp3");
  audioMgr.load("assets/audio/ui_clickDia.mp3", { volume: 0.5 });

  // Day 0
  quiz    = new Day0Quiz({ nbInDur: 700, nbOutDur: 450 });
  logView = new Day0QuizLog("day0");

  // Day 1 quiz (same notebook UI, different bg + puzzle)
  quiz1    = new Day0Quiz({
    nbInDur:  700,
    nbOutDur: 450,
    bgPath: "assets/quiz/bg_quiz_day1_dinningRoom.png",
    // Read-only "day0 notes" recap tab — on the RIGHT side, below the "log" tab.
    // Shows whatever the player wrote in the Day 0 puzzle (saved to localStorage).
    day0NotesTag: {
      bookmark: "assets/quiz/bookmark_dayTag.png", // reuse (mirrored) art for now
      label:    "day0\nnotes",
    },
    // Day-1-only extra bookmark: "day1 kitchen" → opens notebook_clue_d1.png.
    // Placed 5px below the "clues" tag (default position handled in Day0Quiz).
    dayTag: {
      bookmark: "assets/quiz/bookmark_dayTag.png",
      page:     "assets/quiz/notebook_clue_d1.png",
      label:    "day1\nkitchen", // two lines to fit the narrow tab
    },
  });
  logView1 = new Day0QuizLog("day1");
  // Read-only recap of the Day 0 log (no Eva, no input).
  logViewDay0Notes = new Day0QuizLog("day0Notes", { readOnly: true });

  _activeQuiz    = quiz;
  _activeLogView = logView;

  dialog = new Dialog({
    audio: audioMgr,
    x: 137, y: 396, w: 750, h: 141,
    diaAudioDir:         "assets/dia_audio",
    fadeInMs:             400,
    fadeOutMs:            200,
    cgFadeMs:             250,
    bgFadeMs:             300,
    holdBgAfterFinishMs:  150,
    clickSfxPath:         "assets/audio/ui_clickDia.mp3",
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
    appState = "DIA_OPTION";
    dia_optionMgr.onFinish = (chosenText) => {
      appState = "DIA_VN";
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
  // Option screens that run after the VN fades out draw their own bg.
  dia_optionMgr.preloadBg("assets/bg/bg_pa_1f_Dining.png"); // dinner talk
  dia_optionMgr.preloadBg("assets/bg/bg_BlackOut.png");     // music search
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
      appState = "PR_QUIZ";
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
      appState = "DIA_VN";
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
      appState = "DIA_VN";
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
}

// ─────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────
function draw() {
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

  // Clear each frame so the semi-transparent frame draws exactly once
  // (otherwise it compounds on the un-cleared canvas and looks doubled).
  background(0);

  // VN layer — always drawn as backdrop
  // During DIA_OPTION, only render the bg so the option UI owns the screen.
  dialog.suppressUi = (appState === "DIA_OPTION");
  dialog.update();
  dialog.render();

  // ── Quiz (day 0 and day 1 share this path via _activeQuiz) ──────
  if (appState === "PR_QUIZ" && !dialog.isActive()) {
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

    if (_activeLogView.alpha > 200 && _activeLogView._canShowInputThisPage()) {
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

    _prevNotebookReady = notebookReady;
    _prevNotebookImage = _activeQuiz.currentNotebook;
  }

  if (appState === "PA_INVESTIGATE") {
    pa_investigateMgr.update();
    pa_investigateMgr.render();
  }

  if (appState === "DIA_OPTION") {
    dia_optionMgr.update();
    dia_optionMgr.render();
  }

  if (appState === "PA_GAME") {
    pa_gameMgr.update();
    pa_gameMgr.render();
  }

  if (appState === "PA_DINNER") {
    pa_dinnerMgr.update();
    pa_dinnerMgr.render();
  }

  if (appState === "PR_MUSIC_SEARCH") {
    pr_musicSearchMgr.update();
    pr_musicSearchMgr.render();
  }

  if (appState === "PA_WEB_INVESTIGATE") {
    pa_webInvestigateMgr.update();
    pa_webInvestigateMgr.render();
  }
}

// ─────────────────────────────────────────────────────────────────
// DAY 1 FLOW — each function hands off to the next via callbacks
// ─────────────────────────────────────────────────────────────────

function startDay1() {
  showQuizAfterDialog = false;
  appState = "DIA_VN";
  dialog.setScript(d1_vnScript_morning);
  dialog.onFinish = () => startD1Kitchen(); // morning → straight to the kitchen
  dialog.start();
}

function startD1Kitchen() {
  appState = "DIA_VN";
  dialog.setScript(d1_vnScript_kitchen);
  dialog.onFinish = () => startPA_Game({ id: "ingredients" }, null, startD1PostCook);
  dialog.start();
}

// Short dialogue after the kitchen mini-game, then into lunch.
function startD1PostCook() {
  appState = "DIA_VN";
  dialog.setScript(d1_vnScript_postCook);
  dialog.onFinish = () => startD1Lunch();
  dialog.start();
}

function startD1Lunch() {
  appState = "DIA_VN";
  dialog.setScript(d1_vnScript_lunch);
  dialog.onFinish = () => startD1Afternoon();
  dialog.start();
}

function startD1Afternoon() {
  appState = "DIA_VN";
  dialog.setScript(d1_vnScript_afternoon_pre);
  dialog.onFinish = () => startD1KitchenInvestigate();
  dialog.start();
}

function startD1KitchenInvestigate() {
  startPA_WebInvestigate(D1_KITCHEN_WEB_CONFIG, () => {
    appState = "DIA_VN";
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
  appState = "DIA_VN";
  dialog.setScript(d1_vnScript_dinner_pre);
  dialog.onFinish = () => startD1DinnerOptions();
  dialog.start();
}

// Dinner loop — presents talkable characters as DIA_OPTION choices.
// Loops until "Return to your position" is picked.
function startD1DinnerOptions() {
  const chars = typeof d1_dinner_characters !== "undefined" ? d1_dinner_characters : [];

  const choices = chars.map((c) => ({
    label: (c._talked ? "✓ " : "") + c.label,
    text:  c.label,
  }));
  choices.push({ label: "Return to your position", text: "__leave__" });

  appState = "DIA_OPTION";
  dia_optionMgr.onFinish = (_text, idx) => {
    if (idx === chars.length) {
      // Player leaves dinner
      appState = "DIA_VN";
      dialog.setScript(d1_vnScript_dinner_post);
      dialog.onFinish = () => startD1Night();
      dialog.start();
    } else {
      // Talk to this character, then loop back
      chars[idx]._talked = true;
      appState = "DIA_VN";
      dialog.setScript(chars[idx].script);
      dialog.onFinish = () => startD1DinnerOptions();
      dialog.start();
    }
  };
  // bg: the VN has faded out by now, so the option screen paints its own bg.
  // columns: 2 — only here, lay the (many) character options out in two columns.
  dia_optionMgr.start({ choices, bg: "assets/bg/bg_pa_1f_Dining.png", columns: 2 });
}

function startD1Night() {
  appState = "DIA_VN";
  dialog.setScript(d1_vnScript_night_pre);
  dialog.onFinish = () => startD1MusicSearch();
  dialog.start();
}

// Music search — presented as a DIA_OPTION (spider-web tags), looping until the
// correct room is chosen. Wrong picks show their result in the VN dialogue box,
// then re-offer the rooms.
function startD1MusicSearch() {
  const SEARCH_BG  = "assets/bg/bg_BlackOut.png";
  const WRONG_TEXT = "You don't hear any sound here.";
  const rooms = [
    { label: "Your Room",   correct: false },
    { label: "Attic",       correct: false },
    { label: "Dining Room", correct: true  },
  ];

  appState = "DIA_OPTION";
  dia_optionMgr.onFinish = (_text, idx) => {
    if (rooms[idx] && rooms[idx].correct) {
      // Found the source — continue to the dining-room reveal.
      startD1NightDining();
    } else {
      // Wrong room: show the result in the dialogue box, then re-offer rooms.
      appState = "DIA_VN";
      dialog.setScript([{ charName: " ", bg: SEARCH_BG, text: WRONG_TEXT }]);
      dialog.onFinish = () => startD1MusicSearch();
      dialog.start();
    }
  };
  dia_optionMgr.start({
    choices: rooms.map((r) => ({ label: r.label, text: r.label })),
    bg: SEARCH_BG,
    prompt: "Where is the sound coming from?",
  });
}

function startD1NightDining() {
  appState = "DIA_VN";
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
  appState = "PR_QUIZ";
}

// outcome: "good" (default) or "bad" — only the opening dialogue differs.
function startD1NightPostQuiz(outcome = "good") {
  appState = "DIA_VN";
  dialog.setScript(
    outcome === "bad"
      ? d1_vnScript_night_postQuiz_Bad
      : d1_vnScript_night_postQuiz_Good
  );
  dialog.onFinish = () => { appState = "END"; };
  dialog.start();
}

// ─────────────────────────────────────────────────────────────────
// HELPERS — start a named state, wire onFinish back to VN
// ─────────────────────────────────────────────────────────────────

function startPA_Investigate(opts, nextScript) {
  appState = "PA_INVESTIGATE";
  pa_investigateMgr.onFinish = () => {
    appState = "DIA_VN";
    if (nextScript) { dialog.setScript(nextScript); dialog.start(); }
  };
  pa_investigateMgr.start(opts);
}

function startDIA_Option(opts, nextScript) {
  appState = "DIA_OPTION";
  dia_optionMgr.onFinish = () => {
    appState = "DIA_VN";
    if (nextScript) { dialog.setScript(nextScript); dialog.start(); }
  };
  dia_optionMgr.start(opts);
}

// onDone: optional callback instead of nextScript
function startPA_Game(opts, nextScript, onDone) {
  appState = "PA_GAME";
  pa_gameMgr.onFinish = () => {
    appState = "DIA_VN";
    if (typeof onDone === "function") onDone();
    else if (nextScript) { dialog.setScript(nextScript); dialog.start(); }
  };
  pa_gameMgr.start(opts);
}

function startPA_Dinner(opts, nextScript) {
  appState = "PA_DINNER";
  pa_dinnerMgr.onFinish = () => {
    appState = "DIA_VN";
    if (nextScript) { dialog.setScript(nextScript); dialog.start(); }
  };
  pa_dinnerMgr.start(opts);
}

function startPR_MusicSearch(opts, nextScript) {
  appState = "PR_MUSIC_SEARCH";
  pr_musicSearchMgr.onFound = () => {
    appState = "DIA_VN";
    if (nextScript) { dialog.setScript(nextScript); dialog.start(); }
  };
  pr_musicSearchMgr.start(opts);
}

function startPA_WebInvestigate(config, onDone) {
  appState = "PA_WEB_INVESTIGATE";
  pa_webInvestigateMgr.onAllSeen = () => {
    appState = "DIA_VN";
    if (typeof onDone === "function") onDone();
  };
  pa_webInvestigateMgr.start(config);
}

// ─────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────
function mousePressed() {
  if (!dialog || !quiz || !logView) return;

  if (appState === "TITLE") {
    appState = "DIA_VN";
    dialog.start();
    return;
  }

  if (appState === "END") return;

  if (appState === "PA_INVESTIGATE")    { pa_investigateMgr.mousePressed();    return; }
  if (appState === "DIA_OPTION")        { dia_optionMgr.mousePressed();         return; }
  if (appState === "PA_GAME")           { pa_gameMgr.mousePressed();            return; }
  if (appState === "PA_DINNER")         { pa_dinnerMgr.mousePressed();          return; }
  if (appState === "PR_MUSIC_SEARCH")   { pr_musicSearchMgr.mousePressed();     return; }
  if (appState === "PA_WEB_INVESTIGATE"){ pa_webInvestigateMgr.mousePressed();  return; }

  if (dialog.isActive()) {
    dialog.mousePressed();
    return;
  }

  if (appState === "PR_QUIZ") {
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

  if (
    appState === "PA_INVESTIGATE"     ||
    appState === "DIA_OPTION"         ||
    appState === "PA_GAME"            ||
    appState === "PA_DINNER"          ||
    appState === "PR_MUSIC_SEARCH"    ||
    appState === "PA_WEB_INVESTIGATE"
  ) return;

  if (dialog.isActive()) { dialog.keyPressed(key); return; }
  if (appState === "PR_QUIZ") _activeQuiz.keyPressed();
}
