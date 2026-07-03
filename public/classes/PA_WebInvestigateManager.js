// PA_WebInvestigateManager.js
// Extracted from StateManagers.js — a self-contained scene/activity manager.

// ── PA_WEB_INVESTIGATE ───────────────────────────────────────────
// Spider-web investigation overlay.
// Displays a line-art bg, animates a spider web, then reveals object images
// when the player activates "WEB VISION" and clicks each object.
// Fires onAllSeen() once every object has been interacted with.
//
// Config example:
//   pa_webInvestigateMgr.start({
//     bg: "assets/bg/bg_pa_1f_Kitchen_ItemLine.png",
//     webCenter: { x: 545, y: 208 },
//     objects: [
//       {
//         name: "window",
//         imgLine: "assets/inv_obj/obtLine_ktcn_01_Window.png",
//         imgFull: "assets/inv_obj/obt_ktcn_01_Window.png",
//         img: { x: 483, y: 104, w: 123, h: 106.66 },
//         text: "The window is open, letting in a slight breeze.",
//       },
//       {
//         name: "recipe book",
//         imgLine: "...", imgFull: "...",
//         img: { x: 510, y: 213, w: 70, h: 58.17 },
//         text: "You see a book near the window.",
//         subOptions: [
//           { label: "Read the book",  text: "There are no pictures at all..." },
//           { label: "Close the book", text: "The cover shows that it is a recipe book." },
//         ],
//       },
//     ],
//   });

class PA_WebInvestigateManager {
  static ANIM_SPEED = 0.05;
  static THREAD_ANIM_SPEED = 0.15;
  static DIM_ALPHA = 180;
  static DIM_FADE_SPEED = 20;

  // Description text box geometry — matches Dialog's VN text region.
  static TEXT_RECT = { x: 195, y: 450, w: 640, h: 100 };
  static TEXT_SIZE = 20;
  static TEXT_LEAD = 23;
  static DONE_LINE =
    "It seems like I have investigated all the items you are interested in.";

  constructor() {
    this.active = false;
    this.onAllSeen = null;

    // Runtime state
    // "start"  — tiny "web vision" hint, waiting for first click
    // "web"    — web animates, objects are clickable
    // "option" — an item with subOptions is being chosen (oval chooser)
    // "detail" — an item's description shows in the VN text box
    // "complete" — the final "all investigated" line, then hand off
    this._phase = "start";
    this._config = null;
    this._bgImg = null;

    // Description text box (reuses VN-style typewriter + blinking arrow)
    this._typer = new Typewriter({ charMs: 20, punctExtraMs: 80 });
    this._arrow = new Blinker({ periodMs: 900 });
    this._detailText = "";

    // Internal option chooser for items with subOptions (oval + tags UI).
    this._optionMgr = new DIA_OptionManager();

    // Decorative frames: investigate frame while scanning, VN frame during text.
    this._investigateFrame = null;
    this._vnFrame = null;

    // Advance indicator image (replaces the ">" glyph)
    this._arrowImg = null;

    // Web geometry
    this._rings = 0;
    this._spokes = 0;
    this._noiseOff = 0;
    this._webPoints = [];
    this._segStyles = [];
    this._rects = [];
    this._progress = 0;
    this._animating = false;
    this._threadsBuilt = false;
    this._currentDim = 0;
    this._fadingIn = false;

    // Seen tracking
    this._seenSet = new Set();

    // Detail
    this._selObj = null; // rect ref currently shown in the text box

    // Asset cache (preloaded by caller)
    this._imgCache = {};
    this._font = null;
  }

  // Call in main preload() for each config you plan to use.
  preload(config) {
    if (!config) return;
    if (config.bg) this._imgCache[config.bg] = loadImage(config.bg);
    for (const obj of config.objects || []) {
      if (obj.imgLine) this._imgCache[obj.imgLine] = loadImage(obj.imgLine);
      if (obj.imgFull) this._imgCache[obj.imgFull] = loadImage(obj.imgFull);
    }
    if (!this._font) this._font = loadFont("assets/fonts/Forum-Regular.ttf");

    // Frames + chooser assets (load once — guard against repeat configs).
    // Investigate VN text is narration only (no speaker), so use the nameless VN frame.
    if (!this._vnFrame)
      this._vnFrame = loadImage("assets/ui/ui_dia_decor_frame_noName.png");
    if (!this._investigateFrame)
      this._investigateFrame = loadImage(
        "assets/ui/ui_investigate_decor_frame.png",
      );
    if (!this._arrowImg)
      this._arrowImg = loadImage("assets/ui/ui_text_spiderBlinker.png");
    if (!this._optionMgr._tagLeft) this._optionMgr.preload();
  }

  start(config) {
    this._config = config;
    this._bgImg = this._imgCache[config.bg] || null;
    this._phase = "start";
    this._progress = 0;
    this._animating = false;
    this._threadsBuilt = false;
    this._currentDim = 0;
    this._fadingIn = false;
    this._rects = [];
    this._webPoints = [];
    this._segStyles = [];
    this._seenSet = new Set();
    this._selObj = null;
    this._detailText = "";
    this._optionMgr.active = false;

    // Attach cached images to each object
    for (const obj of config.objects || []) {
      obj._imgLine = this._imgCache[obj.imgLine] || null;
      obj._imgFull = this._imgCache[obj.imgFull] || null;
    }

    this.active = true;
  }

  // ── update ───────────────────────────────────────────────────────
  update() {
    if (!this.active) return;

    // Text box (description / completion line)
    if (this._phase === "detail" || this._phase === "complete") {
      this._typer.update();
      this._arrow.setEnabled(!this._typer.typing);
      this._arrow.update();
      return;
    }

    // Sub-option chooser
    if (this._phase === "option") {
      this._optionMgr.update();
      return;
    }

    if (this._phase !== "web") return;

    if (
      this._fadingIn &&
      this._currentDim < PA_WebInvestigateManager.DIM_ALPHA
    ) {
      this._currentDim = Math.min(
        PA_WebInvestigateManager.DIM_ALPHA,
        this._currentDim + PA_WebInvestigateManager.DIM_FADE_SPEED,
      );
      if (this._currentDim >= PA_WebInvestigateManager.DIM_ALPHA)
        this._fadingIn = false;
    }

    if (this._animating) {
      this._progress += PA_WebInvestigateManager.ANIM_SPEED;
      if (this._progress >= 1) {
        this._progress = 1;
        this._animating = false;
        if (!this._threadsBuilt) {
          for (const rec of this._rects) {
            rec.threads = this._buildThreadsQuad(rec.quad, rec.w, rec.h);
            rec.threadProgress = 0;
          }
          this._threadsBuilt = true;
        }
      }
    }

    if (this._threadsBuilt) {
      for (const rec of this._rects) {
        if (rec.threadProgress < 1)
          rec.threadProgress = Math.min(
            1,
            rec.threadProgress + PA_WebInvestigateManager.THREAD_ANIM_SPEED,
          );
      }
    }
  }

  // ── render ───────────────────────────────────────────────────────
  render() {
    if (!this.active) return;

    background(12, 12, 18);
    if (this._bgImg) image(this._bgImg, 0, 0, width, height);

    // "start": scene + investigate frame + tiny hint, waiting for first click.
    if (this._phase === "start") {
      this._drawFrame(this._investigateFrame);
      this._drawActivateHint();
      return;
    }

    // Dim overlay (web vision active)
    push();
    noStroke();
    fill(12, 12, 18, this._currentDim);
    rect(0, 0, width, height);
    pop();

    this._drawWeb();
    this._drawRects();
    this._drawObjects();

    // Frame: investigate frame while scanning; VN frame during text / choice.
    const textPhase =
      this._phase === "detail" ||
      this._phase === "complete" ||
      this._phase === "option";
    this._drawFrame(textPhase ? this._vnFrame : this._investigateFrame);

    if (this._phase === "option") this._optionMgr.render();
    if (this._phase === "detail" || this._phase === "complete")
      this._drawTextBox();
  }

  _drawFrame(img) {
    if (!img) return;
    push();
    image(img, 0, 0, width, height);
    pop();
  }

  // ── input ────────────────────────────────────────────────────────
  mousePressed() {
    if (!this.active) return;

    // "start": any click activates web vision.
    if (this._phase === "start") {
      this._phase = "web";
      this._currentDim = 0;
      this._fadingIn = true;
      this._generateWeb();
      return;
    }

    // "web": click a revealed object → its description (or sub-option chooser).
    if (this._phase === "web" && this._threadsBuilt) {
      for (const rec of this._rects) {
        if (
          rec.threadProgress >= 1 &&
          this._ptInImg(mouseX, mouseY, rec.objRef.img)
        ) {
          this._selObj = rec;
          const subs = rec.objRef.subOptions;
          if (subs && subs.length) {
            // Defer description to the chosen sub-option's text.
            this._optionMgr.onFinish = (chosenText) => {
              this._showDetail(chosenText ?? rec.objRef.text);
            };
            this._optionMgr.start({ choices: subs });
            this._phase = "option";
          } else {
            this._showDetail(rec.objRef.text);
          }
          return;
        }
      }
      return;
    }

    // "option": delegate clicks to the oval chooser.
    if (this._phase === "option") {
      this._optionMgr.mousePressed();
      return;
    }

    // "detail" / "complete": advance the text box.
    if (this._phase === "detail" || this._phase === "complete") {
      if (this._typer.typing) {
        this._typer.revealAll();
        this._arrow.reset();
        return;
      }
      if (this._phase === "complete") {
        // Final line dismissed — hand off to the next scene (afternoon/dinner).
        this.active = false;
        this.onAllSeen?.();
        return;
      }
      // Description dismissed — mark seen, then continue or finish.
      this._markSeen();
      if (this._seenSet.size >= (this._config?.objects || []).length) {
        this._phase = "complete";
        this._beginText(PA_WebInvestigateManager.DONE_LINE);
      } else {
        this._selObj = null;
        this._phase = "web";
      }
      return;
    }
  }

  // Enter the "detail" phase, showing `txt` in the VN text box.
  _showDetail(txt) {
    this._phase = "detail";
    this._beginText(txt);
  }

  _beginText(txt) {
    this._detailText = String(txt || "");
    this._typer.start(this._detailText);
    this._arrow.setEnabled(false);
  }

  _markSeen() {
    if (!this._selObj) return;
    const name = this._selObj.objRef.name;
    this._selObj.clicked = true;
    if (this._seenSet.has(name)) return;
    this._seenSet.add(name);
  }

  // ── description text box (VN-style) ───────────────────────────────
  _drawTextBox() {
    const tr = PA_WebInvestigateManager.TEXT_RECT;
    push();
    if (this._font) textFont(this._font);
    noStroke();
    fill(0xf0, 0xf0, 0xf0);
    textSize(PA_WebInvestigateManager.TEXT_SIZE);
    textLeading(PA_WebInvestigateManager.TEXT_LEAD);
    textAlign(LEFT, TOP);
    textWrap(WORD);
    text(this._typer.visibleText, tr.x, tr.y, tr.w, tr.h);

    // Blinking advance indicator (spider image, anchored bottom-right)
    if (!this._typer.typing && this._arrowImg) {
      tint(255, this._arrow.alpha);
      image(this._arrowImg, 843 - 24, 525 - 30, 24, 24);
      noTint();
    }
    pop();
  }

  // ── tiny "web vision" activation hint (bottom-center) ─────────────
  _drawActivateHint() {
    push();
    if (this._font) textFont(this._font);
    noStroke();
    const pulse = 150 + 80 * (0.5 - 0.5 * Math.cos(millis() / 500));
    fill(200, 210, 255, pulse);
    textAlign(CENTER, BOTTOM);
    textSize(20);
    textLeading(22);
    text("click to activate \nWEB VISION", width / 2, height - 15);
    pop();
  }

  // ── object images ────────────────────────────────────────────────
  _drawObjects() {
    if (!this._threadsBuilt) return;
    for (const rec of this._rects) {
      if (rec.threadProgress < 1) continue;
      const img = rec.clicked ? rec.objRef._imgFull : rec.objRef._imgLine;
      if (!img) continue;
      const d = rec.objRef.img;
      push();
      image(img, d.x, d.y, d.w, d.h);
      pop();
    }
  }

  // ── web generation ───────────────────────────────────────────────
  _generateWeb() {
    this._rects = [];
    this._webPoints = [];
    this._segStyles = [];
    this._rings = floor(random(8, 15));
    this._spokes = floor(random(9, 18));
    this._noiseOff = random(1000);
    this._progress = 0;
    this._animating = true;
    this._threadsBuilt = false;

    const cx = this._config?.webCenter?.x ?? width * 0.53;
    const cy = this._config?.webCenter?.y ?? height * 0.36;
    const maxR = max(width, height) * 0.82;

    let angles = [],
      running = 0;
    for (let s = 0; s < this._spokes; s++) {
      running += (TWO_PI / this._spokes) * random(0.55, 1.6);
      angles.push(running);
    }
    const norm = TWO_PI / running;
    angles = angles.map((a) => a * norm);

    for (let s = 0; s < this._spokes; s++) {
      const col = [],
        lenMult = random(0.7, 1.15);
      for (let r = 0; r <= this._rings; r++) {
        const t = r / this._rings;
        const radWobble = map(
          noise(this._noiseOff + s * 0.7, r * 0.5),
          0,
          1,
          0.75,
          1.28,
        );
        const rad = t * maxR * lenMult * radWobble;
        const latDrift =
          map(
            noise(this._noiseOff + s * 1.3, r * 0.9 + 99),
            0,
            1,
            -0.12,
            0.12,
          ) * t;
        col.push({
          x: cx + cos(angles[s] + latDrift) * rad,
          y: cy + sin(angles[s] + latDrift) * rad,
          dx: 0,
          dy: 0,
        });
      }
      this._webPoints.push(col);
    }

    for (let r = 1; r <= this._rings; r++) {
      const row = [];
      for (let s = 0; s < this._spokes; s++)
        row.push({
          alphaMult: random(0.75, 1.1),
          weightMult: random(0.6, 1.4),
          sag: random(0.04, 0.14),
        });
      this._segStyles.push(row);
    }

    for (const obj of this._config?.objects || []) {
      if (!obj.img || (obj.img.w === 0 && obj.img.h === 0)) continue;
      const d = obj.img;
      const pts = [
        { x: d.x, y: d.y },
        { x: d.x + d.w, y: d.y },
        { x: d.x, y: d.y + d.h },
        { x: d.x + d.w, y: d.y + d.h },
      ];
      this._rects.push({
        quad: pts,
        w: d.w,
        h: d.h,
        threads: [],
        threadProgress: 0,
        objRef: obj,
        clicked: false,
      });
      this._deformWeb(d.x + d.w / 2, d.y + d.h / 2, d.w, d.h);
    }
  }

  _deformWeb(cx, cy, w, h) {
    const hw = w / 2,
      hh = h / 2;
    const halfMax = max(hw, hh);
    const influence = max(w, h) * 2.2;
    for (const col of this._webPoints) {
      for (const pt of col) {
        const d = dist(cx, cy, pt.x, pt.y);
        if (d < influence) {
          const force =
            d < halfMax
              ? map(d, 0, halfMax, 18, 6)
              : map(d, halfMax, influence, -3, 0);
          const angle = atan2(pt.y - cy, pt.x - cx);
          pt.dx += cos(angle) * force;
          pt.dy += sin(angle) * force;
        }
      }
    }
  }

  _buildThreadsQuad(pts, w, h) {
    const threads = [];
    const maxDist = max(width, height) * 0.3;
    const [tl, tr, bl, br] = pts;
    const anchors = [];
    const area = w * h;
    const steps = area < 2000 ? 2 : area < 6000 ? 3 : 5;
    const perAnchor = area < 2000 ? 1 : area < 6000 ? 2 : 3;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      anchors.push([lerp(tl.x, tr.x, t), lerp(tl.y, tr.y, t)]);
      anchors.push([lerp(bl.x, br.x, t), lerp(bl.y, br.y, t)]);
      anchors.push([lerp(tl.x, bl.x, t), lerp(tl.y, bl.y, t)]);
      anchors.push([lerp(tr.x, br.x, t), lerp(tr.y, br.y, t)]);
    }

    for (const [ax, ay] of anchors) {
      const candidates = [];
      for (const col of this._webPoints) {
        for (const pt of col) {
          const d = dist(ax, ay, pt.x, pt.y);
          if (d < maxDist) candidates.push({ pt, d });
        }
      }
      candidates.sort((a, b) => a.d - b.d);
      for (const { pt, d } of candidates.slice(0, perAnchor)) {
        threads.push({
          ax,
          ay,
          bx: pt.x + random(-6, 6),
          by: pt.y + random(-6, 6),
          sag: random(0.04, 0.16),
          alpha: map(d, 0, maxDist, 200, 40),
          weight: random(0.3, 0.8),
        });
      }
    }
    return threads;
  }

  // ── web drawing ──────────────────────────────────────────────────
  _drawWeb() {
    noFill();
    const spokeT = min(1, this._progress / 0.35);
    const showSpokes = floor(spokeT * this._spokes);
    const spokeFrac = (spokeT * this._spokes) % 1;

    for (let s = 0; s < showSpokes + 1; s++) {
      if (s >= this._spokes) break;
      const frac = s < showSpokes ? 1 : spokeFrac;
      for (let r = 0; r < this._rings; r++) {
        const t = r / this._rings;
        stroke(200, 210, 255, lerp(210, 45, t));
        strokeWeight(lerp(1.4, 0.35, t));
        const ax = this._webPoints[s][r].x + this._webPoints[s][r].dx;
        const ay = this._webPoints[s][r].y + this._webPoints[s][r].dy;
        const bx = this._webPoints[s][r + 1].x + this._webPoints[s][r + 1].dx;
        const by = this._webPoints[s][r + 1].y + this._webPoints[s][r + 1].dy;
        line(ax, ay, lerp(ax, bx, frac), lerp(ay, by, frac));
        if (frac < 1) break;
      }
    }

    const ringT =
      this._progress > 0.35 ? min(1, (this._progress - 0.35) / 0.65) : 0;
    const showRings = floor(ringT * this._rings);
    const ringFrac = (ringT * this._rings) % 1;

    for (let r = 1; r <= showRings + 1; r++) {
      if (r > this._rings) break;
      const frac = r <= showRings ? 1 : ringFrac;
      const t = r / this._rings;
      const baseA = lerp(185, 35, t);
      const baseW = lerp(1.0, 0.3, t);
      const segsShow = floor(frac * this._spokes);
      const segFrac = (frac * this._spokes) % 1;

      for (let s = 0; s < segsShow + 1; s++) {
        if (s >= this._spokes) break;
        const sf = s < segsShow ? 1 : segFrac;
        const next = (s + 1) % this._spokes;
        const style = this._segStyles[r - 1][s];
        const ax = this._webPoints[s][r].x + this._webPoints[s][r].dx;
        const ay = this._webPoints[s][r].y + this._webPoints[s][r].dy;
        const nbx = this._webPoints[next][r].x + this._webPoints[next][r].dx;
        const nby = this._webPoints[next][r].y + this._webPoints[next][r].dy;
        const bx = lerp(ax, nbx, sf),
          by = lerp(ay, nby, sf);

        stroke(200, 210, 255, baseA * style.alphaMult);
        strokeWeight(baseW * style.weightMult);

        const mx = (ax + bx) / 2,
          my = (ay + by) / 2;
        const dx = bx - ax,
          dy = by - ay;
        const len = sqrt(dx * dx + dy * dy) || 1;

        beginShape();
        vertex(ax, ay);
        quadraticVertex(
          mx + (-dy / len) * len * style.sag * sf,
          my + (dx / len) * len * style.sag * sf,
          bx,
          by,
        );
        endShape();
      }
    }

    // Center dot
    noStroke();
    fill(210, 215, 255, 200);
    if (this._webPoints[0]?.[0]) {
      circle(this._webPoints[0][0].x, this._webPoints[0][0].y, 4);
    }
  }

  _drawRects() {
    for (const rec of this._rects) {
      noFill();
      const p = rec.threadProgress ?? 1;
      for (const th of rec.threads) {
        stroke(200, 210, 255, th.alpha);
        strokeWeight(th.weight);
        const ex = lerp(th.ax, th.bx, p),
          ey = lerp(th.ay, th.by, p);
        const emx = (th.ax + ex) / 2,
          emy = (th.ay + ey) / 2;
        const edx = ex - th.ax,
          edy = ey - th.ay;
        const elen = sqrt(edx * edx + edy * edy) || 1;
        beginShape();
        vertex(th.ax, th.ay);
        quadraticVertex(
          emx + (-edy / elen) * elen * th.sag * p,
          emy + (edx / elen) * elen * th.sag * p,
          ex,
          ey,
        );
        endShape();
      }
    }
  }

  // ── helpers ──────────────────────────────────────────────────────
  _ptInImg(px, py, d) {
    return px >= d.x && px <= d.x + d.w && py >= d.y && py <= d.y + d.h;
  }
}

// ── expose global ─────────────────────────────────────────────────
window.PA_WebInvestigateManager = PA_WebInvestigateManager;
