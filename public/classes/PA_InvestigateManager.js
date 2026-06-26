// PA_InvestigateManager.js
// Extracted from StateManagers.js — a self-contained scene/activity manager.

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

// ── expose global ─────────────────────────────────────────────────
window.PA_InvestigateManager = PA_InvestigateManager;
