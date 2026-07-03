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
    ["0 · PR-TITLE", () => location.reload()],
    [
      "1 · PR-VN-intro",
      () => {
        showQuizAfterDialog = true;
        _activeQuiz = quiz;
        _activeLogView = logView;
        dialog.setScript(d0_vnScript);
        dialog.onFinish = () => {
          if (showQuizAfterDialog) {
            _activeQuiz = quiz;
            _activeLogView = logView;
            quiz.setQuizState(true);
            appState = "PR_QUIZ";
          }
        };
        appState = "DIA_VN";
        dialog.start();
      },
    ],
    [
      "2 · PR-QUIZ-day0",
      () => {
        showQuizAfterDialog = true;
        _activeQuiz = quiz;
        _activeLogView = logView;
        _prevNotebookReady = quiz.isNotebookShown();
        _prevNotebookImage = quiz.currentNotebook;
        quiz.setQuizState(true);
        appState = "PR_QUIZ";
      },
    ],
    [
      "3 · PR-VN-post quiz dia (good)",
      () => {
        showQuizAfterDialog = false;
        dialog.setScript(d0_vnScript_postQuiz_Good);
        dialog.onFinish = () => startD1Kitchen(); // morning → kitchen
        dialog.queueNext(d1_vnScript_morning); // seamless chain into Day 1 (no black flash)
        appState = "DIA_VN";
        dialog.start();
      },
    ],
    [
      "3 · PR-VN-post quiz dia (bad)",
      () => {
        showQuizAfterDialog = false;
        dialog.setScript(d0_vnScript_postQuiz_Bad);
        dialog.onFinish = () => startD1Kitchen(); // morning → kitchen
        dialog.queueNext(d1_vnScript_morning); // seamless chain into Day 1 (no black flash)
        appState = "DIA_VN";
        dialog.start();
      },
    ],
    [
      "END",
      () => {
        appState = "END";
      },
    ],
  ];

  // Day 1 — full chain, each button continues into the next stage
  const day1Flow = [
    ["1 · PA-VN-Morning", () => startDay1()],
    [
      "1b · PA-INVEST-Attic",
      () => startPA_WebInvestigate(D1_ATTIC_WEB_CONFIG, () => startD1Kitchen()),
    ],
    ["2 · PA-VN-Kitchen", () => startD1Kitchen()],
    [
      "2b · PA-GAME-Soup",
      () => startPA_Game({ id: "ingredients" }, null, startD1PostCook),
    ],
    ["3 · PA-VN-Lunch", () => startD1Lunch()],
    ["4 · PA-VN-Afternoon", () => startD1Afternoon()],
    ["5 · PA-INVEST-Kitchen", () => startD1KitchenInvestigate()],
    ["6 · PA-VN-Dinner", () => startD1Dinner()],
    ["7 · PA-INTERACT-Dinner talk", () => startD1DinnerOptions()],
    ["8 · PR-VN-Night start", () => startD1Night()],
    ["9 · PR-FIND-Music Search", () => startD1MusicSearch()],
    ["10 · PR-VN-pre quiz dia", () => startD1NightDining()],
    ["11 · PR-QUIZ-day1", () => startD1Quiz()],
    ["12 · PR-VN-post quiz dia (good)", () => startD1NightPostQuiz("good")],
    ["12 · PR-VN-post quiz dia (bad)", () => startD1NightPostQuiz("bad")],
  ];

  // Isolated — load one script/state on its own (no chaining). For art/text checks.
  const isolatedScripts = [
    // Day 1
    ["d1 morning", "d1_vnScript_morning"],
    ["d1 kitchen", "d1_vnScript_kitchen"],
    ["d1 lunch", "d1_vnScript_lunch"],
    ["d1 afternoon", "d1_vnScript_afternoon_pre"],
    ["d1 afternoon-post", "d1_vnScript_afternoon_post"],
    ["d1 dinner", "d1_vnScript_dinner_pre"],
    ["d1 dinner-post", "d1_vnScript_dinner_post"],
    ["d1 night", "d1_vnScript_night_pre"],
    ["d1 night-dining", "d1_vnScript_night_dining"],
    ["d1 post-quiz good", "d1_vnScript_night_postQuiz_Good"],
    ["d1 post-quiz bad", "d1_vnScript_night_postQuiz_Bad"],
    // Day 0
    ["d0 intro", "d0_vnScript"],
    ["d0 chris", "d0_vnScript_chris"],
    ["d0 good", "d0_vnScript_postQuiz_Good"],
    ["d0 bad", "d0_vnScript_postQuiz_Bad"],
  ];

  const runScriptByName = (name) => {
    if (
      typeof window[name] === "undefined" &&
      eval(`typeof ${name}`) === "undefined"
    ) {
      console.warn("[debug] script not found:", name);
      return;
    }
    const script = eval(name);
    appState = "DIA_VN";
    dialog.setScript(script);
    dialog.start();
  };

  // ─────────────────────────────────────────────────────────────────
  // STAGE TRACKING
  // Wrap the top-level flow functions so the panel shows which narrative
  // section we're in — updated even when the game advances on its own (via
  // dialog.onFinish), not just when a debug button is clicked.
  // (Sub-states like the mini-game / investigation / quiz show via `state`.)
  // ─────────────────────────────────────────────────────────────────
  const STAGE_FNS = {
    startDay1: "1 · PA-VN-Morning",
    startD1Kitchen: "2 · PA-VN-Kitchen",
    startD1PostCook: "2c · Post-Cook",
    startD1Lunch: "3 · PA-VN-Lunch",
    startD1Afternoon: "4 · PA-VN-Afternoon",
    startD1KitchenInvestigate: "5 · PA-INVEST-Kitchen",
    startD1Dinner: "6 · PA-VN-Dinner",
    startD1DinnerOptions: "7 · PA-INTERACT-Dinner talk",
    startD1Night: "8 · PR-VN-Night start",
    startD1MusicSearch: "9 · PR-FIND-Music Search",
    startD1NightDining: "10 · PR-VN-pre quiz dia",
    startD1Quiz: "11 · PR-QUIZ-day1",
    startD1NightPostQuiz: "12 · PR-VN-post quiz dia",
  };
  Object.entries(STAGE_FNS).forEach(([name, label]) => {
    const orig = window[name];
    if (typeof orig !== "function") {
      console.warn("[debug] stage fn not found (won't auto-track):", name);
      return;
    }
    window[name] = function (...args) {
      window.__dbgStage = label;
      return orig.apply(this, args);
    };
  });

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
    #dbg-stage {
      padding: 6px 10px;
      font-size: 11px;
      color: #9a9aa8;
      border-top: 1px solid #2c2c34;
      background: rgba(255,255,255,0.02);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #dbg-stage b { color: #ffd479; font-weight: 700; }
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
  // Start collapsed (shrunk) — click the header to expand.
  panel.classList.add("collapsed");

  // header
  const head = document.createElement("div");
  head.id = "dbg-head";
  head.innerHTML = `
    <span class="title">🐞 DEBUG</span>
    <span id="dbg-state">–</span>
    <span id="dbg-min">▸</span>
  `;
  panel.appendChild(head);

  // stage bar (always visible, even when collapsed)
  const stageBar = document.createElement("div");
  stageBar.id = "dbg-stage";
  stageBar.innerHTML = `stage: <b id="dbg-stage-val">–</b>`;
  panel.appendChild(stageBar);

  const body = document.createElement("div");
  body.id = "dbg-body";
  panel.appendChild(body);

  // helper: build a section of buttons
  const makeSection = (
    label,
    entries,
    {
      accent = false,
      collapsible = false,
      closed = false,
      isScript = false,
    } = {},
  ) => {
    const sec = document.createElement("div");
    sec.className =
      "dbg-sec" +
      (collapsible ? " dbg-collapsible" : "") +
      (closed ? " closed" : "");
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
        window.__dbgStage = isScript ? "iso · " + text : text;
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
    }),
  );

  // footer
  const foot = document.createElement("div");
  foot.className = "dbg-foot";
  const restart = document.createElement("button");
  restart.textContent = "↺ Restart";
  restart.addEventListener("click", (e) => {
    e.stopPropagation();
    location.reload();
  });
  foot.appendChild(restart);
  body.appendChild(foot);

  document.body.appendChild(panel);

  // ── minimize / expand ────────────────────────────────────────────
  const toggle = () => {
    panel.classList.toggle("collapsed");
    document.getElementById("dbg-min").textContent = panel.classList.contains(
      "collapsed",
    )
      ? "▸"
      : "▾";
  };
  head.addEventListener("click", toggle);

  // ── live state + stage badges ────────────────────────────────────
  const stateEl = document.getElementById("dbg-state");
  const stageValEl = document.getElementById("dbg-stage-val");
  setInterval(() => {
    if (typeof appState !== "undefined") stateEl.textContent = appState;
    stageValEl.textContent = window.__dbgStage || "–";
  }, 120);
})();
