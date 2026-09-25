/*!
 * Bring Back Flash: HTML5 player v0.1.0
 * Plays Flash-style documents (*.fla.json) in any modern browser.
 * No plugins, no WebAssembly: plain JavaScript drawing on a Canvas 2D stage.
 *
 * Usage:
 *   <flash-movie src="movie.fla.json"></flash-movie>
 *   or, as written by tools/publish.mjs, with the document inlined in a
 *   <script type="application/json"> element inside <flash-movie>.
 */
(function () {
  'use strict';

  const VERSION = '0.1.0';
  const FORMAT = 'bring-back-flash';
  const NODE = Symbol('node');                  // script-facing object -> engine node
  const TAU = Math.PI * 2;
  const GRADIENT_HALF = 819.2;                  // Flash gradients span -819.2..819.2 px
  const MAX_CANVAS_PIXELS = 16e6;               // keeps iOS canvas memory in check

  // ------------------------------------------------------------------
  // Matrices: { a, b, c, d, tx, ty } maps (x, y) to (a*x + c*y + tx, b*x + d*y + ty)
  // ------------------------------------------------------------------
  const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });

  function toMatrix(m) {
    if (!m) return IDENTITY;
    return {
      a: m.a ?? 1, b: m.b ?? 0, c: m.c ?? 0,
      d: m.d ?? 1, tx: m.tx ?? 0, ty: m.ty ?? 0,
    };
  }

  // p ∘ m: apply m first, then p
  function multiply(p, m) {
    return {
      a: p.a * m.a + p.c * m.b,
      b: p.b * m.a + p.d * m.b,
      c: p.a * m.c + p.c * m.d,
      d: p.b * m.c + p.d * m.d,
      tx: p.a * m.tx + p.c * m.ty + p.tx,
      ty: p.b * m.tx + p.d * m.ty + p.ty,
    };
  }

  function invert(m) {
    const det = m.a * m.d - m.b * m.c;
    if (!det) return null;
    return {
      a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det,
      tx: (m.c * m.ty - m.d * m.tx) / det,
      ty: (m.b * m.tx - m.a * m.ty) / det,
    };
  }

  function transformPoint(m, x, y) {
    return { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty };
  }

  function decompose(m) {
    const rotation = Math.atan2(m.b, m.a);
    return {
      x: m.tx, y: m.ty,
      scaleX: Math.hypot(m.a, m.b),
      scaleY: Math.hypot(m.c, m.d),
      rotation,
      skew: Math.atan2(-m.c, m.d) - rotation,
    };
  }

  function compose(t) {
    const yAxis = t.rotation + t.skew;
    return {
      a: t.scaleX * Math.cos(t.rotation), b: t.scaleX * Math.sin(t.rotation),
      c: -t.scaleY * Math.sin(yAxis), d: t.scaleY * Math.cos(yAxis),
      tx: t.x, ty: t.y,
    };
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapAngle = (r) => ((((r + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

  // Flash easing: -100 (ease in) .. 100 (ease out)
  function ease(t, easing) {
    const e = Math.max(-1, Math.min(1, (+easing || 0) / 100));
    return t + e * t * (1 - t);
  }

  function tweenMatrix(m0, m1, t, rotate, times) {
    const s = decompose(m0);
    const e = decompose(m1);
    let turn = e.rotation - s.rotation;
    if (rotate === 'clockwise' || rotate === 'counter-clockwise') {
      let cw = ((turn % TAU) + TAU) % TAU;         // 0..2π clockwise
      if (cw > TAU - 1e-9) cw = 0;
      if (rotate === 'clockwise') turn = cw + TAU * times;
      else turn = (cw === 0 ? 0 : cw - TAU) - TAU * times;
    } else {
      turn = wrapAngle(turn);                        // "auto": shortest way round
    }
    return compose({
      x: lerp(s.x, e.x, t),
      y: lerp(s.y, e.y, t),
      scaleX: lerp(s.scaleX, e.scaleX, t),
      scaleY: lerp(s.scaleY, e.scaleY, t),
      rotation: s.rotation + turn * t,
      skew: s.skew + wrapAngle(e.skew - s.skew) * t,
    });
  }

  // ------------------------------------------------------------------
  // Colors and color transforms (multipliers 0..1, offsets -255..255)
  // ------------------------------------------------------------------
  const NO_COLOR = Object.freeze({ rm: 1, gm: 1, bm: 1, am: 1, ro: 0, go: 0, bo: 0, ao: 0 });
  const hexCache = new Map();

  function parseHex(hex) {
    let rgb = hexCache.get(hex);
    if (rgb) return rgb;
    let h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) h = h.replace(/./g, (ch) => ch + ch);
    const n = parseInt(h.slice(0, 6), 16) || 0;
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(hex, rgb);
    return rgb;
  }

  function colorTransformFrom(c) {
    if (!c) return null;
    const cx = {
      rm: c.redMultiplier ?? 1, gm: c.greenMultiplier ?? 1, bm: c.blueMultiplier ?? 1, am: c.alphaMultiplier ?? 1,
      ro: c.redOffset ?? 0, go: c.greenOffset ?? 0, bo: c.blueOffset ?? 0, ao: c.alphaOffset ?? 0,
    };
    if (c.brightness != null) {                     // Flash "Brightness" color mode, -1..1
      const b = Math.max(-1, Math.min(1, +c.brightness));
      cx.rm = cx.gm = cx.bm = 1 - Math.abs(b);
      cx.ro = cx.go = cx.bo = b > 0 ? 255 * b : 0;
    }
    if (c.tintColor != null) {                      // Flash "Tint" color mode
      const t = Math.max(0, Math.min(1, c.tintMultiplier ?? 1));
      const [r, g, b] = parseHex(c.tintColor);
      cx.rm = cx.gm = cx.bm = 1 - t;
      cx.ro = r * t; cx.go = g * t; cx.bo = b * t;
    }
    return cx;
  }

  // apply c first, then p
  function concatColor(p, c) {
    return {
      rm: p.rm * c.rm, gm: p.gm * c.gm, bm: p.bm * c.bm, am: p.am * c.am,
      ro: p.rm * c.ro + p.ro, go: p.gm * c.go + p.go, bo: p.bm * c.bo + p.bo, ao: p.am * c.ao + p.ao,
    };
  }

  function lerpColor(a, b, t) {
    const o = {};
    for (const k in NO_COLOR) o[k] = lerp(a[k], b[k], t);
    return o;
  }

  const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

  function cssColor(hex, alpha, cx) {
    const [r, g, b] = parseHex(hex);
    const a = (alpha ?? 1) * 255;
    if (cx === NO_COLOR) return `rgba(${r},${g},${b},${+(a / 255).toFixed(3)})`;
    return `rgba(${clampByte(r * cx.rm + cx.ro)},${clampByte(g * cx.gm + cx.go)},${clampByte(b * cx.bm + cx.bo)},${+(clampByte(a * cx.am + cx.ao) / 255).toFixed(3)})`;
  }

  const isTransparent = (cx) => cx.am <= 0 && cx.ao <= 0;

  // ------------------------------------------------------------------
  // Document preparation
  // ------------------------------------------------------------------
  const scriptText = (s) => (Array.isArray(s) ? s.join('\n') : typeof s === 'string' ? s : '');

  function prepareTimeline(tl, key) {
    const layers = (tl.layers || []).map((layer) => {
      const layerType = layer.layerType || 'normal';
      const frames = (layer.frames || [])
        .map((f) => ({ ...f, index: f.index | 0, duration: Math.max(1, f.duration | 0 || 1), elements: f.elements || [] }))
        .sort((x, y) => x.index - y.index);
      return {
        name: layer.name || '',
        layerType,
        frames,
        // guide and folder layers are never published, just like in Flash;
        // mask layers are never visible (masking itself is not implemented yet)
        skip: layerType === 'guide' || layerType === 'folder' || layerType === 'mask',
      };
    });
    let frameCount = 1;
    const labels = new Map();
    for (const layer of layers) {
      for (const f of layer.frames) {
        frameCount = Math.max(frameCount, f.index + f.duration);
        if (f.name && (f.labelType || 'name') === 'name' && !labels.has(f.name)) labels.set(f.name, f.index);
      }
    }
    return { key, name: tl.name || '', layers, frameCount, labels };
  }

  function prepareDocument(doc) {
    if (!doc || typeof doc !== 'object') throw new Error('This is not a movie document.');
    if (doc.format !== FORMAT) throw new Error(`Unknown document format "${doc.format}" (expected "${FORMAT}").`);
    if ((doc.formatVersion | 0) > 1) console.warn(`[flash-movie] Document format version ${doc.formatVersion} is newer than this player (${VERSION}).`);
    const library = new Map();
    const linkage = new Map();
    for (const item of (doc.library && doc.library.items) || []) {
      const entry = {
        name: item.name,
        itemType: item.itemType,
        timeline: item.timeline ? prepareTimeline(item.timeline, 'symbol:' + item.name) : null,
      };
      library.set(item.name, entry);
      if (item.linkageExportForAS && item.linkageIdentifier) linkage.set(item.linkageIdentifier, entry);
    }
    const scenes = (doc.timelines || []).map((tl, i) => prepareTimeline(tl, 'scene:' + (tl.name || `Scene ${i + 1}`)));
    if (!scenes.length) throw new Error('The document has no timeline.');
    const html = (doc.publishSettings && doc.publishSettings.html) || {};
    return {
      name: doc.name || 'Untitled',
      width: +doc.width || 550,
      height: +doc.height || 400,
      frameRate: Math.max(1, Math.min(120, +doc.frameRate || 12)),
      backgroundColor: doc.backgroundColor || '#FFFFFF',
      scaleMode: html.scaleMode || 'showAll',
      library,
      linkage,
      scenes,
    };
  }

  function keyframeAt(layer, f) {
    for (const kf of layer.frames) {
      if (f >= kf.index && f < kf.index + kf.duration) return kf;
    }
    return null;
  }

  function nextKeyframe(layer, kf) {
    const next = layer.frames[layer.frames.indexOf(kf) + 1];
    return next && next.index === kf.index + kf.duration ? next : null;
  }

  function hasContentAt(timeline, f) {
    return timeline.layers.some((layer) => {
      if (layer.skip) return false;
      const kf = keyframeAt(layer, f);
      return !!(kf && kf.elements.length);
    });
  }

  const isInstance = (el) => el && el.elementType === 'instance';

  function kindForInstance(el, item) {
    const type = el.symbolType || item.itemType;
    return type === 'button' ? 'button' : type === 'graphic' ? 'graphic' : 'movie clip';
  }

  // ------------------------------------------------------------------
  // Shapes: fills and strokes per edge, paths in SVG path syntax
  // ------------------------------------------------------------------
  const shapeCache = new WeakMap();

  function prepareShape(el) {
    let shape = shapeCache.get(el);
    if (shape) return shape;
    const fillsByIndex = new Map((el.fills || []).map((f) => [f.index, f]));
    const strokesByIndex = new Map((el.strokes || []).map((s) => [s.index, s]));
    const fillPaths = new Map();
    const strokes = [];
    for (const edge of el.edges || []) {
      if (!edge.path) continue;
      const path = new Path2D(edge.path);
      const sides = edge.fillStyle0 === edge.fillStyle1 ? [edge.fillStyle0] : [edge.fillStyle0, edge.fillStyle1];
      for (const index of sides) {
        if (!index || !fillsByIndex.has(index)) continue;
        if (!fillPaths.has(index)) fillPaths.set(index, new Path2D());
        fillPaths.get(index).addPath(path);
      }
      const stroke = strokesByIndex.get(edge.strokeStyle);
      if (stroke && stroke.style !== 'noStroke') strokes.push({ stroke, path });
    }
    const fills = [];
    for (const [index, path] of [...fillPaths].sort((x, y) => x[0] - y[0])) {
      const fill = fillsByIndex.get(index);
      const entry = { fill, path, gradientMatrix: null, gradientPath: null };
      if (fill.style === 'linearGradient' || fill.style === 'radialGradient') {
        // Draw in gradient space: transform by the gradient matrix, fill the inversely transformed path.
        entry.gradientMatrix = toMatrix(fill.matrix);
        const inv = invert(entry.gradientMatrix);
        if (inv) {
          entry.gradientPath = new Path2D();
          entry.gradientPath.addPath(path, new DOMMatrix([inv.a, inv.b, inv.c, inv.d, inv.tx, inv.ty]));
        }
      }
      fills.push(entry);
    }
    shape = { fills, strokes };
    shapeCache.set(el, shape);
    return shape;
  }

  let hitCtx = null;
  function hitContext() {
    if (!hitCtx) hitCtx = document.createElement('canvas').getContext('2d');
    return hitCtx;
  }

  // ------------------------------------------------------------------
  // Text
  // ------------------------------------------------------------------
  const DEFAULT_TEXT_ATTRS = Object.freeze({
    face: '_sans', size: 12, bold: false, italic: false, fillColor: '#000000', alpha: 1,
    alignment: 'left', letterSpacing: 0, lineSpacing: 2,
  });

  const DEVICE_FONTS = {
    _sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    _serif: '"Times New Roman", Times, serif',
    _typewriter: '"Courier New", Courier, monospace',
  };

  function fontFor(attrs) {
    const family = DEVICE_FONTS[attrs.face] || `"${String(attrs.face).replace(/"/g, '')}", sans-serif`;
    return `${attrs.italic ? 'italic ' : ''}${attrs.bold ? 'bold ' : ''}${attrs.size}px ${family}`;
  }

  const canLetterSpace = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;

  function splitLines(runs) {
    const first = runs[0].attrs;
    const lines = [{ segs: [], size: first.size, align: first.alignment, spacing: first.lineSpacing }];
    for (const run of runs) {
      run.text.split(/\r\n|\r|\n/).forEach((part, i) => {
        if (i > 0) lines.push({ segs: [], size: run.attrs.size, align: run.attrs.alignment, spacing: run.attrs.lineSpacing });
        const line = lines[lines.length - 1];
        line.size = Math.max(line.size, run.attrs.size);
        if (part) line.segs.push({ text: part, attrs: run.attrs, width: 0 });
      });
    }
    return lines;
  }

  // ------------------------------------------------------------------
  // Script-facing objects (what ActionScript-style code sees)
  // ------------------------------------------------------------------
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const DEG = 180 / Math.PI;

  function MovieClip() {}
  function SimpleButton() {}
  function TextField() {}

  const transformProps = {
    _x: {
      get() { return this[NODE].matrix.tx; },
      set(v) { const n = this[NODE]; n.setMatrix({ ...n.matrix, tx: num(v) }); },
    },
    _y: {
      get() { return this[NODE].matrix.ty; },
      set(v) { const n = this[NODE]; n.setMatrix({ ...n.matrix, ty: num(v) }); },
    },
    _rotation: {
      get() { return decompose(this[NODE].matrix).rotation * DEG; },
      set(v) { const n = this[NODE]; const t = decompose(n.matrix); t.rotation = num(v) / DEG; n.setMatrix(compose(t)); },
    },
    _xscale: {
      get() { return decompose(this[NODE].matrix).scaleX * 100; },
      set(v) { const n = this[NODE]; const t = decompose(n.matrix); t.scaleX = num(v) / 100; n.setMatrix(compose(t)); },
    },
    _yscale: {
      get() { return decompose(this[NODE].matrix).scaleY * 100; },
      set(v) { const n = this[NODE]; const t = decompose(n.matrix); t.scaleY = num(v) / 100; n.setMatrix(compose(t)); },
    },
    _alpha: {
      get() { const c = this[NODE].color; return (c ? c.am : 1) * 100; },
      set(v) { const n = this[NODE]; n.color = { ...(n.color || NO_COLOR), am: num(v) / 100 }; n.player.invalidate(); },
    },
    _visible: {
      get() { return this[NODE].visible; },
      set(v) { const n = this[NODE]; n.visible = !!v; n.player.invalidate(); },
    },
    _name: { get() { return this[NODE].name; } },
    _parent: { get() { const p = this[NODE].parent; return p ? p.facade : undefined; } },
    _root: { get() { return this[NODE].player.root.facade; } },
    _xmouse: { get() { return this[NODE].localPointer().x; } },
    _ymouse: { get() { return this[NODE].localPointer().y; } },
  };

  Object.defineProperties(MovieClip.prototype, transformProps);
  Object.defineProperties(SimpleButton.prototype, transformProps);
  Object.defineProperties(TextField.prototype, transformProps);

  MovieClip.prototype.enabled = true;
  MovieClip.prototype.useHandCursor = true;
  MovieClip.prototype.hitArea = null;
  SimpleButton.prototype.enabled = true;
  SimpleButton.prototype.useHandCursor = true;

  Object.defineProperties(MovieClip.prototype, {
    _currentframe: { get() { return this[NODE].currentFrame + 1; } },
    _totalframes: { get() { return this[NODE].timeline.frameCount; } },
    _framesloaded: { get() { return this[NODE].timeline.frameCount; } },
  });

  Object.assign(MovieClip.prototype, {
    play() { this[NODE].playing = true; },
    stop() { this[NODE].playing = false; },
    gotoAndPlay(frame) { this[NODE].goto(frame, true); },
    gotoAndStop(frame) { this[NODE].goto(frame, false); },
    nextFrame() { const n = this[NODE]; n.goto(n.currentFrame + 2, false); },
    prevFrame() { const n = this[NODE]; n.goto(n.currentFrame, false); },
    attachMovie(id, name, depth, init) { return this[NODE].attachMovie(id, name, depth, init); },
    removeMovieClip() { this[NODE].removeSelf(); },
    hitTest(x, y) {
      const n = this[NODE];
      if (typeof x === 'object') {
        n.player.warnOnce('hitTest(target) is not supported yet; use hitTest(x, y, true).');
        return false;
      }
      return n.player.hitNode(n, num(x), num(y), n.parent ? n.parent.worldMatrix() : IDENTITY, false);
    },
    localToGlobal(point) { const p = transformPoint(this[NODE].worldMatrix(), num(point.x), num(point.y)); point.x = p.x; point.y = p.y; },
    globalToLocal(point) {
      const inv = invert(this[NODE].worldMatrix());
      if (!inv) return;
      const p = transformPoint(inv, num(point.x), num(point.y));
      point.x = p.x; point.y = p.y;
    },
  });

  Object.defineProperties(TextField.prototype, {
    text: {
      get() { const n = this[NODE]; const v = n.boundValue(); return v !== undefined ? String(v) : n.plainText(); },
      set(v) { this[NODE].setText(String(v)); },
    },
  });

  function makeFacade(Ctor, node) {
    const f = Object.create(Ctor.prototype);
    Object.defineProperty(f, NODE, { value: node });
    return f;
  }

  const HANDLERS = ['onPress', 'onRelease', 'onReleaseOutside', 'onRollOver', 'onRollOut', 'onDragOver', 'onDragOut'];
  const isInteractive = (f) => HANDLERS.some((h) => typeof f[h] === 'function');

  // ------------------------------------------------------------------
  // Engine nodes (the display list)
  // ------------------------------------------------------------------
  class DisplayNode {
    constructor(player, kind, el) {
      this.player = player;
      this.kind = kind;
      this.el = el || null;
      this.parent = null;
      this.name = (el && el.name) || '';
      this.matrix = IDENTITY;
      this.color = null;
      this.visible = true;
      this.userTransformed = false;   // once a script moves it, the timeline stops moving it (like Flash)
      this.destroyed = false;
      this.as = null;
    }

    get facade() {
      if (!this.as) this.as = this.createFacade();
      return this.as;
    }

    createFacade() { return null; }

    setMatrix(m) {
      this.matrix = m;
      this.userTransformed = true;
      this.player.invalidate();
    }

    worldMatrix() {
      let m = this.matrix;
      for (let p = this.parent; p; p = p.parent) m = multiply(p.matrix, m);
      return m;
    }

    localPointer() {
      const inv = invert(this.worldMatrix());
      const p = this.player.pointer;
      return inv ? transformPoint(inv, p.x, p.y) : { x: 0, y: 0 };
    }

    destroy() { this.destroyed = true; }
  }

  class ShapeNode extends DisplayNode {
    constructor(player, el) {
      super(player, 'shape', el);
      this.shape = prepareShape(el);
    }

    render(ctx, pm, pcx) {
      if (!this.visible) return;
      const m = multiply(pm, this.matrix);
      const cx = this.color ? concatColor(pcx, this.color) : pcx;
      if (isTransparent(cx)) return;
      ctx.setTransform(m.a, m.b, m.c, m.d, m.tx, m.ty);
      for (const f of this.shape.fills) {
        const fill = f.fill;
        if (f.gradientMatrix) {
          if (!f.gradientPath) continue;
          const g = f.gradientMatrix;
          ctx.save();
          ctx.transform(g.a, g.b, g.c, g.d, g.tx, g.ty);
          const grad = fill.style === 'linearGradient'
            ? ctx.createLinearGradient(-GRADIENT_HALF, 0, GRADIENT_HALF, 0)
            : ctx.createRadialGradient((+fill.focalPointRatio || 0) * GRADIENT_HALF, 0, 0, 0, 0, GRADIENT_HALF);
          for (const e of fill.entries || []) {
            grad.addColorStop(Math.max(0, Math.min(1, +e.ratio || 0)), cssColor(e.color, e.alpha, cx));
          }
          ctx.fillStyle = grad;
          ctx.fill(f.gradientPath, 'evenodd');
          ctx.restore();
        } else if (!fill.style || fill.style === 'solid') {
          ctx.fillStyle = cssColor(fill.color, fill.alpha, cx);
          ctx.fill(f.path, 'evenodd');
        }
      }
      for (const s of this.shape.strokes) {
        const k = s.stroke;
        ctx.lineWidth = k.thickness > 0 ? k.thickness : 1 / Math.sqrt(Math.abs(m.a * m.d - m.b * m.c) || 1);
        ctx.lineJoin = k.joinType || 'round';
        ctx.lineCap = k.capType === 'none' ? 'butt' : k.capType || 'round';
        ctx.miterLimit = k.miterLimit || 3;
        ctx.strokeStyle = cssColor(k.color, k.alpha, cx);
        ctx.stroke(s.path);
      }
    }

    hitTest(x, y, m) {
      const inv = invert(m);
      if (!inv) return false;
      const p = transformPoint(inv, x, y);
      const ctx = hitContext();
      for (const f of this.shape.fills) if (ctx.isPointInPath(f.path, p.x, p.y, 'evenodd')) return true;
      for (const s of this.shape.strokes) {
        ctx.lineWidth = Math.max(1, s.stroke.thickness || 1);
        ctx.lineJoin = s.stroke.joinType || 'round';
        if (ctx.isPointInStroke(s.path, p.x, p.y)) return true;
      }
      return false;
    }
  }

  class TextNode extends DisplayNode {
    constructor(player, el) {
      super(player, 'text', el);
      this.width = +el.width || 100;
      this.height = +el.height || 20;
      this.runs = (el.textRuns || []).map((r) => ({
        text: String(r.characters ?? ''),
        attrs: { ...DEFAULT_TEXT_ATTRS, ...(r.textAttrs || {}) },
      }));
      if (!this.runs.length) this.runs.push({ text: '', attrs: { ...DEFAULT_TEXT_ATTRS } });
      this.override = null;
    }

    createFacade() { return makeFacade(TextField, this); }

    plainText() { return this.override ?? this.runs.map((r) => r.text).join(''); }

    // Flash MX "Var:" binding: the field shows a timeline variable
    variablePath() {
      const path = this.el.variableName && String(this.el.variableName).split('.');
      if (!path || !this.parent) return null;
      let target = this.parent.facade;
      for (let i = 0; i < path.length - 1 && target != null; i++) target = target[path[i]];
      return target == null ? null : { target, key: path[path.length - 1] };
    }

    boundValue() {
      const v = this.variablePath();
      return v ? v.target[v.key] : undefined;
    }

    setText(text) {
      const v = this.variablePath();
      if (v) v.target[v.key] = text;
      else this.override = text;
      this.player.invalidate();
    }

    displayRuns() {
      const bound = this.boundValue();
      if (bound !== undefined) return [{ text: String(bound), attrs: this.runs[0].attrs }];
      if (this.override !== null) return [{ text: this.override, attrs: this.runs[0].attrs }];
      return this.runs;
    }

    render(ctx, pm, pcx) {
      if (!this.visible) return;
      const m = multiply(pm, this.matrix);
      const cx = this.color ? concatColor(pcx, this.color) : pcx;
      if (isTransparent(cx)) return;
      ctx.setTransform(m.a, m.b, m.c, m.d, m.tx, m.ty);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      let y = 2;                                           // Flash text fields have a 2 px gutter
      for (const line of splitLines(this.displayRuns())) {
        let lineWidth = 0;
        for (const seg of line.segs) {
          ctx.font = fontFor(seg.attrs);
          if (canLetterSpace) ctx.letterSpacing = `${+seg.attrs.letterSpacing || 0}px`;
          seg.width = ctx.measureText(seg.text).width;
          lineWidth += seg.width;
        }
        let x = line.align === 'center' ? (this.width - lineWidth) / 2 : line.align === 'right' ? this.width - 2 - lineWidth : 2;
        const baseline = y + line.size * 0.9;
        for (const seg of line.segs) {
          ctx.font = fontFor(seg.attrs);
          if (canLetterSpace) ctx.letterSpacing = `${+seg.attrs.letterSpacing || 0}px`;
          ctx.fillStyle = cssColor(seg.attrs.fillColor, seg.attrs.alpha, cx);
          ctx.fillText(seg.text, x, baseline);
          x += seg.width;
        }
        y += line.size * 1.15 + (+line.spacing || 0);
      }
      if (canLetterSpace) ctx.letterSpacing = '0px';
    }

    hitTest(x, y, m) {
      const inv = invert(m);
      if (!inv) return false;
      const p = transformPoint(inv, x, y);
      return p.x >= 0 && p.y >= 0 && p.x <= this.width && p.y <= this.height;
    }
  }

  // Movie clips, buttons, graphic symbols and the main timeline
  class ClipNode extends DisplayNode {
    constructor(player, timeline, kind, el) {
      super(player, kind, el);
      this.timeline = timeline;
      this.currentFrame = -1;
      this.playing = kind === 'root' || kind === 'movie clip';
      this.slots = [];              // one per layer: { keyframe, objects }
      this.dynamic = [];            // clips from attachMovie(), sorted by depth
      this.depth = null;
      this.born = player.tickCount;
      this.hitTree = null;
      this.scopeProxy = null;
    }

    createFacade() {
      return makeFacade(this.kind === 'button' ? SimpleButton : MovieClip, this);
    }

    // Build the display list for frame f. Newly created clips are collected in `created`
    // so their first-frame scripts can run after the parent's script (Flash order).
    buildFrame(f, created) {
      const changed = f !== this.currentFrame;
      this.currentFrame = f;
      const layers = this.timeline.layers;
      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        if (layer.skip) continue;
        const kf = keyframeAt(layer, f);
        const slot = this.slots[li] || (this.slots[li] = { keyframe: null, objects: [] });
        if (slot.keyframe !== kf) this.swapKeyframe(slot, kf, created);
        if (!kf) continue;
        if (kf.tweenType === 'motion') this.applyTween(layer, kf, slot, f);
        for (const obj of slot.objects) {
          if (obj.kind === 'graphic') obj.syncGraphic(f - kf.index, created);
        }
      }
      if (changed) this.player.invalidate();
      return changed;
    }

    swapKeyframe(slot, kf, created) {
      const old = slot.objects;
      const next = [];
      const elements = kf ? kf.elements : [];
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        let obj = null;
        const prev = old[i];
        // Keep the same instance across keyframes (so nested animations keep running)
        if (prev && isInstance(el) && isInstance(prev.el) && prev.el.libraryItemName === el.libraryItemName &&
            (prev.el.name || '') === (el.name || '') && prev.kind === this.player.kindFor(el)) {
          obj = prev;
          old[i] = null;
          obj.el = el;
        } else {
          obj = this.player.createNode(el);
          if (!obj) continue;
          this.adopt(obj);
          if (obj instanceof ClipNode && obj.kind !== 'graphic') {
            created.push(obj);
            obj.buildFrame(0, created);
          }
        }
        if (!obj.userTransformed) {
          obj.matrix = toMatrix(el.matrix);
          obj.color = colorTransformFrom(el.color);
        }
        next.push(obj);
      }
      for (const obj of old) if (obj) this.release(obj);
      slot.keyframe = kf;
      slot.objects = next;
    }

    applyTween(layer, kf, slot, f) {
      const end = nextKeyframe(layer, kf);
      if (!end) return;
      const a = kf.elements.find(isInstance);
      const b = end.elements.find(isInstance);
      if (!a || !b || a.libraryItemName !== b.libraryItemName) return;
      const obj = slot.objects.find((o) => o.el === a);
      if (!obj || obj.userTransformed) return;
      const t = ease((f - kf.index) / (end.index - kf.index), kf.tweenEasing);
      obj.matrix = tweenMatrix(toMatrix(a.matrix), toMatrix(b.matrix), t, kf.motionTweenRotate, Math.max(0, kf.motionTweenRotateTimes | 0));
      const ca = colorTransformFrom(a.color);
      const cb = colorTransformFrom(b.color);
      obj.color = ca || cb ? lerpColor(ca || NO_COLOR, cb || NO_COLOR, t) : null;
    }

    // Graphic symbols follow the parent's playhead (loop / play once / single frame)
    syncGraphic(offset, created) {
      const el = this.el || {};
      const total = this.timeline.frameCount;
      const first = Math.max(0, Math.min(total - 1, el.firstFrame | 0));
      const mode = el.loop || 'loop';
      let f = first;
      if (mode === 'loop') f = (first + offset) % total;
      else if (mode === 'play once') f = Math.min(first + offset, total - 1);
      if (f !== this.currentFrame) this.buildFrame(f, created);
    }

    adopt(obj) {
      obj.parent = this;
      if (obj.name && obj.kind !== 'shape' && obj.kind !== 'graphic') this.registerName(obj.name, obj);
    }

    release(obj) {
      if (obj.name) this.unregisterName(obj.name, obj);
      obj.parent = null;
      obj.destroy();
      this.player.forget(obj);
    }

    registerName(name, obj) {
      const f = obj.facade;
      if (f) Object.defineProperty(this.facade, name, { value: f, writable: true, configurable: true, enumerable: true });
    }

    unregisterName(name, obj) {
      const facade = this.facade;
      if (Object.prototype.hasOwnProperty.call(facade, name) && facade[name] === obj.as) delete facade[name];
    }

    enterFrame(f) {
      const created = [];
      if (this.buildFrame(f, created)) this.queueScripts(f);
      for (const c of created) c.queueScripts(c.currentFrame);
    }

    queueScripts(f) {
      if (this.kind !== 'root' && this.kind !== 'movie clip') return;
      const layers = this.timeline.layers;
      for (let li = 0; li < layers.length; li++) {
        const kf = keyframeAt(layers[li], f);
        if (kf && kf.index === f && kf.actionScript) {
          const fn = this.player.scriptFor(this.timeline, li, kf);
          if (fn) this.player.enqueue(this, fn, `${this.timeline.name || 'timeline'} › ${layers[li].name} › frame ${f + 1}`);
        }
      }
    }

    step() {
      let next = this.currentFrame + 1;
      if (next >= this.timeline.frameCount) next = 0;
      if (next !== this.currentFrame) this.enterFrame(next);
    }

    resolveFrame(frame) {
      if (typeof frame === 'string') {
        if (this.timeline.labels.has(frame)) return this.timeline.labels.get(frame);
        const n = Number(frame);
        if (!frame.trim() || !Number.isFinite(n)) return -1;
        frame = n;
      }
      const index = Math.floor(num(frame)) - 1;           // ActionScript frame numbers start at 1
      return Math.max(0, Math.min(this.timeline.frameCount - 1, index));
    }

    goto(frame, play) {
      if (this.kind !== 'root' && this.kind !== 'movie clip') return;
      const index = this.resolveFrame(frame);
      if (index < 0) {
        this.player.warnOnce(`There is no frame labeled "${frame}".`);
        return;
      }
      this.playing = play;
      if (index !== this.currentFrame) this.enterFrame(index);
    }

    showState(frame) {
      while (frame > 0 && !hasContentAt(this.timeline, frame)) frame--;
      if (frame === this.currentFrame) return;
      const created = [];
      this.buildFrame(frame, created);
      for (const c of created) c.queueScripts(c.currentFrame);
    }

    getHitTree() {
      if (!this.hitTree) {
        let frame = Math.min(3, this.timeline.frameCount - 1);
        while (frame > 0 && !hasContentAt(this.timeline, frame)) frame--;
        this.hitTree = new ClipNode(this.player, this.timeline, 'hit', null);
        this.hitTree.buildFrame(frame, []);
      }
      return this.hitTree;
    }

    attachMovie(id, name, depth, init) {
      const item = this.player.doc.linkage.get(id) || this.player.doc.library.get(id);
      if (!item || !item.timeline || item.itemType !== 'movie clip') {
        this.player.warnOnce(`attachMovie: no movie clip exported as "${id}".`);
        return undefined;
      }
      depth = num(depth) | 0;
      const existing = this.dynamic.find((o) => o.depth === depth);
      if (existing) this.removeDynamic(existing);
      const clip = new ClipNode(this.player, item.timeline, 'movie clip', { elementType: 'instance', libraryItemName: item.name, name: String(name) });
      clip.depth = depth;
      let at = this.dynamic.findIndex((o) => o.depth > depth);
      if (at < 0) at = this.dynamic.length;
      this.dynamic.splice(at, 0, clip);
      this.adopt(clip);
      if (init && typeof init === 'object') for (const key of Object.keys(init)) clip.facade[key] = init[key];
      const created = [clip];
      clip.buildFrame(0, created);
      for (const c of created) c.queueScripts(c.currentFrame);
      this.player.invalidate();
      return clip.facade;
    }

    removeSelf() {
      if (this.depth === null || !this.parent) {
        this.player.warnOnce('removeMovieClip() only removes clips created with attachMovie().');
        return;
      }
      this.parent.removeDynamic(this);
    }

    removeDynamic(clip) {
      const i = this.dynamic.indexOf(clip);
      if (i >= 0) this.dynamic.splice(i, 1);
      this.release(clip);
      this.player.invalidate();
    }

    childClips() {
      const out = [];
      for (const slot of this.slots) {
        if (slot) for (const o of slot.objects) if (o instanceof ClipNode) out.push(o);
      }
      return out.concat(this.dynamic);
    }

    destroy() {
      if (this.destroyed) return;
      super.destroy();
      for (const slot of this.slots) if (slot) for (const o of slot.objects) o.destroy();
      for (const o of this.dynamic) o.destroy();
      this.slots = [];
      this.dynamic = [];
    }

    render(ctx, pm, pcx) {
      if (!this.visible) return;
      const m = multiply(pm, this.matrix);
      const cx = this.color ? concatColor(pcx, this.color) : pcx;
      if (isTransparent(cx)) return;
      for (let li = this.slots.length - 1; li >= 0; li--) {       // bottom layer first
        const slot = this.slots[li];
        if (slot) for (const o of slot.objects) o.render(ctx, m, cx);
      }
      for (const o of this.dynamic) o.render(ctx, m, cx);
    }

    // The `with` scope for frame scripts: timeline variables, instance names and global functions
    scope() {
      if (this.scopeProxy) return this.scopeProxy;
      const facade = this.facade;
      const api = this.player.apiFor(this);
      this.scopeProxy = new Proxy(Object.create(null), {
        has(_, key) {
          if (typeof key !== 'string' || key === '__scope__') return false;
          if (key in api || key in facade) return true;
          return !(key in globalThis);      // unknown names become timeline variables, as in ActionScript 1
        },
        get(_, key) {
          if (typeof key !== 'string') return undefined;
          return key in api ? api[key] : facade[key];
        },
        set(_, key, value) {
          facade[key] = value;
          return true;
        },
      });
      return this.scopeProxy;
    }
  }

  // ------------------------------------------------------------------
  // Keyboard (Key.isDown)
  // ------------------------------------------------------------------
  const keysDown = new Set();
  let lastKeyCode = 0;
  let keyboardReady = false;

  function listenToKeyboard() {
    if (keyboardReady) return;
    keyboardReady = true;
    window.addEventListener('keydown', (e) => { keysDown.add(e.keyCode); lastKeyCode = e.keyCode; });
    window.addEventListener('keyup', (e) => keysDown.delete(e.keyCode));
    window.addEventListener('blur', () => keysDown.clear());
  }

  const Key = Object.freeze({
    BACKSPACE: 8, TAB: 9, ENTER: 13, SHIFT: 16, CONTROL: 17, CAPSLOCK: 20, ESCAPE: 27, SPACE: 32,
    PGUP: 33, PGDN: 34, END: 35, HOME: 36, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, INSERT: 45, DELETEKEY: 46,
    isDown: (code) => keysDown.has(code),
    getCode: () => lastKeyCode,
  });

  // ------------------------------------------------------------------
  // Player
  // ------------------------------------------------------------------
  class Player {
    constructor(host, data, compiledScripts) {
      this.host = host;
      this.doc = prepareDocument(data);
      this.compiled = compiledScripts || null;
      this.stage = Object.freeze({ width: this.doc.width, height: this.doc.height, scaleMode: this.doc.scaleMode });
      this.frameMs = 1000 / this.doc.frameRate;
      this.startTime = performance.now();
      this.tickCount = 0;
      this.queue = [];
      this.running = false;
      this.dirty = true;
      this.destroyed = false;
      this.intervals = new Set();
      this.warned = new Set();
      this.scriptCache = new Map();
      this.pointer = { x: 0, y: 0 };
      this.pressed = null;
      this.pressedOver = false;
      this.hovered = null;
      this.baseMatrix = IDENTITY;
      this.fitted = false;
      this.last = null;
      this.acc = 0;

      this.setupStage();
      listenToKeyboard();

      this.root = new ClipNode(this, this.doc.scenes[0], 'root', null);
      if (this.doc.scenes.length > 1) this.warnOnce('Only the first scene is played for now.');
      const timelines = this.doc.scenes.concat([...this.doc.library.values()].map((item) => item.timeline).filter(Boolean));
      if (timelines.some((tl) => tl.layers.some((layer) => layer.layerType === 'mask'))) {
        this.warnOnce('Mask layers are hidden but do not mask yet; masked layers are drawn unmasked.');
      }
      this.root.born = -1;
      const created = [this.root];
      this.root.buildFrame(0, created);
      for (const c of created) c.queueScripts(c.currentFrame);
      this.runQueue();

      this.fit();
      this.loop = this.loop.bind(this);
      this.raf = requestAnimationFrame(this.loop);
    }

    // ----- stage & scaling -----
    setupStage() {
      const shadow = this.host.shadowRoot || this.host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>
        :host { display: block; position: relative; overflow: hidden; aspect-ratio: ${this.doc.width} / ${this.doc.height};
          -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
        canvas { position: absolute; display: block; touch-action: none; outline: none; }
        .error { position: absolute; left: 8px; right: 8px; bottom: 8px; margin: 0; padding: 6px 8px; border-radius: 4px;
          font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace; color: #fff; background: rgba(150, 0, 0, 0.9); white-space: pre-wrap; }
        .error[hidden] { display: none; }
      </style><canvas part="stage" role="img"></canvas><p class="error" role="alert" hidden></p>`;
      this.canvas = shadow.querySelector('canvas');
      this.canvas.setAttribute('aria-label', this.host.getAttribute('aria-label') || this.doc.name);
      this.ctx = this.canvas.getContext('2d');
      this.errorBox = shadow.querySelector('.error');

      this.onDown = this.onDown.bind(this);
      this.onMove = this.onMove.bind(this);
      this.onUp = this.onUp.bind(this);
      this.onCancel = this.onCancel.bind(this);
      this.onLeave = this.onLeave.bind(this);
      this.fit = this.fit.bind(this);
      this.canvas.addEventListener('pointerdown', this.onDown);
      this.canvas.addEventListener('pointermove', this.onMove);
      this.canvas.addEventListener('pointerup', this.onUp);
      this.canvas.addEventListener('pointercancel', this.onCancel);
      this.canvas.addEventListener('pointerleave', this.onLeave);
      this.resizeObserver = new ResizeObserver(this.fit);
      this.resizeObserver.observe(this.host);
      window.addEventListener('resize', this.fit);        // catches devicePixelRatio changes (zoom)
    }

    // Flash scale modes: showAll (letterbox), noBorder (crop), exactFit (stretch), noScale
    fit() {
      if (this.destroyed) return;
      const W = this.host.clientWidth;
      const H = this.host.clientHeight;
      if (!W || !H) return;
      const w = this.doc.width;
      const h = this.doc.height;
      let sx;
      let sy;
      switch (this.doc.scaleMode) {
        case 'noScale': sx = sy = 1; break;
        case 'exactFit': sx = W / w; sy = H / h; break;
        case 'noBorder': sx = sy = Math.max(W / w, H / h); break;
        default: sx = sy = Math.min(W / w, H / h);
      }
      const cssW = w * sx;
      const cssH = h * sy;
      let dpr = window.devicePixelRatio || 1;
      if (cssW * cssH * dpr * dpr > MAX_CANVAS_PIXELS) dpr = Math.sqrt(MAX_CANVAS_PIXELS / (cssW * cssH));
      const pw = Math.max(1, Math.round(cssW * dpr));
      const ph = Math.max(1, Math.round(cssH * dpr));
      const style = this.canvas.style;
      style.width = `${cssW}px`;
      style.height = `${cssH}px`;
      style.left = `${(W - cssW) / 2}px`;
      style.top = `${(H - cssH) / 2}px`;
      if (this.canvas.width !== pw || this.canvas.height !== ph) {
        this.canvas.width = pw;
        this.canvas.height = ph;
      }
      this.baseMatrix = { a: pw / w, b: 0, c: 0, d: ph / h, tx: 0, ty: 0 };
      this.fitted = true;
      this.render();
    }

    // ----- main loop -----
    loop(now) {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(this.loop);
      if (this.last === null) this.last = now;
      let dt = now - this.last;
      this.last = now;
      if (dt > 250) dt = this.frameMs;          // back from a hidden tab: don't fast-forward
      this.acc += dt;
      let steps = 0;
      while (this.acc >= this.frameMs) {
        this.acc -= this.frameMs;
        if (steps++ < 3) this.tick();
      }
      if (this.dirty && this.fitted) this.render();
    }

    tick() {
      this.tickCount++;
      this.advance(this.root);
      this.runQueue();
      this.broadcastEnterFrame(this.root);
      this.runQueue();
    }

    advance(node) {
      if (node.destroyed) return;
      if (node.playing && node.born < this.tickCount && (node.kind === 'movie clip' || node.kind === 'root')) node.step();
      for (const child of node.childClips()) this.advance(child);
    }

    broadcastEnterFrame(node) {
      if (node.destroyed) return;
      const f = node.as;
      if (f && typeof f.onEnterFrame === 'function') {
        this.execute(() => f.onEnterFrame(), `onEnterFrame of ${node.name || 'movie clip'}`);
        this.invalidate();
      }
      for (const child of node.childClips()) this.broadcastEnterFrame(child);
    }

    invalidate() { this.dirty = true; }

    render() {
      this.dirty = false;
      const { ctx, canvas } = this;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.doc.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this.root.render(ctx, this.baseMatrix, NO_COLOR);
    }

    // ----- display list helpers -----
    kindFor(el) {
      const item = this.doc.library.get(el.libraryItemName);
      return item ? kindForInstance(el, item) : null;
    }

    createNode(el) {
      switch (el.elementType) {
        case 'shape': return new ShapeNode(this, el);
        case 'text': return new TextNode(this, el);
        case 'instance': {
          const item = this.doc.library.get(el.libraryItemName);
          if (!item || !item.timeline) {
            this.warnOnce(`Library item "${el.libraryItemName}" is missing.`);
            return null;
          }
          return new ClipNode(this, item.timeline, kindForInstance(el, item), el);
        }
        default:
          this.warnOnce(`Elements of type "${el.elementType}" are not supported yet.`);
          return null;
      }
    }

    // Forget pointer state that points into a removed part of the display list
    forget(node) {
      const inside = (n) => { for (let p = n; p; p = p.parent) if (p === node) return true; return false; };
      if (this.pressed && (this.pressed === node || this.pressed.destroyed || inside(this.pressed))) this.pressed = null;
      if (this.hovered && (this.hovered === node || this.hovered.destroyed || inside(this.hovered))) this.hovered = null;
    }

    // ----- scripts -----
    scriptFor(timeline, layerIndex, kf) {
      const key = `${timeline.key}/${layerIndex}/${kf.index}`;
      if (this.scriptCache.has(key)) return this.scriptCache.get(key);
      let fn = (this.compiled && this.compiled[key]) || null;
      if (!fn) {
        try {
          // eslint-disable-next-line no-new-func
          fn = new Function('__scope__', `with (__scope__) {\n${scriptText(kf.actionScript)}\n}`);
        } catch (err) {
          this.report(err, `${timeline.name || 'timeline'}, frame ${kf.index + 1}`);
          fn = null;
        }
      }
      this.scriptCache.set(key, fn);
      return fn;
    }

    enqueue(clip, fn, where) {
      this.queue.push({ clip, fn, where });
    }

    runQueue() {
      if (this.running) return;
      this.running = true;
      let guard = 0;
      try {
        while (this.queue.length) {
          const { clip, fn, where } = this.queue.shift();
          if (clip.destroyed) continue;
          if (++guard > 5000) {
            this.report(new Error('Too many frame scripts in a row; stopped to avoid an endless loop.'), where);
            this.queue.length = 0;
            break;
          }
          this.execute(() => fn.call(clip.facade, clip.scope()), where);
        }
      } finally {
        this.running = false;
      }
      this.invalidate();
    }

    execute(run, where) {
      try {
        run();
      } catch (err) {
        this.report(err, where);
      }
    }

    apiFor(clip) {
      const player = this;
      const f = clip.facade;
      return Object.assign(Object.create(null), {
        stop: () => f.stop(),
        play: () => f.play(),
        gotoAndStop: (frame) => f.gotoAndStop(frame),
        gotoAndPlay: (frame) => f.gotoAndPlay(frame),
        nextFrame: () => f.nextFrame(),
        prevFrame: () => f.prevFrame(),
        attachMovie: (id, name, depth, init) => f.attachMovie(id, name, depth, init),
        removeMovieClip: (target) => {
          const t = target === undefined ? f : typeof target === 'string' ? f[target] : target;
          if (t && typeof t.removeMovieClip === 'function') t.removeMovieClip();
        },
        trace: (...args) => console.log('[trace]', ...args),
        getTimer: () => Math.round(performance.now() - player.startTime),
        random: (n) => Math.floor(Math.random() * num(n)),
        setInterval: (fn, ms, ...args) => player.setInterval(fn, ms, args),
        clearInterval: (id) => player.clearInterval(id),
        getURL: (url, target) => {
          const href = String(url);
          if (!/^(https?:|mailto:)/i.test(href)) return player.warnOnce('getURL only opens http(s) and mailto links.');
          window.open(href, target || '_self');
        },
        Stage: player.stage,
        Key,
      });
    }

    setInterval(fn, ms, args) {
      if (typeof fn !== 'function') return 0;
      const id = window.setInterval(() => {
        if (this.destroyed) return;
        this.execute(() => fn.apply(null, args), 'setInterval callback');
        this.runQueue();
      }, Math.max(1, num(ms)));
      this.intervals.add(id);
      return id;
    }

    clearInterval(id) {
      window.clearInterval(id);
      this.intervals.delete(id);
    }

    report(err, where) {
      console.error(`[flash-movie] Error in ${where}:`, err);
      if (this.errorBox) {
        this.errorBox.textContent = `${where}: ${(err && err.message) || err}`;
        this.errorBox.hidden = false;
      }
    }

    warnOnce(message) {
      if (this.warned.has(message)) return;
      this.warned.add(message);
      console.warn(`[flash-movie] ${message}`);
    }

    // ----- hit testing -----
    hitNode(node, x, y, pm, ignoreVisible) {
      if (!node || node.destroyed || (!ignoreVisible && !node.visible)) return false;
      const m = multiply(pm, node.matrix);
      if (node instanceof ClipNode) {
        for (const slot of node.slots) {
          if (slot) for (const o of slot.objects) if (this.hitNode(o, x, y, m, false)) return true;
        }
        for (const o of node.dynamic) if (this.hitNode(o, x, y, m, false)) return true;
        return false;
      }
      return node.hitTest(x, y, m);
    }

    findTarget(x, y) {
      return this.findIn(this.root, x, y, IDENTITY);
    }

    // Topmost button or clickable movie clip under the point
    findIn(clip, x, y, pm) {
      if (!clip.visible) return null;
      const m = multiply(pm, clip.matrix);
      for (let i = clip.dynamic.length - 1; i >= 0; i--) {
        const t = this.targetAt(clip.dynamic[i], x, y, m);
        if (t) return t;
      }
      for (const slot of clip.slots) {                 // top layer first
        if (!slot) continue;
        for (let j = slot.objects.length - 1; j >= 0; j--) {
          const t = this.targetAt(slot.objects[j], x, y, m);
          if (t) return t;
        }
      }
      return null;
    }

    targetAt(node, x, y, pm) {
      if (!(node instanceof ClipNode) || !node.visible) return null;
      const f = node.as;
      if (node.kind === 'button') {
        if (f && f.enabled === false) return null;
        return this.hitNode(node.getHitTree(), x, y, multiply(pm, node.matrix), true) ? node : null;
      }
      if (node.kind === 'movie clip' && f && isInteractive(f)) {
        if (f.enabled === false) return null;
        const area = f.hitArea && f.hitArea[NODE];
        const hit = area
          ? this.hitNode(area, x, y, area.parent ? area.parent.worldMatrix() : IDENTITY, true)
          : this.hitNode(node, x, y, pm, false);
        return hit ? node : null;
      }
      return this.findIn(node, x, y, pm);
    }

    // ----- pointer input (mouse, touch and pen) -----
    toStage(e) {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * this.doc.width) / (r.width || 1),
        y: ((e.clientY - r.top) * this.doc.height) / (r.height || 1),
      };
    }

    setState(node, state) {
      if (!node || node.destroyed) return;
      if (node.kind === 'button') node.showState(state === 'over' ? 1 : state === 'down' ? 2 : 0);
      else if (node.kind === 'movie clip' && node.timeline.labels.has('_' + state)) node.goto('_' + state, false);
      this.invalidate();
    }

    callHandler(node, name) {
      const f = node && !node.destroyed ? node.as : null;
      if (!f || typeof f[name] !== 'function') return;
      this.execute(() => f[name](), `${name} of ${node.name || node.kind}`);
      this.invalidate();
    }

    updateCursor(target) {
      const hand = !!target && !(target.as && target.as.useHandCursor === false);
      this.canvas.style.cursor = hand ? 'pointer' : '';
    }

    rollTo(target) {
      if (target === this.hovered) return;
      const old = this.hovered;
      this.hovered = target;
      if (old && !old.destroyed) {
        this.setState(old, 'up');
        this.callHandler(old, 'onRollOut');
      }
      if (target) {
        this.setState(target, 'over');
        this.callHandler(target, 'onRollOver');
      }
    }

    onDown(e) {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* not critical */ }
      this.pointer = this.toStage(e);
      const target = this.findTarget(this.pointer.x, this.pointer.y);
      if (target) {
        this.pressed = target;
        this.pressedOver = true;
        this.setState(target, 'down');
        this.callHandler(target, 'onPress');
      }
      this.runQueue();
    }

    onMove(e) {
      if (!e.isPrimary) return;
      this.pointer = this.toStage(e);
      const target = this.findTarget(this.pointer.x, this.pointer.y);
      if (this.pressed) {
        const over = target === this.pressed;
        if (over !== this.pressedOver) {
          this.pressedOver = over;
          this.setState(this.pressed, over ? 'down' : 'up');
          this.callHandler(this.pressed, over ? 'onDragOver' : 'onDragOut');
        }
      } else if (e.pointerType === 'mouse') {
        this.rollTo(target);
      }
      this.updateCursor(target);
      this.runQueue();
    }

    onUp(e) {
      if (!e.isPrimary) return;
      this.pointer = this.toStage(e);
      const target = this.findTarget(this.pointer.x, this.pointer.y);
      const pressed = this.pressed;
      this.pressed = null;
      if (pressed && !pressed.destroyed) {
        if (target === pressed) {
          this.setState(pressed, e.pointerType === 'mouse' ? 'over' : 'up');
          this.callHandler(pressed, 'onRelease');
        } else {
          this.setState(pressed, 'up');
          this.callHandler(pressed, 'onReleaseOutside');
        }
      }
      this.runQueue();
      if (e.pointerType === 'mouse') {
        const now = this.findTarget(this.pointer.x, this.pointer.y);
        this.rollTo(now);
        this.updateCursor(now);
        this.runQueue();
      } else {
        this.hovered = null;
        this.updateCursor(null);
      }
    }

    onCancel() {
      if (this.pressed) this.setState(this.pressed, 'up');
      this.pressed = null;
      this.hovered = null;
      this.updateCursor(null);
    }

    onLeave(e) {
      if (e.pointerType !== 'mouse' || this.pressed) return;
      this.rollTo(null);
      this.updateCursor(null);
      this.runQueue();
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      cancelAnimationFrame(this.raf);
      this.resizeObserver.disconnect();
      window.removeEventListener('resize', this.fit);
      for (const id of this.intervals) window.clearInterval(id);
      this.root.destroy();
    }
  }

  // ------------------------------------------------------------------
  // <flash-movie> element
  // ------------------------------------------------------------------
  class FlashMovieElement extends HTMLElement {
    connectedCallback() {
      if (this.player || this.starting) return;
      this.starting = true;
      const start = () => this.start();
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
      else Promise.resolve().then(start);
    }

    disconnectedCallback() {
      if (this.player) this.player.destroy();
      this.player = null;
    }

    async start() {
      this.starting = false;
      if (!this.isConnected || this.player) return;
      try {
        let data;
        const src = this.getAttribute('src');
        if (src) {
          const res = await fetch(src);
          if (!res.ok) throw new Error(`Could not load ${src} (HTTP ${res.status}).`);
          data = await res.json();
        } else {
          const inline = this.querySelector('script[type="application/json"]');
          if (!inline) throw new Error('No movie: add src="movie.fla.json" or an inline JSON script.');
          data = JSON.parse(inline.textContent);
        }
        this.player = new Player(this, data, this.frameScripts || null);
      } catch (err) {
        console.error('[flash-movie]', err);
        const shadow = this.shadowRoot || this.attachShadow({ mode: 'open' });
        shadow.innerHTML = '<p style="margin:0;padding:12px;font:14px/1.4 system-ui,sans-serif;color:#fff;background:#900"></p>';
        shadow.querySelector('p').textContent = `This movie could not be played: ${err.message}`;
      }
    }
  }

  if (!customElements.get('flash-movie')) customElements.define('flash-movie', FlashMovieElement);

  window.BringBackFlash = Object.freeze({ version: VERSION, Player, prepareDocument });
})();
