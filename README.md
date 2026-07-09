# Spider Mansion Web Demo 3.0

## Built for ITP Camp Show All Thing Show

![Spider Mansion banner](public/assets/readme-img/Banner.jpg)
[**Try this demo!**](https://spider-mansion-web-demo-3-0.onrender.com/)

[Spider Mansion Offical Website](https://spidermansion.cargo.site/)

[Spider Mansion Kickstarter](https://www.kickstarter.com/projects/havenever/spider-mansion)

## What is this game?

Welcome to the Spider Mansion Web Demo! This web version gives you a glimpse of how the game will eventually look in Unity. In this horror puzzle game, you step into the shoes of a nanny tasked with caring for a young girl named Eva. Brace yourself for a series of chilling puzzles.

## How we started

One of our teammates had the interesting idea of adapting lateral thinking puzzles into horror visual-novel game. These puzzles typically require discussion with another person to solve. We decided to collaborate with a technology student with a strong interest in AI, which led us to the idea of incorporating AI into the puzzle itself.

Instead of simply creating an emotional NPC with AI, we're training the AI to focus on the puzzle's narrative, essentially turning this human interaction requirement into the core gameplay mechanic.

Visually, the game will have an early 2000s horror RPG aesthetic, contrasting with the modern twist of using an AI communication system as the main gameplay mechanic.

## Why you should play it

Calling all mystery fanatics! Are you ready for a horror quiz game where survival hinges on your wit? If you crave a challenge, this is the game for you. Step into the shoes of a nanny and experience the chilling thrill of navigating a spiderweb-infested mansion, all while solving mind-bending quizzes.

Don't be intimidated! While the stakes are high, with a big brain power, you can overcome any obstacle.

Who knows? You might _just_ survive...

---

## For developers

### Tech stack

- **Front-end:** [p5.js](https://p5js.org/) (canvas game, served as static files)
- **Server:** [Express](https://expressjs.com/) (static hosting + a few small API endpoints)
- **AI quiz:** [OpenAI](https://platform.openai.com/), [Hugging Face](https://huggingface.co/),
  or a local [Ollama](https://ollama.com/) model via the `/submit` endpoint —
  players pick one (and bring their own key/token) at game start
- **Voice:** [ElevenLabs](https://elevenlabs.io/) text-to-speech via the `/tts` endpoint
- **Runtime:** Node.js 18+ (developed on Node 22)

### Running locally

```bash
# 1. Install dependencies
npm install

# 2. Set up your environment variables
cp .env.example .env      # then fill in your API keys

# 3. Start the server
npm start                 # or: npm run dev  (auto-reload via nodemon)
```

Then open **http://localhost:3001** in your browser.

> The server runs without any API keys: players choose who runs the quiz AI at
> game start (the **AI gate**) and bring their own OpenAI key / Hugging Face
> token, or use local Ollama. Server-side keys are optional — **Eva's voice**
> needs `ELEVEN_LABS_API_KEY`. See `.env.example`.

### Environment variables

| Variable               | Required | Default                     | Purpose                                  |
| ---------------------- | -------- | --------------------------- | ---------------------------------------- |
| `OPENAI_API_KEY`       | No\*     | —                           | Optional server-side OpenAI key (players bring their own via the AI gate) |
| `ELEVEN_LABS_API_KEY`  | No       | —                           | Eva's spoken voice / TTS (`/tts`)        |
| `OPENAI_MODEL`         | No       | `gpt-4.1`                   | Chat model used for the quiz AI          |
| `AI_PROVIDER`          | No       | `openai`                    | `openai` (ChatGPT), `local` (Ollama), or `hf` (Hugging Face) |
| `OLLAMA_MODEL`         | No       | `qwen3:8b`                  | Ollama model used when provider is local |
| `OLLAMA_BASE_URL`      | No       | `http://localhost:11434/v1` | Ollama server address                    |
| `HF_MODEL`             | No       | `Qwen/Qwen3-8B`             | Model used with the `hf` provider        |
| `HF_API_KEY`           | No       | —                           | Optional built-in Hugging Face token (players can bring their own) |
| `DEBUG_PASSWORD`       | No       | — (unset = disabled)        | Password for the `?debug` panel / provider switch |
| `PORT`                 | No       | `3001`                      | Port the server listens on               |

\*Only used as the fallback when a request doesn't carry a player key — e.g.
the `?debug` empty-key convenience, or `AI_PROVIDER=openai` as server default.

### Running the quiz AI locally (no API credit needed)

The quiz can run on a free local model through [Ollama](https://ollama.com/)
instead of the OpenAI API — no key, no credit, works offline:

```bash
# 1. Install Ollama (macOS: brew install ollama), then get a model
ollama pull qwen3:8b        # recommended, ~5 GB — needs ~16 GB RAM
ollama pull llama3.2        # fallback for low-spec machines, ~2 GB
                            # (fast, but judges the puzzle noticeably worse)

# 2. Tell the server to use it (in .env)
AI_PROVIDER=local
OLLAMA_MODEL=qwen3:8b
```

Ways to switch provider (any of these):

- **`.env`**: `AI_PROVIDER=openai`, `local`, or `hf` — the default at server
  start.
- **AI gate**: the in-game chooser shown after the title click —
  players pick ChatGPT (own key), Hugging Face (own free token), or Local.
- **Debug panel**: open with `?debug` (asks for the debug password —
  `DEBUG_PASSWORD` in `.env`; unset disables it); the "AI provider" section on
  top has GPT / HF / Local buttons and shows the active model (switches
  server-wide, live).

Notes:

- Local models tend to answer slower than the API, and small ones judge the
  lateral-thinking puzzles less reliably — `qwen3:8b` is the sweet spot in our
  testing; reasoning models (e.g. `deepseek-r1:14b`) also work well but take
  ~20 s per answer (their `<think>` output is stripped server-side).
- The server sends open-weight models (both local Ollama and Hugging Face) an
  extra rule checklist and a lower temperature (see `OPEN_MODEL_DECISION_STEPS`
  in `index.js`) — small models need it to answer "doesn't relate." correctly
  instead of "no.".

### How to play

- On the title screen, the **first click opens the AI gate** — pick who runs
  the quiz AI: ChatGPT (your own key), Hugging Face (free token), or local
  Ollama. Your key stays in the tab and is never stored server-side.
- **Click anywhere** to advance dialogue.
- During a choice, **click an option** to pick it.
- In the quiz, **type a question and press Enter** to interrogate Eva — solve the
  puzzle within the question limit.
- In mini-games, **move the mouse** to play (e.g. catch the good ingredients).

### Debug panel

Add `?debug` to the URL (e.g. `http://localhost:3001/?debug`) to open a floating
panel that lets you jump straight to any stage of the game — handy for testing a
specific scene without playing through everything.

### Project structure

```
.
├── index.js                # Express server: static hosting + /submit (AI quiz) + /tts (ElevenLabs)
├── elevenlab.js            # ElevenLabs TTS helper
├── .env.example            # template for required environment variables
└── public/                 # p5.js front-end (served statically)
    ├── index.html
    ├── sketch.js           # p5 lifecycle + appState dispatch (the "state layer")
    ├── style.css           # page + loading-screen styles
    ├── debug.js            # stage-jump debug panel (?debug)
    ├── d0_DialogScript.js  # Day 0 visual-novel script (content)
    ├── d1_DialogScript.js  # Day 1 visual-novel script (content)
    ├── d1_RoomConfig.js    # Day 1 investigate room/object data
    ├── classes/            # game systems (one class per file)
    │   ├── PA_GameManager.js, PR_MusicSearchManager.js,
    │   │   PA_InvestigateManager.js, PA_WebInvestigateManager.js,
    │   │   PA_DinnerManager.js, DIA_OptionManager.js   # scene/activity managers
    │   ├── QuizNotebook.js  # notebook quiz UI shell
    │   ├── QuizLog.js       # Q&A log page (input, paging, persistence)
    │   ├── EvaAI.js         # AI quiz conversation (calls /submit)
    │   ├── AIGateOverlay.js # provider/key chooser shown at game start
    │   └── Dialog.js, AudioManager.js, TutorialOverlay.js,
    │       TagOverlayAnimator.js, Tween.js, Util.js     # supporting systems
    └── assets/             # art, audio, fonts
```

**Architecture in one breath:** `sketch.js` holds an `appState` state machine.
A `SCENES` table maps each state to the manager that owns the screen for that
frame (drawing, clicks, keys). The Day 1 narrative is a chain of `startD1*`
functions that hand off via `dialog.onFinish` callbacks. The AI quiz lives in
`EvaAI` (front-end) talking to the server's `/submit` (the AI provider chosen
at the gate) and `/tts` (ElevenLabs) endpoints.

## License

ISC

