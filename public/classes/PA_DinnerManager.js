// PA_DinnerManager.js
// Extracted from StateManagers.js — a self-contained scene/activity manager.

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

// ── expose global ─────────────────────────────────────────────────
window.PA_DinnerManager = PA_DinnerManager;
