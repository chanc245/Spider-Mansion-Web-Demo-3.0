// PR_MusicSearchManager.js
// Extracted from StateManagers.js — a self-contained scene/activity manager.

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

// ── expose global ─────────────────────────────────────────────────
window.PR_MusicSearchManager = PR_MusicSearchManager;
