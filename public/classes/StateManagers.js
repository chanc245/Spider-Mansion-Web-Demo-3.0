// StateManagers.js
// ─────────────────────────────────────────────────────────────────
// Lightweight state managers for INVESTIGATE, OPTION, GAME, DINNER.
// Each manager is given a config when started and calls onFinish()
// when the player completes the state, returning control to sketch.js.
// ─────────────────────────────────────────────────────────────────

// ── INVESTIGATE ──────────────────────────────────────────────────
// Player must click every item in the current location's list.
// Sub-options (e.g. read/close): item counts as done after BOTH are tried.
//
// Config example:
//   pa_investigateMgr.start({
//     optional: true,
//     items: [
//       { id: "bed",       label: "Bed",        text: "A narrow daybed..." },
//       { id: "musicbox",  label: "Music Box",  text: "A delicate music box..." },
//       { id: "bookshelf", label: "Bookshelf",  text: "An old bookshelf...",
//         subOptions: [
//           { label: "Look closer", text: "You see worn spines..." },
//           { label: "Step back",   text: "Nothing else catches your eye." },
//         ]
//       },
//     ],
//   });

class PA_InvestigateManager {
  constructor() {
    this.active = false;
    this.items = []; // { id, label, text, subOptions?, _seen, _subDone }
    this.optional = false;
    this.onFinish = null; // called when all items seen (or Leave clicked)

    // UI state
    this._phase = "list"; // "list" | "detail" | "sub"
    this._current = null; // item being read
    this._subIndex = 0; // which sub-option was last clicked
    this._seenCount = 0;

    // p5 button references
    this._buttons = [];
  }

  // ── start ───────────────────────────────────────────────────────
  start(opts = {}) {
    this.items = (opts.items ?? []).map((it) => ({
      ...it,
      _seen: false,
      _subDone: it.subOptions
        ? new Array(it.subOptions.length).fill(false)
        : null,
    }));
    this._seenCount = 0;
    this._phase = "list";
    this._current = null;
    this.active = true;
    this._buildButtons();
  }

  // ── update / render ─────────────────────────────────────────────
  update() {}

  render() {
    if (!this.active) return;

    // Semi-transparent overlay
    push();
    fill(0, 0, 0, 160);
    noStroke();
    rect(0, 0, width, height);
    pop();

    if (this._phase === "list") {
      this._renderList();
    } else if (this._phase === "detail" || this._phase === "sub") {
      this._renderDetail();
    }
  }

  _renderList() {
    push();
    fill(240, 230, 220);
    stroke(100);
    rect(200, 120, 624, 336, 8);

    fill(40);
    noStroke();
    textSize(18);
    textAlign(LEFT, TOP);
    text("Investigate", 220, 135);

    // Item status dots
    let y = 170;
    for (const item of this.items) {
      const done = this._isItemDone(item);
      fill(done ? 80 : 160);
      ellipse(225, y + 10, 10, 10);
      fill(done ? 40 : 100);
      text(item.label, 235, y);
      y += 36;
    }
    pop();
  }

  _renderDetail() {
    const item = this._current;
    if (!item) return;

    push();
    fill(240, 230, 220);
    stroke(100);
    rect(200, 120, 624, 336, 8);

    fill(40);
    noStroke();
    textSize(16);
    textAlign(LEFT, TOP);
    textWrap(WORD);

    if (this._phase === "sub" && item.subOptions) {
      // show sub-option result text
    } else {
      text(item.text, 220, 140, 584, 260);
    }
    pop();
  }

  // ── mouse ────────────────────────────────────────────────────────
  mousePressed() {
    if (!this.active) return;
    for (const btn of this._buttons) {
      if (this._hitTest(btn)) {
        btn.action();
        this._buildButtons();
        return;
      }
    }
  }

  _hitTest(btn) {
    return (
      mouseX >= btn.x &&
      mouseX <= btn.x + btn.w &&
      mouseY >= btn.y &&
      mouseY <= btn.y + btn.h
    );
  }

  // ── button builder ───────────────────────────────────────────────
  _buildButtons() {
    this._buttons = [];

    if (this._phase === "list") {
      let y = 165;
      for (const item of this.items) {
        const captured = item; // closure capture
        this._buttons.push({
          x: 220,
          y,
          w: 580,
          h: 30,
          action: () => this._openItem(captured),
        });
        y += 36;
      }

      // Leave button (always shown if optional; shown when all done otherwise)
      const allDone = this.items.every((it) => this._isItemDone(it));
      if (allDone) {
        this._buttons.push({
          x: 680,
          y: 420,
          w: 120,
          h: 30,
          label: "Leave",
          action: () => this._finish(),
        });
      }
    }

    if (this._phase === "detail") {
      const item = this._current;

      if (item.subOptions && item.subOptions.length) {
        // Show sub-option buttons
        item.subOptions.forEach((sub, i) => {
          this._buttons.push({
            x: 220,
            y: 340 + i * 40,
            w: 580,
            h: 32,
            label: sub.label,
            action: () => {
              item._subDone[i] = true;
              // If all sub-options tried, mark item seen
              if (item._subDone.every(Boolean)) {
                if (!item._seen) {
                  item._seen = true;
                  this._seenCount++;
                }
              }
              this._phase = "list";
              this._current = null;
            },
          });
        });
      } else {
        // Simple item — back button marks it done
        this._buttons.push({
          x: 680,
          y: 400,
          w: 120,
          h: 30,
          label: "Back",
          action: () => {
            if (!item._seen) {
              item._seen = true;
              this._seenCount++;
            }
            this._phase = "list";
            this._current = null;
          },
        });
      }
    }
  }

  _openItem(item) {
    this._current = item;
    this._phase = "detail";
  }

  _isItemDone(item) {
    if (item.subOptions) return item._subDone && item._subDone.every(Boolean);
    return item._seen;
  }

  _finish() {
    this.active = false;
    this._buttons = [];
    this.onFinish?.();
  }
}

// ── OPTION ───────────────────────────────────────────────────────
// Shows 2–4 choice buttons. Each has a short text response.
// All paths rejoin the same next VN line (onFinish called after).
//
// Config example:
//   dia_optionMgr.start({
//     prompt: "What do you say?",
//     choices: [
//       { label: "Tell the cook you still want the meal.",
//         text:  "You firmly request the meal for Lady Eva." },
//       { label: "Tell the cook Eva seemed hungry.",
//         text:  "You mention that Eva's stomach was growling." },
//     ],
//   });

class DIA_OptionManager {
  constructor() {
    this.active = false;
    this.prompt = "";
    this.choices = []; // { label, text }
    this._result = null; // chosen text, shown before finishing
    this._phase = "choose"; // "choose" | "result"
    this.onFinish = null;
    this._buttons = [];
  }

  start(opts = {}) {
    this.prompt = opts.prompt ?? "";
    this.choices = opts.choices ?? [];
    this._result = null;
    this._phase = "choose";
    this.active = true;
    this._buildButtons();
  }

  update() {}

  render() {
    if (!this.active) return;

    push();
    fill(0, 0, 0, 160);
    noStroke();
    rect(0, 0, width, height);

    fill(240, 230, 220);
    stroke(100);
    rect(200, 150, 624, 276, 8);

    fill(40);
    noStroke();
    textSize(17);
    textAlign(LEFT, TOP);
    textWrap(WORD);

    if (this._phase === "choose") {
      text(this.prompt, 220, 165, 584, 80);
      // Buttons rendered via _buttons hit areas — labels drawn here
      let y = 255;
      for (const ch of this.choices) {
        fill(200, 190, 180);
        stroke(120);
        rect(220, y, 584, 32, 4);
        fill(40);
        noStroke();
        textSize(15);
        text(ch.label, 230, y + 8);
        y += 44;
      }
    } else {
      // Show chosen response text, then a Continue button
      text(this._result, 220, 165, 584, 200);
    }
    pop();
  }

  mousePressed() {
    if (!this.active) return;
    for (const btn of this._buttons) {
      if (this._hit(btn)) {
        btn.action();
        this._buildButtons();
        return;
      }
    }
  }

  _hit(btn) {
    return (
      mouseX >= btn.x &&
      mouseX <= btn.x + btn.w &&
      mouseY >= btn.y &&
      mouseY <= btn.y + btn.h
    );
  }

  _buildButtons() {
    this._buttons = [];
    if (this._phase === "choose") {
      let y = 255;
      for (const ch of this.choices) {
        const captured = ch;
        this._buttons.push({
          x: 220,
          y,
          w: 584,
          h: 32,
          action: () => {
            this._result = captured.text;
            this._phase = "result";
          },
        });
        y += 44;
      }
    } else {
      // Continue button
      this._buttons.push({
        x: 680,
        y: 390,
        w: 120,
        h: 30,
        action: () => {
          this.active = false;
          this._buttons = [];
          this.onFinish?.();
        },
      });
    }
  }
}

// ── GAME ─────────────────────────────────────────────────────────
// Placeholder for mini-games. Renders a stub screen.
// Replace _runGame() with actual mini-game logic when ready.
//
// Config example:
//   pa_gameMgr.start({ id: "ingredients" });

class PA_GameManager {
  constructor() {
    this.active = false;
    this.gameId = null;
    this.onFinish = null;
    this._buttons = [];
  }

  start(opts = {}) {
    this.gameId = opts.id ?? "unknown";
    this.active = true;
    // TODO: initialise actual mini-game logic based on this.gameId
    this._buttons = [
      {
        x: 412,
        y: 380,
        w: 200,
        h: 40,
        label: "[ Finish Game ]", // stub — replace with real game completion
        action: () => {
          this.active = false;
          this._buttons = [];
          this.onFinish?.();
        },
      },
    ];
  }

  update() {
    if (!this.active) return;
    // TODO: update mini-game logic here
  }

  render() {
    if (!this.active) return;

    push();
    background(20, 10, 10);

    fill(200);
    noStroke();
    textSize(22);
    textAlign(CENTER, CENTER);
    text(`[ MINI-GAME: ${this.gameId} ]`, width / 2, height / 2 - 40);
    textSize(14);
    fill(140);
    text("(game logic goes here)", width / 2, height / 2);

    // Stub finish button
    const btn = this._buttons[0];
    if (btn) {
      fill(80, 60, 60);
      stroke(160);
      rect(btn.x, btn.y, btn.w, btn.h, 6);
      fill(220);
      noStroke();
      textSize(15);
      text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }
    pop();
  }

  mousePressed() {
    if (!this.active) return;
    for (const btn of this._buttons) {
      if (
        mouseX >= btn.x &&
        mouseX <= btn.x + btn.w &&
        mouseY >= btn.y &&
        mouseY <= btn.y + btn.h
      ) {
        btn.action();
        return;
      }
    }
  }
}

// ── DINNER ───────────────────────────────────────────────────────
// Player can click characters in any order.
// Ends when: (a) player clicks the tray at any time, OR
//            (b) player has talked to everyone → "Return to position" button appears.
//
// Config example:
//   pa_dinnerMgr.start({
//     characters: [
//       { id: "ladyMaster", label: "Lady Master", text: "Take care of that little girl..." },
//       { id: "mistress",   label: "Mistress",    text: "(She's not interested in you.)" },
//       { id: "master",     label: "Master",      text: "(He's not interested in you.)" },
//       { id: "eva",        label: "Eva",          text: "Look! I usually get a good meal for dinner." },
//       { id: "cook",       label: "Cook",         text: "If I don't serve that little girl's meal..." },
//       { id: "gardener",   label: "Gardener",     text: "Brother is right..." },
//       { id: "headMaid",   label: "Head Maid",    text: "Stop wandering around..." },
//     ],
//   });

class PA_DinnerManager {
  constructor() {
    this.active = false;
    this.characters = []; // { id, label, text, _talked }
    this._reading = null; // character currently being read
    this.onFinish = null;
    this._buttons = [];
    this._allTalked = false;
  }

  start(opts = {}) {
    this.characters = (opts.characters ?? []).map((c) => ({
      ...c,
      _talked: false,
    }));
    this._reading = null;
    this._allTalked = false;
    this.active = true;
    this._buildButtons();
  }

  update() {
    const allDone = this.characters.every((c) => c._talked);
    if (allDone !== this._allTalked) {
      this._allTalked = allDone;
      this._buildButtons(); // show "Return to position" once all talked
    }
  }

  render() {
    if (!this.active) return;

    push();
    fill(0, 0, 0, 140);
    noStroke();
    rect(0, 0, width, height);

    fill(240, 230, 220);
    stroke(100);
    rect(180, 100, 664, 376, 8);

    fill(40);
    noStroke();
    textSize(17);
    textAlign(LEFT, TOP);

    if (this._reading) {
      // Show character dialogue + Back button
      textWrap(WORD);
      textSize(15);
      text(`${this._reading.label}:`, 200, 118);
      textSize(16);
      text(this._reading.text, 200, 145, 624, 260);
    } else {
      // Character list
      text(
        "Dinner — talk to everyone or click the tray to leave.",
        200,
        115,
        624,
        40,
      );
      let y = 165;
      for (const ch of this.characters) {
        fill(ch._talked ? 100 : 40);
        textSize(15);
        text((ch._talked ? "✓ " : "  ") + ch.label, 200, y);
        y += 34;
      }
    }
    pop();

    // Draw button labels
    push();
    noStroke();
    for (const btn of this._buttons) {
      if (!btn.label) continue;
      fill(btn.color ?? color(180, 160, 140));
      rect(btn.x, btn.y, btn.w, btn.h, 4);
      fill(40);
      textSize(14);
      textAlign(CENTER, CENTER);
      text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }
    pop();
  }

  mousePressed() {
    if (!this.active) return;
    for (const btn of this._buttons) {
      if (
        mouseX >= btn.x &&
        mouseX <= btn.x + btn.w &&
        mouseY >= btn.y &&
        mouseY <= btn.y + btn.h
      ) {
        btn.action();
        this._buildButtons();
        return;
      }
    }
  }

  _buildButtons() {
    this._buttons = [];

    if (this._reading) {
      // Back button
      this._buttons.push({
        x: 700,
        y: 430,
        w: 120,
        h: 32,
        label: "Back",
        action: () => {
          this._reading._talked = true;
          this._reading = null;
        },
      });
      return;
    }

    // Character click zones (invisible hit areas matching rendered list)
    let y = 160;
    for (const ch of this.characters) {
      const captured = ch;
      this._buttons.push({
        x: 195,
        y,
        w: 640,
        h: 30,
        action: () => {
          this._reading = captured;
        },
      });
      y += 34;
    }

    // Tray — always visible (ends dinner immediately)
    this._buttons.push({
      x: 700,
      y: 430,
      w: 120,
      h: 32,
      label: "🍽 Tray",
      color: color(160, 120, 80),
      action: () => this._finish(),
    });

    // "Return to position" — only appears after all characters talked
    if (this._allTalked) {
      this._buttons.push({
        x: 550,
        y: 430,
        w: 140,
        h: 32,
        label: "Return to position",
        color: color(120, 150, 120),
        action: () => this._finish(),
      });
    }
  }

  _finish() {
    this.active = false;
    this._buttons = [];
    this.onFinish?.();
  }
}

// ── Night search (OPTION variant) ────────────────────────────────
// Player chooses a room to search. Wrong rooms show "no sound".
// Clicking the correct room advances the story.
// Implemented as a specialised OptionManager subclass.
//
// Config example:
//   pr_musicSearchMgr.start({
//     rooms: [
//       { id: "nanny",  label: "Your Room",   bg: "bg_pr_ug_room1_Nanny", correct: false },
//       { id: "attic",  label: "Attic",        bg: "bg_pr_3f_Attic",       correct: false },
//       { id: "dining", label: "Dining Room",  bg: "bg_pr_1f_Dining",      correct: true  },
//     ],
//     wrongText: "You listen carefully... no sound here.",
//   });

class PR_MusicSearchManager {
  constructor() {
    this.active = false;
    this.rooms = [];
    this.wrongText = "";
    this._feedback = null; // text shown after wrong pick
    this.onFound = null; // called when correct room clicked
    this._buttons = [];
  }

  start(opts = {}) {
    this.rooms = opts.rooms ?? [];
    this.wrongText = opts.wrongText ?? "You don\u2019t hear any sound here.";
    this._feedback = null;
    this.active = true;
    this._buildButtons();
  }

  update() {}

  render() {
    if (!this.active) return;

    push();
    fill(0, 0, 0, 180);
    noStroke();
    rect(0, 0, width, height);

    fill(240, 230, 220);
    stroke(100);
    rect(250, 160, 524, 256, 8);

    fill(40);
    noStroke();
    textSize(17);
    textAlign(CENTER, TOP);
    text("Where is the sound coming from?", 512, 175);

    if (this._feedback) {
      textSize(15);
      fill(120);
      textAlign(CENTER, CENTER);
      text(this._feedback, 512, 300);
    }
    pop();

    // Room buttons
    push();
    noStroke();
    let x = 270;
    for (const btn of this._buttons) {
      if (!btn.label) continue;
      fill(180, 160, 140);
      rect(btn.x, btn.y, btn.w, btn.h, 4);
      fill(40);
      textSize(14);
      textAlign(CENTER, CENTER);
      text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }
    pop();
  }

  mousePressed() {
    if (!this.active) return;
    for (const btn of this._buttons) {
      if (
        mouseX >= btn.x &&
        mouseX <= btn.x + btn.w &&
        mouseY >= btn.y &&
        mouseY <= btn.y + btn.h
      ) {
        btn.action();
        return;
      }
    }
  }

  _buildButtons() {
    this._buttons = [];
    const btnW = 140;
    const gap = 20;
    const totalW = this.rooms.length * btnW + (this.rooms.length - 1) * gap;
    let x = (1024 - totalW) / 2;

    for (const room of this.rooms) {
      const captured = room;
      this._buttons.push({
        x,
        y: 340,
        w: btnW,
        h: 40,
        label: room.label,
        action: () => {
          if (captured.correct) {
            this.active = false;
            this._buttons = [];
            this.onFound?.();
          } else {
            this._feedback = this.wrongText;
          }
        },
      });
      x += btnW + gap;
    }
  }
}

// ── expose globals ────────────────────────────────────────────────
window.PA_InvestigateManager = PA_InvestigateManager;
window.DIA_OptionManager = DIA_OptionManager;
window.PA_GameManager = PA_GameManager;
window.PA_DinnerManager = PA_DinnerManager;
window.PR_MusicSearchManager = PR_MusicSearchManager;
