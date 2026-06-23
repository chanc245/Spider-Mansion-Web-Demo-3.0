// debug.js
// Debug panel — only visible when ?debug=1 is in the URL.
// e.g. http://localhost:3001/?debug=1
// Remove or ignore this file in production.

(function () {
  if (!new URLSearchParams(location.search).has("debug")) return;

  // ── styles ──────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #debug-panel {
      font-family: monospace;
      font-size: 13px;
      background: #1a1a1a;
      color: #e0e0e0;
      border-top: 2px solid #444;
      padding: 10px 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      user-select: none;
      width: 1024px;
      box-sizing: border-box;
    }
    #debug-panel label { color: #aaa; margin-right: 4px; }
    #debug-state-display {
      color: #7ecfff;
      font-weight: bold;
      min-width: 160px;
    }
    #debug-panel button {
      background: #2e2e2e;
      color: #e0e0e0;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 3px 10px;
      cursor: pointer;
      font-size: 12px;
      font-family: monospace;
    }
    #debug-panel button:hover { background: #3e3e3e; border-color: #888; }
    #debug-panel .sep {
      color: #444;
      margin: 0 4px;
    }
    #debug-panel .group-label {
      color: #888;
      font-size: 11px;
      margin-right: 2px;
    }
  `;
  document.head.appendChild(style);

  // ── panel HTML ───────────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.id = "debug-panel";
  panel.innerHTML = `
    <label>state:</label>
    <span id="debug-state-display">–</span>
    <span class="sep">|</span>

    <span class="group-label">jump →</span>
    <button data-state="TITLE">TITLE</button>
    <button data-state="DIA_VN">DIA_VN</button>
    <button data-state="PR_QUIZ">PR_QUIZ</button>
    <button data-state="END">END</button>

    <span class="sep">|</span>
    <span class="group-label">day1 →</span>
    <button data-state="PA_INVESTIGATE">PA_INVESTIGATE</button>
    <button data-state="DIA_OPTION">DIA_OPTION</button>
    <button data-state="PA_GAME">PA_GAME</button>
    <button data-state="PA_DINNER">PA_DINNER</button>
    <button data-state="PR_MUSIC_SEARCH">PR_MUSIC_SEARCH</button>

    <span class="sep">|</span>
    <span class="group-label">script →</span>
    <button data-script="d0_vnScript">d0_vnScript</button>
    <button data-script="d0_vnScript_chris">d0_vnScript_chris</button>
    <button data-script="d0_vnScript_postQuiz_Good">postQuiz_Good</button>
    <button data-script="d0_vnScript_postQuiz_Bad">postQuiz_Bad</button>
    <button data-script="d1_vnScript_morning">d1_morning</button>

    <span class="sep">|</span>
    <button id="debug-restart">↺ restart</button>
  `;
  document.body.appendChild(panel);

  // ── poll appState and update display ────────────────────────────
  const display = document.getElementById("debug-state-display");
  setInterval(() => {
    if (typeof appState !== "undefined") display.textContent = appState;
  }, 100);

  // ── state jump buttons ───────────────────────────────────────────
  panel.querySelectorAll("button[data-state]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.state;
      if (typeof appState === "undefined") return;

      // For states that need a manager started, launch with stub config
      switch (target) {
        case "PA_INVESTIGATE":
          if (typeof startPA_Investigate === "function") {
            startPA_Investigate({
              items: [
                {
                  id: "test1",
                  label: "Test Item A",
                  text: "Debug: item A text.",
                },
                {
                  id: "test2",
                  label: "Test Item B",
                  text: "Debug: item B text.",
                  subOptions: [
                    { label: "Option 1", text: "You chose option 1." },
                    { label: "Option 2", text: "You chose option 2." },
                  ],
                },
              ],
            });
          }
          break;

        case "DIA_OPTION":
          if (typeof startDIA_Option === "function") {
            startDIA_Option({
              prompt: "Debug: what do you choose?",
              choices: [
                { label: "Choice A", text: "You chose A." },
                { label: "Choice B", text: "You chose B." },
              ],
            });
          }
          break;

        case "PA_GAME":
          if (typeof startPA_Game === "function") {
            startPA_Game({ id: "debug_test" });
          }
          break;

        case "PA_DINNER":
          if (typeof startPA_Dinner === "function") {
            startPA_Dinner({
              characters: [
                {
                  id: "char1",
                  label: "Eva",
                  text: "Look! I usually get a good meal.",
                },
                {
                  id: "char2",
                  label: "Cook",
                  text: "If I don't serve that little girl's meal...",
                },
              ],
            });
          }
          break;

        case "PR_MUSIC_SEARCH":
          if (typeof startPR_MusicSearch === "function") {
            startPR_MusicSearch({
              rooms: [
                { id: "nanny", label: "Your Room", correct: false },
                { id: "attic", label: "Attic", correct: false },
                { id: "dining", label: "Dining Room", correct: true },
              ],
              wrongText: "You don't hear any sound here.",
            });
          }
          break;

        default:
          // Simple state jump — just set appState directly
          appState = target;
          break;
      }
    });
  });

  // ── script jump buttons ─────────────────────────────────────────
  const scriptMap = {
    d0_vnScript: () =>
      typeof d0_vnScript !== "undefined" ? d0_vnScript : null,
    d0_vnScript_chris: () =>
      typeof d0_vnScript_chris !== "undefined" ? d0_vnScript_chris : null,
    d0_vnScript_postQuiz_Good: () =>
      typeof d0_vnScript_postQuiz_Good !== "undefined"
        ? d0_vnScript_postQuiz_Good
        : null,
    d0_vnScript_postQuiz_Bad: () =>
      typeof d0_vnScript_postQuiz_Bad !== "undefined"
        ? d0_vnScript_postQuiz_Bad
        : null,
    d1_vnScript_morning: () =>
      typeof d1_vnScript_morning !== "undefined" ? d1_vnScript_morning : null,
  };

  panel.querySelectorAll("button[data-script]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.script;
      const getScript = scriptMap[key];
      if (!getScript) return;
      const script = getScript();
      if (!script) {
        console.warn("Script not found:", key);
        return;
      }
      if (typeof dialog === "undefined") return;
      appState = "DIA_VN";
      dialog.setScript(script);
      dialog.start();
    });
  });

  // ── restart button ───────────────────────────────────────────────
  document.getElementById("debug-restart").addEventListener("click", () => {
    location.reload();
  });
})();
