# 🎬 Bringing back Flash — landscape & options (Sep 2026)

Research notes: what exists today for making Flash-style vector animations and
little games for the web, and how a modern, open-source "Flash MX" could be built.

## 🎯 Goal

- **Feels like Flash MX:** draw vectors, convert them to symbols, animate them on a timeline
  with layers, and add scripts to frames, buttons and movie clips.
- **HTML5-native output:** no SWF, no plugin, no emulator. A published movie is plain HTML +
  JavaScript that draws with Canvas or SVG.
- **Runs great on iPhone and iPad:** touch, Retina screens, sound and full screen all work in
  Safari, and people share a link instead of going through the App Store.
- **Keeps what Flash was loved for:** vector graphics that look sharp at any size, tweens, masks,
  sound, and scripting for small games and interactive cartoons.

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
- 🦀 **Old SWFs: [Ruffle](https://ruffle.rs)** (Rust → WebAssembly) plays them in modern
  browsers. That's not our target, since we want HTML5-native output, but its code is a useful
  reference for how Flash behaved.
- 🌐 **HTML5-native works, iPhone/iPad included:** the browser can do everything the Flash
  Player did (vectors, gradients, masks, blend modes, sound, input). Canvas 2D is the
  pragmatic first renderer. iOS needs some care: touch instead of hover, a tap to start sound,
  and Home Screen web apps for full screen.
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
| Publishing | `.swf` + HTML embed | one small file to share → for us: a self-contained `.html` file or a link |

## 🧰 Options today

### 1. Flash-style authoring tools (editor + timeline + symbols + scripting → web)

| Tool | License | Runs in | Scripting | HTML5-native output? | Status (Sep 2026) | Flash-likeness (my rating) |
|---|---|---|---|---|---|---|
| Next2D Animation Tool + Player | MIT | Browser | JavaScript frame scripts | ✅ JSON + JS player (WebGL/WebGPU) | Active | ⭐⭐⭐⭐ |
| Wick Editor | GPL-3.0 | Browser + desktop | JavaScript | ✅ HTML | Last release 1.19.0 (Dec 2023) | ⭐⭐⭐⭐ |
| Candlestick (Wick fork) | GPL-3.0 | Browser | JavaScript | ✅ HTML | Community-maintained | ⭐⭐⭐⭐ |
| Adobe Animate | Proprietary (subscription) | Desktop | JS (HTML5 Canvas / CreateJS), AS3 | ✅ HTML5 Canvas (CreateJS), or SWF | Maintenance mode since Feb 2026 | ⭐⭐⭐⭐⭐ |
| Rive | Editor proprietary, runtimes MIT | Browser + desktop | Luau (since Jan 2026) | ✅ `.riv` + WASM runtime (Canvas/WebGL) | Very active | ⭐⭐⭐ (different paradigm: state machines) |
| "Building a Better Flash" (Bill Premo) | Not stated | Desktop (C# / Avalonia / SkiaSharp) | C# via Roslyn | ❓ "modern web tech", details unclear | Early, Patreon-funded (Mar 2026) | ⭐⭐⭐⭐⭐ (goal) |
| KoolMoves | Proprietary (low cost) | Windows | JS / CreateJS | ✅ HTML5 (CreateJS), or SWF | Last update ~2022 | ⭐⭐⭐ |
| Tumult Hype | Proprietary | macOS | JavaScript | ✅ HTML/CSS/JS (DOM) | – | ⭐⭐ (HTML/DOM-based) |

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

### 2. Playing old SWFs (reference only, not our target)

**Ruffle** is a Flash Player emulator written in Rust and compiled to WASM. It ships as a
browser extension, a self-hosted JS player and a desktop app. Compatibility:

| | Language | API |
|---|---|---|
| AVM1 (AS1/2) | 99% | 82% |
| AVM2 (AS3) | 90% | 82% |

→ Not a fit for our goal: making new work as SWF ties you to a frozen format and to closed or
legacy tools. Still useful: Ruffle's open-source code shows in detail how Flash's timeline,
display list and ActionScript really behaved. That helps when we recreate that behavior in HTML5.

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

## 🌐 Going HTML5-native (no SWF, no plugin)

Browsers now cover everything the Flash Player did. A published movie can be plain HTML, a
small TypeScript runtime and Canvas or SVG drawing. No WebAssembly is needed, so the player
stays small, easy to debug and friendly to "view source".

### Flash feature → web platform

| Flash | HTML5-native equivalent | Notes |
|---|---|---|
| Vector shapes (fills, strokes, curves) | Canvas 2D `Path2D` or SVG `<path>` | quadratic and cubic Béziers are both native (`quadraticCurveTo`, `bezierCurveTo`; SVG `Q`/`C`) |
| Sharp at any size | redraw at `devicePixelRatio` and at the current zoom | vectors stay crisp on Retina screens and when zooming in |
| Linear / radial gradients, bitmap fills | `createLinearGradient`, `createRadialGradient`, `createPattern`; SVG gradients and patterns | |
| Alpha, tint, brightness (color transform) | `globalAlpha`; for vectors, apply the color transform to fill and stroke colors before drawing | bitmaps need an SVG `feColorMatrix` or a WebGL shader |
| Masks (mask layers, `setMask`) | Canvas `clip()` with the mask's path; SVG `<clipPath>` | Flash MX masks had hard edges, so `clip()` matches them exactly |
| Blend modes (Flash 8) | `globalCompositeOperation` (multiply, screen, overlay, …); CSS `mix-blend-mode` | supported in all major browsers |
| Filters (Flash 8: blur, glow, drop shadow, bevel, …) | Canvas `shadowBlur`/`shadowColor` (drop shadow, glow); SVG filters; WebGL shaders | ⚠️ Canvas `ctx.filter` is still behind a flag in Safari, so don't rely on it |
| Bitmaps, `cacheAsBitmap` | `drawImage`, `OffscreenCanvas`, `createImageBitmap` | caching complex vectors as bitmaps is still a useful speed trick |
| Text, embedded fonts | `fillText` + web fonts (FontFace API); SVG `<text>` | |
| Input text fields | overlay a real `<input>` / `<textarea>` | brings the on-screen keyboard, IME and accessibility for free |
| Sound (event and stream sounds) | Web Audio API | browsers need a tap or click before audio can play → a "tap to play" start screen |
| Video | `<video>` drawn with `drawImage`, or overlaid on the stage | |
| Buttons, mouse, keyboard | Pointer Events (touch + pen + mouse), keyboard events; `isPointInPath` for hit tests | the Hit frame becomes the hit-test path |
| ActionScript | JavaScript / TypeScript | ActionScript was based on ECMAScript, so JS is its direct heir |
| `attachMovie`, `duplicateMovieClip` | create a symbol instance from the library by its linkage name | |
| Drawing API (`beginFill`, `lineTo`, `curveTo`) | a `graphics` API on MovieClips that builds `Path2D`s | |
| `loadMovie`, `LoadVars`, `XML` | `fetch()`, dynamic `import()`, JSON | |
| `SharedObject` (save games) | `localStorage` / IndexedDB | |
| Fixed frame rate (12/24/30 fps) | `requestAnimationFrame` + fixed-step timing | the timeline runs at the movie's fps, whatever the screen's refresh rate |
| Full screen, right-click menu | Fullscreen API, `contextmenu` event | on iPhone, see the iOS section below |
| `.swf` + `<embed>` | a self-contained `.html` file, or a `<flash-movie src="…">` custom element (Web Component) | works offline and embeds in any site |

### Choosing a renderer

| | SVG (DOM) | Canvas 2D | WebGL2 / WebGPU |
|---|---|---|---|
| Vector quality | ⭐⭐⭐ native, perfect at any zoom | ⭐⭐⭐ native anti-aliasing, redrawn at `devicePixelRatio` | ⭐⭐ shapes must be triangulated (or use a compute rasterizer like Vello) |
| Many moving objects | ⭐ every shape is a DOM node | ⭐⭐ plenty for Flash-era cartoons and games | ⭐⭐⭐ best (particles, bullet hell) |
| Masks, blend modes, filters | ✅ all native (`clipPath`, `mix-blend-mode`, SVG filters) | ✅ clip + composite operations; filters only partly | ✅ anything, but you write the shaders |
| Accessibility, selectable text | ✅ | ⚠️ needs a DOM fallback layer | ⚠️ needs a DOM fallback layer |
| Hit testing | ✅ DOM events | ✅ `isPointInPath` | ⚠️ do it yourself |
| Effort to build | low–medium | low | high |
| Browser support | everywhere | everywhere | WebGL2 everywhere; WebGPU in Chrome/Edge, Safari 26 (incl. iOS) and Firefox (Windows, macOS ARM; Linux and Android still coming) |

**Recommendation:** keep one display list and make renderers swappable. OpenFL does the same
with its Canvas, DOM and WebGL renderers.

1. **Canvas 2D first.** It works the way Flash Player did: walk the display list and draw the
   vectors each frame. It is available everywhere and is enough for Flash-era content.
2. **SVG second.** Good for exporting pure animations, and for crisp, accessible, lightweight
   pieces.
3. **WebGL/WebGPU only when a game needs it**, via PixiJS v8 or ThorVG, with a WebGL2 fallback.

### What a published movie looks like

```html
<!-- A: one self-contained file (runtime + movie + assets inlined) -->
frog-in-a-blender.html

<!-- B: embed in any page, like <embed src="movie.swf"> back in the day -->
<script type="module" src="player.js"></script>
<flash-movie src="frog.movie.json" width="550" height="400"></flash-movie>
```

(550 × 400 was Flash's default stage size.)

## 📱 iPhone & iPad first

### Why Flash never made it to the iPhone

- **April 29, 2010:** Steve Jobs published *Thoughts on Flash*. His reasons: Flash was closed
  and proprietary, crashed and had security holes, drained batteries, wasn't built for touch,
  and (his "most important" reason) put a third-party layer between the platform and developers.
- **April 2010:** Apple's developer agreement (section 3.3.1) banned apps built with
  cross-compilers. This hit Adobe's Packager for iPhone, which turned Flash projects into iOS
  apps. Apple relaxed the rule in September 2010.
- **Critics** said the real motive was protecting the App Store. Adobe's CEO called the letter
  a "smokescreen", and Wired had made the App Store argument back in 2009.
- **Nov 2011:** Adobe stopped developing Flash for mobile browsers. **Dec 31, 2020:** Flash
  reached its end of life.

**Verdict: both.** The technical problems were real: Flash on phones was slow, hungry for
battery and built around mouse hover. But keeping developers in native apps and in the App
Store clearly served Apple's business too. The irony: HTML5, the thing Jobs pushed instead, is
exactly how Flash-style content can now reach iPhones, with no App Store review or commission
in between.

### iOS checklist for the player

| iPhone/iPad reality | What the player does |
|---|---|
| Practically every iOS browser uses Safari's engine (WebKit) | test in Safari first. Don't rely on Canvas `ctx.filter` (behind a flag). WebGL2 works, and WebGPU works on iOS 26+ |
| No mouse, so no hover | buttons react to taps (the Over state is optional). Pointer Events handle touch, pen and mouse, and `touch-action: none` on the stage stops accidental scrolling and zooming |
| No keyboard on iPhone | on-screen controls (d-pad, buttons) for keyboard-style games; the Gamepad API for game controllers |
| Sound needs a tap first | a "tap to play" start screen unlocks Web Audio |
| The silent switch mutes Web Audio | decide per movie: respect it (the default), or set `navigator.audioSession.type = "playback"` (Safari 16.4+) |
| No element full screen on iPhone (videos only) | fill the viewport (`100dvh`, safe-area insets). Since iOS 26, a site added to the Home Screen opens as a web app with no browser UI. iPad supports the Fullscreen API |
| Retina screens (2–3× pixel density) | draw at `devicePixelRatio` so vectors stay sharp, but keep the canvas size sane, because iOS limits canvas memory |
| Many screen sizes, rotation | stage scale modes like Flash's *show all* / *no border* / *exact fit* / *no scale*, with letterboxing |
| Battery (Jobs' big complaint!) | redraw only when something changed, run at the movie's fps (e.g. 24), pause when hidden (`requestAnimationFrame` does that), respect `prefers-reduced-motion` |
| Inline video | use `playsinline` (plus `muted` for autoplay), or the iPhone switches to full-screen video |
| Text input | a real `<input>` overlay brings up the iOS keyboard |
| Sharing | a link is the easy way (itch.io, Newgrounds, GitHub Pages). A web app manifest and a service worker let movies work offline from the Home Screen, with no App Store needed |

Bonus: the **editor** can run on iPad too. Pointer Events report Apple Pencil pressure and tilt,
which makes Flash-style drawing with a pencil possible in the browser.

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
  movie.json / .zip bundle ──► Player runtime (small TypeScript lib, no WASM,
                               <flash-movie> web component)
                               display list · timeline engine · tween engine
                               renderer (Canvas 2D first; SVG, WebGL/WebGPU later)
                               Web Audio · pointer/touch/keyboard/gamepad input
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
| Stage rendering | Canvas 2D `Path2D` first (crisp, redrawn at `devicePixelRatio`, simple); SVG and WebGL/WebGPU as optional renderers later | Flash-era content is light; switch to the GPU only when needed |
| Symbols | MovieClip (own timeline), Button (Up/Over/Down/Hit), Graphic (synced) | faithful mental model |
| Timeline | layers (normal/guide/mask/folder), keyframes, labels, motion tweens (matrix + color transform + easing), shape tweens (path morphing with shape hints), onion skin | |
| Scripting | JS/TS with an ActionScript-flavored API: `stop()`, `gotoAndPlay()`, `this.on("release")`, `onEnterFrame`, `hitTest()`, `startDrag()`. Monaco editor with typings; optionally Blockly for kids | familiar and modern |
| Sandbox | published movies run in a sandboxed `<iframe>`; QuickJS-WASM as an option for untrusted portals | safe sharing |
| Input | Pointer Events (touch, pen, mouse), keyboard, Gamepad API, optional on-screen controls | iPhone/iPad from day one |
| Audio | Web Audio API: event sounds plus stream sounds synced to the timeline; tap-to-play unlock | |
| Filters / blend | Canvas shadows (drop shadow, glow) and composite operations (blend modes); SVG filters or WebGL shaders for blur, bevel and color matrix | Flash 8-era effects; `ctx.filter` is still behind a flag in Safari |
| File format | `.json` project (diffable) plus a `.zip` bundle for assets. Publishes to a **single self-contained HTML** file | "just send the .html" is the new ".swf" |
| Exports | HTML first. Also GIF/MP4 (WebCodecs) and SVG/Lottie for pure animations. Optional: **XFL import** (CS5+ `.fla` files are zipped XML) to rescue old projects | interop |
| Modern extras | hi-DPI, touch and Apple Pencil, gamepad, accessibility, Home Screen web app with offline support, local-first storage, live collaboration (Yjs), AI helper for scripts | things Flash never had |

### MVP roadmap (suggestion)

1. **Player core:** display list, MovieClip timeline, Canvas 2D renderer, JSON format,
   `<flash-movie>` web component. Tested on iPhone and iPad from day one (touch, tap-to-play
   audio, viewport scaling).
2. **Editor shell:** stage, selection/transform, rectangle/oval/line/pen tools, layers, and a
   timeline with keyframes.
3. **Symbols and library:** convert to symbol (MovieClip/Button/Graphic), instance names,
   nested timelines.
4. **Tweens:** motion tweens with easing, onion skin.
5. **Scripting:** frame and button actions, an ActionScript-flavored API, publishing to a single
   HTML file. 🎉 A "Frog in a Blender"-class toy is possible from this step on.
6. **Flash feel:** merge drawing, pencil and brush with smoothing, paint bucket, shape tweens.
7. **Polish:** sound, filters, masks, then an SVG renderer/export, GIF/MP4 export and a sharing
   portal.

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
- Web platform: [Canvas `filter` support (caniuse)](https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter), [MDN: Canvas `filter`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter), [WebGPU in major browsers (web.dev)](https://web.dev/blog/webgpu-supported-major-browsers), [WebGPU implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status), [Fullscreen API (caniuse)](https://caniuse.com/fullscreen)
- iOS: [Home Screen web apps in iOS 26 (heise)](https://www.heise.de/en/news/iOS-26-and-iPadOS-26-Changed-web-app-behaviour-on-the-home-screen-10749652.html), [MacRumors how-to](https://www.macrumors.com/how-to/save-safari-bookmark-web-app-iphone-home-screen/), [Fullscreen in web games on iOS Safari (Bugnet)](https://bugnet.io/blog/how-to-fix-web-game-fullscreen-on-ios-safari), [Web Audio and the silent switch (Audjust)](https://www.audjust.com/blog/unmute-web-audio-on-ios), [unmute-ios-audio](https://github.com/feross/unmute-ios-audio)
- History: [Thoughts on Flash (Wikipedia)](https://en.wikipedia.org/wiki/Thoughts_on_Flash), [Web Design Museum](https://www.webdesignmuseum.org/web-design-history/steve-jobs-and-his-thoughts-on-flash-2010)
