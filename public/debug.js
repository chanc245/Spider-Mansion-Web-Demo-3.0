// debug.js
// Floating debug panel — only visible when ?debug=1 is in the URL.
// e.g. http://localhost:3001/?debug=1
// Buttons are "in-flow": they call the real flow functions in sketch.js so the
// game continues correctly into the next stage, instead of just loading a
// script in isolation. (Isolated single-script/state tests live in their own
// section at the bottom.)
// Remove or ignore this file in production.

(function () {
  if (!new URLSearchParams(location.search).has("debug")) return;

  // ── safe call: warn instead of throwing if a global isn't loaded yet ──
  const call = (label, fn) => {
    try {
      fn();
    } catch (err) {
      console.warn(`[debug] "${label}" failed:`, err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // FLOW DEFINITIONS  (each entry: [label, handler])
  // ─────────────────────────────────────────────────────────────────

  // Day 0 — title > vn > quiz > vn > end
  const day0Flow = [
    ["Title (reload)", () => location.reload()],
    ["Intro VN", () => {
      showQuizAfterDialog = true;
      _activeQuiz = quiz; _activeLogView = logView;
      dialog.setScript(d0_vnScript);
      dialog.onFinish = () => {
        if (showQuizAfterDialog) {
          _activeQuiz = quiz; _activeLogView = logView;
          quiz.setQuizState(true);
          appState = "PR_QUIZ";
        }
      };
      appState = "DIA_VN";
      dialog.start();
    }],
    ["Quiz", () => {
      showQuizAfterDialog = true;
      _activeQuiz = quiz; _activeLogView = logView;
      _prevNotebookReady = quiz.isNotebookShown();
      _prevNotebookImage = quiz.currentNotebook;
      quiz.setQuizState(true);
      appState = "PR_QUIZ";
    }],
    ["Good Ending VN", () => {
      showQuizAfterDialog = false;
      dialog.setScript(d0_vnScript_postQuiz_Good);
      dialog.onFinish = () => { appState = "END"; };
      appState = "DIA_VN";
      dialog.start();
    }],
    ["Bad Ending VN", () => {
      showQuizAfterDialog = false;
      dialog.setScript(d0_vnScript_postQuiz_Bad);
      dialog.onFinish = () => { appState = "END"; };
      appState = "DIA_VN";
      dialog.start();
    }],
    ["END", () => { appState = "END"; }],
  ];

  // Day 1 — full chain, each button continues into the next stage
  const day1Flow = [
    ["1 · Morning",             () => startDay1()],
    ["1b · Attic Investigate",  () => startPA_WebInvestigate(D1_ATTIC_WEB_CONFIG, () => startD1Kitchen())],
    ["2 · Kitchen (VN)",        () => startD1Kitchen()],
    ["3 · Lunch (attic)",       () => startD1Lunch()],
    ["4 · Afternoon",           () => startD1Afternoon()],
    ["5 · Kitchen Investigate", () => startD1KitchenInvestigate()],
    ["6 · Dinner",              () => startD1Dinner()],
    ["7 · Dinner Talk",         () => startD1DinnerOptions()],
    ["8 · Night",               () => startD1Night()],
    ["9 · Music Search",        () => startD1MusicSearch()],
    ["10 · Night Dining",       () => startD1NightDining()],
    ["11 · Day 1 Quiz",         () => startD1Quiz()],
    ["12 · Post-Quiz (good)",   () => startD1NightPostQuiz("good")],
    ["12 · Post-Quiz (bad)",    () => startD1NightPostQuiz("bad")],
  ];

  // Isolated — load one script/state on its own (no chaining). For art/text checks.
  const isolatedScripts = [
    // Day 1
    ["d1 morning",       "d1_vnScript_morning"],
    ["d1 kitchen",       "d1_vnScript_kitchen"],
    ["d1 lunch",         "d1_vnScript_lunch"],
    ["d1 afternoon",     "d1_vnScript_afternoon_pre"],
    ["d1 afternoon-post","d1_vnScript_afternoon_post"],
    ["d1 dinner",        "d1_vnScript_dinner_pre"],
    ["d1 dinner-post",   "d1_vnScript_dinner_post"],
    ["d1 night",         "d1_vnScript_night_pre"],
    ["d1 night-dining",  "d1_vnScript_night_dining"],
    ["d1 post-quiz good","d1_vnScript_night_postQuiz_Good"],
    ["d1 post-quiz bad", "d1_vnScript_night_postQuiz_Bad"],
    // Day 0
    ["d0 intro",         "d0_vnScript"],
    ["d0 chris",         "d0_vnScript_chris"],
    ["d0 good",          "d0_vnScript_postQuiz_Good"],
    ["d0 bad",           "d0_vnScript_postQuiz_Bad"],
  ];

  const runScriptByName = (name) => {
    if (typeof window[name] === "undefined" && eval(`typeof ${name}`) === "undefined") {
      console.warn("[debug] script not found:", name);
      return;
    }
    const script = eval(name);
    appState = "DIA_VN";
    dialog.setScript(script);
    dialog.start();
  };

  // ─────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #dbg {
      position: fixed;
      right: 12px;
      bottom: 12px;
      z-index: 99999;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      width: 232px;
      background: rgba(20, 20, 24, 0.94);
      color: #e6e6e6;
      border: 1px solid #3a3a42;
      border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.45);
      backdrop-filter: blur(4px);
      user-select: none;
      overflow: hidden;
    }
    #dbg-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(255,255,255,0.04);
      cursor: pointer;
    }
    #dbg-head .title { font-weight: 700; letter-spacing: .5px; color: #cfcfe0; }
    #dbg-state {
      margin-left: auto;
      font-size: 11px;
      color: #7ecfff;
      font-weight: 700;
      max-width: 92px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #dbg-min {
      color: #888;
      font-size: 14px;
      line-height: 1;
      padding: 0 2px;
    }
    #dbg-body { padding: 8px 10px 10px; max-height: 60vh; overflow-y: auto; }
    #dbg.collapsed #dbg-body { display: none; }
    #dbg.collapsed { width: auto; }

    .dbg-sec { margin-top: 10px; }
    .dbg-sec:first-child { margin-top: 0; }
    .dbg-sec > .lbl {
      display: block;
      color: #7a7a88;
      font-size: 10px;
      letter-spacing: .6px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .dbg-grid { display: flex; flex-wrap: wrap; gap: 4px; }
    #dbg button {
      background: #2a2a32;
      color: #e6e6e6;
      border: 1px solid #44444f;
      border-radius: 5px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 11px;
      font-family: inherit;
      transition: background .12s, border-color .12s;
    }
    #dbg button:hover { background: #3a3a45; border-color: #6a6a7a; }
    #dbg button.accent { border-color: #5a7da0; color: #adceff; }
    .dbg-foot {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #33333b;
    }
    .dbg-foot button { flex: 1; }
    .dbg-collapsible > .lbl { cursor: pointer; }
    .dbg-collapsible.closed .dbg-grid { display: none; }
    .dbg-collapsible > .lbl::before { content: "▾ "; color: #555; }
    .dbg-collapsible.closed > .lbl::before { content: "▸ "; }
  `;
  document.head.appendChild(style);

  // ─────────────────────────────────────────────────────────────────
  // BUILD PANEL
  // ─────────────────────────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.id = "dbg";

  // header
  const head = document.createElement("div");
  head.id = "dbg-head";
  head.innerHTML = `
    <span class="title">🐞 DEBUG</span>
    <span id="dbg-state">–</span>
    <span id="dbg-min">▾</span>
  `;
  panel.appendChild(head);

  const body = document.createElement("div");
  body.id = "dbg-body";
  panel.appendChild(body);

  // helper: build a section of buttons
  const makeSection = (label, entries, { accent = false, collapsible = false, closed = false, isScript = false } = {}) => {
    const sec = document.createElement("div");
    sec.className = "dbg-sec" + (collapsible ? " dbg-collapsible" : "") + (closed ? " closed" : "");
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = label;
    sec.appendChild(lbl);

    const grid = document.createElement("div");
    grid.className = "dbg-grid";
    entries.forEach(([text, handler]) => {
      const b = document.createElement("button");
      b.textContent = text;
      if (accent) b.classList.add("accent");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isScript) call(text, () => runScriptByName(handler));
        else call(text, handler);
      });
      grid.appendChild(b);
    });
    sec.appendChild(grid);

    if (collapsible) {
      lbl.addEventListener("click", () => sec.classList.toggle("closed"));
    }
    return sec;
  };

  body.appendChild(makeSection("Day 1 flow", day1Flow, { accent: true }));
  body.appendChild(makeSection("Day 0 flow", day0Flow));
  body.appendChild(
    makeSection("Isolated scripts (no chaining)", isolatedScripts, {
      collapsible: true,
      closed: true,
      isScript: true,
    })
  );

  // footer
  const foot = document.createElement("div");
  foot.className = "dbg-foot";
  const restart = document.createElement("button");
  restart.textContent = "↺ Restart";
  restart.addEventListener("click", (e) => { e.stopPropagation(); location.reload(); });
  foot.appendChild(restart);
  body.appendChild(foot);

  document.body.appendChild(panel);

  // ── minimize / expand ────────────────────────────────────────────
  const toggle = () => {
    panel.classList.toggle("collapsed");
    document.getElementById("dbg-min").textContent =
      panel.classList.contains("collapsed") ? "▸" : "▾";
  };
  head.addEventListener("click", toggle);

  // ── live state badge ─────────────────────────────────────────────
  const stateEl = document.getElementById("dbg-state");
  setInterval(() => {
    if (typeof appState !== "undefined") stateEl.textContent = appState;
  }, 120);
})();
