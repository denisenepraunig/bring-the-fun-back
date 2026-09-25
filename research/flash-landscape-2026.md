# 🎬 Bringing back Flash — landscape & options (Sep 2026)

Research notes: what exists today for making Flash-style vector animations and
little games for the web, and how a modern, open-source "Flash MX" could be built.

## TL;DR

- 🟢 **Closest open-source Flash today: [Next2D](https://next2d.app/en/)** (MIT). Browser-based
  Animation Tool with timeline, layers, mask layers, motion tweens, onion skin, a library,
  and JavaScript frame scripts (`this` = the MovieClip). It comes with a WebGL/WebGPU player
  that grew out of swf2js. Under active development, but the community is small and the
  drawing tools are basic.
- 🟡 **Most "Flash for everyone" feeling: [Wick Editor](https://www.wickeditor.com/)** (GPL-3.0).
  Runs in the browser, has Clips and Buttons, JavaScript scripting, and HTML export. The last
  release was Dec 2023, and the community fork
  [Candlestick](https://github.com/Candlestickers/Candlestick) carries it on.
- 🔵 **Most powerful modern successor: [Rive](https://rive.app).** Vector animation, state
  machines, and, since Jan 2026, **Luau scripting** for games and interactive apps. The runtimes
  are MIT, but the editor is proprietary and exporting needs a paid plan.
- 🟠 **The real Flash descendant: Adobe Animate.** It has been in **maintenance mode** since
  Feb 2026 and gets no new features.
- 🦀 **Playing SWFs today: [Ruffle](https://ruffle.rs)** (Rust → WebAssembly). It supports
  AS1/2 almost fully and AS3 mostly.
- 🧩 **The gap:** no open-source browser tool has fully rebuilt the *Flash MX drawing feel*
  (merge drawing, paint bucket, shape tweens) together with symbols, a timeline and scripting
  in one place.

## 🧠 Flash MX refresher: what we want back

| Concept | Flash MX | Notes for a rebuild |
|---|---|---|
| Symbols | **Movie Clip**, **Button**, **Graphic** | Graphic is the "forgotten third" symbol. It plays in sync with the parent timeline and has no scripts or instance control of its own |
| Button states | Up / Over / Down / Hit frames | Hit = the invisible clickable area |
| Timeline | frames, keyframes, blank keyframes, labels, frame scripts | `stop()`, `gotoAndPlay("label")` |
| Layers | normal, guide (motion path), mask, folders | |
| Tweens | motion tween, shape tween (+ shape hints) | shape tween = path morphing |
| Drawing | *merge drawing*: shapes cut and merge each other, fills and strokes can be selected separately, paint bucket, pencil smoothing, 5 brush modes | this is the "feel" of Flash (Object Drawing only arrived in Flash 8) |
| Scripting | ActionScript on frames, buttons (`on (release)`) and clips (`onClipEvent`) | |
| Publishing | `.swf` + HTML embed | one small file to share |

## 🧰 Options today

### 1. Flash-style authoring tools (editor + timeline + symbols + scripting → web)

| Tool | License | Runs in | Scripting | Status (Sep 2026) | Flash-likeness (my rating) |
|---|---|---|---|---|---|
| Next2D Animation Tool + Player | MIT | Browser | JavaScript frame scripts | Active | ⭐⭐⭐⭐ |
| Wick Editor | GPL-3.0 | Browser + desktop | JavaScript | Last release 1.19.0 (Dec 2023) | ⭐⭐⭐⭐ |
| Candlestick (Wick fork) | GPL-3.0 | Browser | JavaScript | Community-maintained | ⭐⭐⭐⭐ |
| Adobe Animate | Proprietary (subscription) | Desktop | JS (HTML5 Canvas / CreateJS), AS3 | Maintenance mode since Feb 2026 | ⭐⭐⭐⭐⭐ |
| Rive | Editor proprietary, runtimes MIT | Browser + desktop | Luau (since Jan 2026) | Very active | ⭐⭐⭐ (different paradigm: state machines) |
| "Building a Better Flash" (Bill Premo) | Not stated | Desktop (C# / Avalonia / SkiaSharp) | C# via Roslyn | Early, Patreon-funded (Mar 2026) | ⭐⭐⭐⭐⭐ (goal) |
| KoolMoves | Proprietary (low cost) | Windows | JS / CreateJS | Last update ~2022 | ⭐⭐⭐ |
| Tumult Hype | Proprietary | macOS | JavaScript | – | ⭐⭐ (HTML/DOM-based) |

**Next2D.** Built on the emulation tech of swf2js. It has three parts:

- **Player:** a WebGL/WebGPU/OffscreenCanvas renderer with Flash-like shapes, filters (blur,
  glow, drop shadow) and blend modes.
- **Animation Tool:** hosted at [tool.next2d.app](https://tool.next2d.app/). It has normal and
  mask layers, keyframes, labels, motion and custom tweens, onion skin, and JavaScript per frame
  with `this` bound to the MovieClip. The library takes images, mp3, mp4 and **SWF**. It
  exports JSON, WebM, APNG and GIF.
- **Framework:** MVVM, for bigger apps (`npx create-next2d-app`). A multi-platform builder is
  also available.

Drawing tools are the selection, shape-transform, pen, text and rectangle/ellipse tools. No
Flash-style brush, pencil or paint bucket is listed. → The best base to contribute to if you
want MIT plus a Flash-API runtime.

**Wick Editor / Candlestick.** Built for accessibility and learning, and funded by Mozilla Open
Source Support among others. It has drawing tools, a timeline with layers, Clips and Buttons,
JavaScript scripting, tweens, and export to HTML, ZIP, GIF and video. It is built on paper.js.
Upstream has been quiet since 1.19.0 (Dec 2023). Candlestick, a fork by the forum's moderation
team, continues with fixes. Users often mention performance on complex projects as a weak spot.

**Rive.** A vector editor with timelines, state machines, bones and meshes, data binding, and
**scripting in Luau**. Scripts follow "protocols" (Node, Layout, PathEffect, Converter, Test)
and are used for games, physics and particles. Runtimes exist for web (WASM), iOS, Android,
Flutter, React, Unity and Unreal, and the web runtime is MIT. Pricing (Sep 2026): the Free plan
cannot export; Cadet is $9/seat/mo, Voyager $32 and Enterprise $120. It isn't centered on
frame-by-frame drawing, and the closed editor means lock-in.

**Adobe Animate.** This is Flash Professional, renamed in 2016. In early Feb 2026 Adobe
announced it would be discontinued, then reversed the decision within days. It is now in
maintenance mode: security and bug fixes only. It exports HTML5 Canvas (using the CreateJS
runtime) and can still publish SWF/AIR.

**Bill Premo's project.** A desktop app in C#, Avalonia and SkiaSharp. Its vector
engine is based on a DCEL (doubly-connected edge list) and replicates Flash's **merge drawing**
and all **five paint modes**. It has keyframes, frame-by-frame animation and onion skin, plus
Roslyn-based scripting. The discussion around it says it compiles to modern web tech. It is
early and funded through Patreon, and its open-source status is unclear. Worth watching.

### 2. Play SWF on the modern web

**Ruffle** is a Flash Player emulator written in Rust and compiled to WASM. It ships as a
browser extension, a self-hosted JS player and a desktop app. Compatibility:

| | Language | API |
|---|---|---|
| AVM1 (AS1/2) | 99% | 82% |
| AVM2 (AS3) | 90% | 82% |

→ You *could* author in any tool that produces SWF (Animate, old Flash MX/8/CS6, Haxe/OpenFL,
Apache Flex) and publish with Ruffle. That's great for preservation. As a pipeline for new
work, it ties you to a frozen format and to closed or legacy authoring tools.

### 3. Interactive animation (not really made for games)

- **Lottie Creator + dotLottie v2 state machines.** A web editor where states and transitions
  (hover, click and so on) live inside the `.lottie` file. The dotlottie-web player uses
  Rust + WASM with ThorVG and can render with WebGL or WebGPU. There is no real scripting.
  Lottie itself is an open spec (Lottie Animation Community).
- **Tumult Hype** (Mac) and **SVGator** (web): timeline tools for web animations.
- **Theatre.js:** a code-driven timeline editor for JS objects and Three.js. Development moved
  to a private repo on the way to 1.0.

### 4. Pure animation tools (no interactivity), possible building blocks

- **Synfig**, **Glaxnimate** (KDE; exports Lottie and SVG), **OpenToonz / Tahoma2D**, and
  **Blender Grease Pencil**.
- **Graphite:** an open-source (Apache-2.0), node-based vector editor in Rust/WASM that runs in
  the browser. A keyframe timeline with a dopesheet and curves is planned for **late 2026**
  (funded by NGI0).

### 5. Game-first engines (mostly raster)

- **Phaser** (+ Phaser Editor), **Construct 3**, **GDevelop** (MIT), and **Godot** (MIT). Godot
  has a timeline via AnimationPlayer and exports to the web, but vectors are a second-class
  citizen there.
- **Scratch / TurboWarp:** a vector paint editor (built on paper.js) plus block scripting. The
  TurboWarp packager turns a project into a single HTML file. There's no timeline, but it is
  very "make a little game in an afternoon".

### 6. Code-first building blocks

| Library | What it gives you |
|---|---|
| **OpenFL** (v9.5.x) | A reimplementation of the Flash API (`Sprite`, `MovieClip`, `Graphics`, events) in Haxe, JS or TS, targeting HTML5 and native. It can use SWF assets from Animate |
| **PixiJS v8** (8.19) | A WebGPU/WebGL 2D renderer with vector `Graphics` and SVG import/export |
| **GSAP** | Timeline tweening and MorphSVG. **100% free** since Apr 2025, plugins included |
| **ThorVG 1.0** | A C++/WASM vector engine (SVG, Lottie) with production-ready WebGL and WebGPU backends |
| **Vello** | A Rust vector renderer with CPU, hybrid (WebGL2) and GPU-compute variants |
| **Rive runtime / renderer** | An open-source (MIT) C++ runtime and renderer |
| **paper.js** | Vector editing: boolean ops and hit testing. Used by Wick and by Scratch's paint editor |

## 🛠️ What could be built: an "Open Flash" blueprint

### Architecture

```
┌──────── Editor (TypeScript web app / PWA, optional Tauri desktop) ────────┐
│  Stage · Tools · Timeline · Library · Properties · Actions (Monaco)       │
│                        │                                                  │
│  Document model (JSON, CRDT-ready) · undo/redo · autosave (IndexedDB/OPFS)│
└────────────────────────┼──────────────────────────────────────────────────┘
                         │ publish
                         ▼
  movie.json / .zip bundle ──► Player runtime (small JS lib, <flash-movie> web component)
                               display list · timeline engine · tween engine
                               renderer (Canvas2D → WebGL/WebGPU) · Web Audio · input
                               script sandbox (ActionScript-flavored JS API)
```

The editor and the player share the same document model and rendering code. Previewing
("Test Movie", Ctrl+Enter 😉) simply runs the player.

### Key pieces and tech choices

| Piece | Suggested approach | Why |
|---|---|---|
| Language | TypeScript everywhere (editor and runtime share code) | one codebase, runs in the browser |
| Vector model | Flash-style **planar map** (DCEL: each edge knows the fill on its left and right, like SWF `DefineShape`), plus an optional "object drawing" mode | enables merge drawing, paint bucket on any closed region, and strokes and fills that can be selected separately |
| Geometry | paper.js / Clipper2 boolean ops, bezier.js, perfect-freehand for brush strokes, curve fitting for pencil smoothing | proven libraries |
| Stage rendering | Canvas2D `Path2D` first (crisp, aware of devicePixelRatio, simple), then WebGL/WebGPU (PixiJS v8 / ThorVG / Vello) | Flash-era content is light; switch to the GPU when needed |
| Symbols | MovieClip (own timeline), Button (Up/Over/Down/Hit), Graphic (synced) | faithful mental model |
| Timeline | layers (normal/guide/mask/folder), keyframes, labels, motion tweens (matrix + color transform + easing), shape tweens (path morphing with shape hints), onion skin | |
| Scripting | JS/TS with an ActionScript-flavored API: `stop()`, `gotoAndPlay()`, `this.on("release")`, `onEnterFrame`, `hitTest()`, `startDrag()`. Monaco editor with typings; optionally Blockly for kids | familiar and modern |
| Sandbox | published movies run in a sandboxed `<iframe>`; QuickJS-WASM as an option for untrusted portals | safe sharing |
| Audio | Web Audio API: event sounds plus stream sounds synced to the timeline | |
| Filters / blend | Canvas `filter` or WebGL shaders: blur, glow, drop shadow, bevel; blend modes | Flash 8-era effects |
| File format | `.json` project (diffable) plus a `.zip` bundle for assets. Publishes to a **single self-contained HTML** file | "just send the .html" is the new ".swf" |
| Exports | HTML, GIF/MP4 (WebCodecs), SVG/Lottie for pure animations. Stretch goals: **SWF export** (playable in Ruffle) and **XFL import** (CS5+ `.fla` files are zipped XML) | interop, and rescuing old projects |
| Modern extras | hi-DPI, touch and pen input, gamepad, accessibility, local-first storage, live collaboration (Yjs), AI helper for scripts | things Flash never had |

### MVP roadmap (suggestion)

1. **Player core:** display list, MovieClip timeline, Canvas2D renderer, JSON format,
   `<flash-movie>` web component.
2. **Editor shell:** stage, selection/transform, rectangle/oval/line/pen tools, layers, and a
   timeline with keyframes.
3. **Symbols and library:** convert to symbol (MovieClip/Button/Graphic), instance names,
   nested timelines.
4. **Tweens:** motion tweens with easing, onion skin.
5. **Scripting:** frame and button actions, an ActionScript-flavored API, publishing to a single
   HTML file. 🎉 A "Frog in a Blender"-class toy is possible from this step on.
6. **Flash feel:** merge drawing, pencil and brush with smoothing, paint bucket, shape tweens.
7. **Polish:** sound, filters, masks, then GIF/MP4 export and a sharing portal.

### Build vs. join

| Path | Pros | Cons |
|---|---|---|
| Contribute to / fork **Next2D** | MIT, and a Flash-API runtime with WebGPU already exists | small community; the drawing tools would need the most work |
| Fork **Wick / Candlestick** | the friendly UX already exists | GPL-3.0, performance limits of paper.js, upstream has stalled |
| **Build fresh** | full control, modern stack, "Flash MX feel" as the north star | biggest effort |

## 📚 Sources

- Adobe Animate maintenance mode: [TechCrunch (Feb 4, 2026)](https://techcrunch.com/2026/02/04/after-backlash-adobe-cancels-adobe-animate-shutdown-and-puts-app-on-maintenance-mode/), [Adobe FAQ](https://helpx.adobe.com/animate/kb/maintenance-mode.html), [No Film School](https://nofilmschool.com/adobe-animate-discontinued-reverse)
- Wick Editor: [GitHub](https://github.com/Wicklets/wick-editor), [releases](https://github.com/Wicklets/wick-editor/releases), [website](https://www.wickeditor.com/)
- Candlestick: [GitHub](https://github.com/Candlestickers/Candlestick), [forum announcement](https://forum.wickeditor.com/t/candlestick-1-0-a-new-fork-of-wick-editor/23174)
- Next2D: [website](https://next2d.app/en/), [GitHub org](https://github.com/Next2D), [Animation Tool repo](https://github.com/Next2D/tool.next2d.app), [timeline docs](https://next2d.app/en/usage/timeline/), [usage docs](https://next2d.app/en/usage/)
- Rive: [Scripting is live (Jan 13, 2026)](https://rive.app/blog/scripting-is-live-in-rive), [Why Luau](https://rive.app/blog/why-scripting-runs-on-luau), [scripting docs](https://rive.app/docs/scripting/getting-started), [pricing](https://rive.app/pricing), [rive-wasm (MIT)](https://github.com/rive-app/rive-wasm)
- Ruffle: [compatibility](https://ruffle.rs/compatibility), [AS3 API progress](https://ruffle.rs/compatibility/avm2), [GitHub](https://github.com/ruffle-rs/ruffle)
- "Building a Better Flash": [Patreon post](https://www.patreon.com/posts/post-1-152183296), [32-Bit Cafe discussion](https://discourse.32bit.cafe/t/building-a-new-flash/4373)
- Lottie: [State machines in Lottie Creator](https://lottiefiles.com/blog/state-machines/state-machines-are-finally-in-lottie-creator), [dotlottie-web](https://github.com/lottiefiles/dotlottie-web), [WebGL & WebGPU in dotlottie-web](https://lottiefiles.com/blog/working-with-lottie-animations/hardware-accelerated-lottie-on-the-web-dotlottie-web-now-ships-webgl-webgpu)
- Graphite: [features/roadmap](https://graphite.art/features/), [NLnet](https://nlnet.nl/project/Graphite/)
- Theatre.js: [GitHub](https://github.com/theatre-js/theatre)
- TurboWarp packager: [GitHub](https://github.com/TurboWarp/packager)
- OpenFL: [haxelib](https://lib.haxe.org/p/openfl), [GitHub](https://github.com/openfl/openfl)
- PixiJS: [blog (June 2026)](https://pixijs.com/blog/june-2026), [v8.18.0](https://newreleases.io/project/github/pixijs/pixijs/release/v8.18.0)
- GSAP free: [Webflow blog](https://webflow.com/blog/gsap-becomes-free), [CSS-Tricks](https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/)
- ThorVG 1.0: [announcement](https://www.thorvg.org/post/thorvg-v1-0-a-new-generation-released)
- Vello: [GitHub](https://github.com/linebender/vello), [Linebender Dec 2025](https://linebender.org/blog/tmil-24/)
- KoolMoves: [website](https://www.koolmoves.com/)
- Tumult Hype: [website](https://tumult.com/hype/)
