// AIGateOverlay.js (dev overlay)
// Provider/key chooser shown after the title "click anywhere" and before the
// game starts: pick ChatGPT (fast, bring your own OpenAI key — or the game's
// built-in key when the server has one) or a local Ollama model (free, slower).
//
// Security model: the key is typed into a password field, kept ONLY in
// sessionStorage (gone when the tab closes), and sent in the POST body of
// /submit requests. It is never put in the URL and never stored server-side.
//
// API:
//   AIGateOverlay.done()        -> true if a provider was already chosen
//                                  this session
//   AIGateOverlay.open()        -> true while the gate is on screen
//                                  (including the brief "ready" linger)
//   AIGateOverlay.show(onDone)  -> present the gate; onDone() fires after a
//                                  validated choice is saved

(function () {
  const KEY_PROVIDER = "smAiProvider";
  const KEY_APIKEY = "smAiKey";

  // ── styles ────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    @font-face {
      font-family: "Forum";
      src: url("assets/fonts/Forum-Regular.ttf");
    }
    #aigate {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(8, 6, 10, 0.82);
      backdrop-filter: blur(3px);
      font-family: "Forum", serif;
      color: #e8e2d8;
    }
    #aigate .panel {
      width: min(480px, 92vw);
      background: #16121a;
      border: 1px solid #4a4152;
      border-radius: 12px;
      box-shadow: 0 10px 50px rgba(0,0,0,0.7);
      padding: 26px 28px 22px;
    }
    #aigate h2 {
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: normal;
      letter-spacing: 1px;
    }
    #aigate .sub {
      color: #9a92a5;
      font-size: 14px;
      margin-bottom: 18px;
    }
    #aigate .opt {
      display: block;
      box-sizing: border-box;
      width: 100%;
      text-align: left;
      user-select: none;
      background: #211b28;
      color: #e8e2d8;
      border: 1px solid #4a4152;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
      font-family: inherit;
      font-size: 16px;
      cursor: pointer;
      transition: border-color .15s, background .15s;
    }
    #aigate .opt:hover { border-color: #8a7f9a; background: #2a2233; }
    #aigate .opt.sel { border-color: #b8a8d0; background: #2e2539; }
    #aigate .opt small { display: block; color: #9a92a5; font-size: 12.5px; margin-top: 3px; }
    #aigate .opt .meta { display: block; color: #6f6880; font-size: 11.5px; margin-top: 2px; }
    #aigate .opt.disabled { opacity: .5; cursor: default; }
    #aigate .opt.disabled:hover { border-color: #4a4152; background: #211b28; }
    #aigate .opt a { color: #b8a8d0; }
    #aigate .hint a { color: #b8a8d0; }
    #aigate .keywrap { display: none; margin: 4px 0 10px; }
    #aigate .keywrap.open { display: block; }
    #aigate input[type=password] {
      width: 100%;
      box-sizing: border-box;
      background: #0e0b12;
      border: 1px solid #4a4152;
      border-radius: 6px;
      color: #e8e2d8;
      font-family: ui-monospace, monospace;
      font-size: 13px;
      padding: 9px 10px;
    }
    #aigate input[type=password]:focus { outline: none; border-color: #b8a8d0; }
    #aigate .hint { color: #7a7286; font-size: 12px; margin-top: 5px; }
    #aigate .status { min-height: 18px; font-size: 13px; margin: 6px 0 12px; }
    #aigate .status.err { color: #e08a8a; }
    #aigate .status.ok { color: #9fd49f; }
    #aigate .go {
      width: 100%;
      background: #3a2f4a;
      color: #efe9f7;
      border: 1px solid #6a5d7e;
      border-radius: 8px;
      padding: 11px;
      font-family: inherit;
      font-size: 17px;
      letter-spacing: 1px;
      cursor: pointer;
      transition: background .15s;
    }
    #aigate .go:hover { background: #4a3d5e; }
    #aigate .go:disabled { opacity: .5; cursor: default; }
  `;
  document.head.appendChild(style);

  // ── overlay ───────────────────────────────────────────────────────
  let overlay = null;

  function close() {
    overlay?.remove();
    overlay = null;
  }

  function show(onDone) {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "aigate";
    overlay.innerHTML = `
      <div class="panel">
        <h2>Who answers your questions?</h2>
        <div class="sub">Eva needs a mind. Choose how the quiz AI runs:</div>
        <div class="opt" role="button" tabindex="0" data-provider="openai">
          ☁ ChatGPT (OpenAI API)
          <small>fastest &amp; sharpest — needs an OpenAI API key (paid)</small>
          <span class="meta" data-meta="openai">costs pennies: a full game is
          usually a few cents, well under $0.25</span>
        </div>
        <div class="opt" role="button" tabindex="0" data-provider="hf">
          🤗 Hugging Face
          <small>free — paste an access token from a free HF account</small>
          <span class="meta" data-meta="hf">free monthly credits cover casual
          play; heavy play may hit the monthly cap</span>
        </div>
        <div class="opt" role="button" tabindex="0" data-provider="local">
          💻 Local model (Ollama)
          <small>free &amp; offline — for the downloaded version of the game</small>
        </div>
        <div class="keywrap">
          <input type="password" autocomplete="off" spellcheck="false" />
          <div class="hint"></div>
        </div>
        <div class="status"></div>
        <button class="go" disabled>begin</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const opts = overlay.querySelectorAll(".opt");
    const keywrap = overlay.querySelector(".keywrap");
    const keyInput = overlay.querySelector("input");
    const keyHint = overlay.querySelector(".hint");
    const status = overlay.querySelector(".status");
    const go = overlay.querySelector(".go");
    let provider = null;

    // Hint under the key field — provider-aware, with a "get a token" link
    // for Hugging Face.
    const PRIVACY_NOTE =
      "Stays in this tab only (cleared when it closes); sent directly to the " +
      "game server, never put in the URL.";
    const hints = {
      openai:
        `No key yet? Create one at ` +
        `<a href="https://platform.openai.com/api-keys" target="_blank" ` +
        `rel="noopener">platform.openai.com/api-keys</a> ` +
        `(needs an OpenAI account with billing).<br>` +
        PRIVACY_NOTE,
      hf:
        `No token yet? Create one free (type: Read) at ` +
        `<a href="https://huggingface.co/settings/tokens" target="_blank" ` +
        `rel="noopener">huggingface.co/settings/tokens</a>.<br>` +
        PRIVACY_NOTE,
    };

    // Players always bring their own key/token — the game's server-side keys
    // are never offered here. Exception: with the debug panel UNLOCKED (?debug
    // plus the correct debug password — debug.js stores dbgPw for the tab only
    // after the server verified it), an empty key falls back to the server's.
    const debugMode =
      new URLSearchParams(location.search).has("debug") &&
      !!sessionStorage.getItem("dbgPw");
    const placeholders = {
      openai: debugMode
        ? "sk-... (debug: empty = use the server's key)"
        : "sk-... your OpenAI API key",
      hf: debugMode
        ? "hf_... (debug: empty = use the server's token)"
        : "hf_... your Hugging Face access token",
    };

    // Show which model each provider actually runs (live from the server, so
    // it stays right when OPENAI_MODEL / HF_MODEL change).
    fetch("/ai-provider")
      .then((r) => r.json())
      .then((info) => {
        for (const key of ["openai", "hf"]) {
          const meta = overlay.querySelector(`.meta[data-meta="${key}"]`);
          const model = info.providers?.[key]?.model;
          if (meta && model) meta.textContent = `model: ${model} · ${meta.textContent}`;
        }
      })
      .catch(() => {});

    // Availability probe: the local option only lights up when the server can
    // actually reach Ollama (i.e. the player runs the game on their machine).
    // In the hosted/browser version it greys out and points at the repo.
    const localOpt = overlay.querySelector('.opt[data-provider="local"]');
    fetch("/ai-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "local" }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.ok) return;
        localOpt.classList.add("disabled");
        localOpt.querySelector("small").innerHTML =
          `not available here — <a href="https://github.com/chanc245/Spider-Mansion-Web-Demo-3.0"
             target="_blank" rel="noopener">download the game on GitHub</a> to run it locally`;
      })
      .catch(() => localOpt.classList.add("disabled"));

    const setStatus = (msg, cls = "") => {
      status.textContent = msg;
      status.className = "status " + cls;
    };

    opts.forEach((b) => {
      // The cards are divs (a <button> can't legally contain the links the
      // hints/disabled state inject), so restore keyboard activation by hand.
      b.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          b.click();
        }
      });
      b.addEventListener("click", (e) => {
        // Keep the GitHub link clickable, and ignore picks on a disabled card.
        if (e.target.closest("a")) return;
        if (b.classList.contains("disabled")) return;
        provider = b.dataset.provider;
        opts.forEach((o) => o.classList.toggle("sel", o === b));
        const needsKey = provider === "openai" || provider === "hf";
        keywrap.classList.toggle("open", needsKey);
        go.disabled = false;
        setStatus("");
        if (needsKey) {
          keyInput.placeholder = placeholders[provider];
          keyHint.innerHTML = hints[provider];
          keyInput.focus();
        }
      });
    });

    const begin = async () => {
      // go.disabled doubles as the in-flight flag — it blocks the Enter key
      // from firing a second /ai-check while one is already running.
      if (!provider || go.disabled) return;
      const needsKey = provider === "openai" || provider === "hf";
      const apiKey = needsKey ? keyInput.value.trim() : "";
      const debugServerKey = needsKey && !apiKey && debugMode;
      if (needsKey && !apiKey && !debugServerKey) {
        setStatus(
          provider === "hf"
            ? "Please paste your Hugging Face access token (huggingface.co/settings/tokens)."
            : "Please enter your OpenAI API key.",
          "err",
        );
        keyInput.focus();
        return;
      }
      go.disabled = true;
      setStatus(provider === "local" ? "waking the local model..." : "checking your key...");
      try {
        const res = await fetch("/ai-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            apiKey: apiKey || undefined,
            debugServerKey: debugServerKey || undefined,
          }),
        });
        const result = await res.json();
        if (!result.ok) {
          setStatus(result.error || "That didn't work — try again.", "err");
          go.disabled = false;
          return;
        }
        sessionStorage.setItem(KEY_PROVIDER, provider);
        if (needsKey && apiKey) {
          sessionStorage.setItem(KEY_APIKEY, apiKey);
        } else {
          sessionStorage.removeItem(KEY_APIKEY);
        }
        setStatus(`ready — ${result.model}`, "ok");
        setTimeout(() => {
          close();
          onDone?.(provider);
        }, 450);
      } catch (err) {
        setStatus("Can't reach the game server: " + err.message, "err");
        go.disabled = false;
      }
    };
    go.addEventListener("click", begin);
    keyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") begin();
    });
  }

  const done = () => !!sessionStorage.getItem(KEY_PROVIDER);
  const open = () => !!overlay;

  window.AIGateOverlay = { show, done, open };
})();
