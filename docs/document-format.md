# 📄 Document format: `.fla.json` (version 1)

One file is one Flash-style document, the modern counterpart of an `.fla`. It is plain JSON,
so it diffs nicely in git and any tool can read it. Its structure follows the Flash authoring
model (document → library → symbols → timelines → layers → frames → elements). The property
names are borrowed from Flash's own XML format (XFL) and scripting API (JSFL), so anyone who
used Flash MX will recognize them.

`tools/publish.mjs` turns a document into a single self-contained `.html` page. That page is
the new `.swf`: open it, host it anywhere, or embed it.

- Example: [`examples/star-catcher/star-catcher.fla.json`](../examples/star-catcher/star-catcher.fla.json)
- Player: [`player/player.js`](../player/player.js)

## At a glance

```
document                     Modify › Document…: size, background color, frame rate
├── publishSettings          File › Publish Settings…
├── library.items[]          symbols: "movie clip", "button", "graphic"
│   └── timeline             each symbol has its own timeline
└── timelines[]              scenes ("Scene 1", …)
    └── layers[]             top layer first
        └── frames[]         keyframes: index + duration
            ├── name         frame label
            ├── actionScript frame script
            ├── tweenType …  motion tween settings
            └── elements[]   back to front: shape, text, instance
```

## Flash MX → document cheat sheet

| In Flash MX | In the document |
|---|---|
| Stage size, background color, frame rate | `width`, `height`, `backgroundColor`, `frameRate` |
| Library panel | `library.items[]` |
| Convert to Symbol: Movie clip / Button / Graphic | item `itemType`: `"movie clip"`, `"button"`, `"graphic"` |
| Linkage › Export for ActionScript | `linkageExportForAS`, `linkageIdentifier` (used by `attachMovie`) |
| Scene | `timelines[]` |
| Layer: normal, guide, mask, folder | `layers[]` with `layerType` |
| Keyframe / blank keyframe | frame with `index` + `duration` / frame with `"elements": []` |
| Frame label / comment | frame `name` with `labelType` `"name"` / `"comment"` |
| Actions panel on a frame | frame `actionScript` |
| Motion tween with Rotate CW 1 time and Ease | `tweenType: "motion"`, `motionTweenRotate`, `motionTweenRotateTimes`, `tweenEasing` |
| Instance name, "Behavior" of an instance | instance `name`, `symbolType` |
| Free Transform tool | instance `matrix` |
| Color: Brightness / Tint / Alpha / Advanced | instance `color` |
| Graphic options: Loop / Play once / Single frame, First | instance `loop`, `firstFrame` |
| Static / dynamic / input text, "Var:" field | text `textType`, `name`, `variableName` |
| Button frames Up / Over / Down / Hit | frames 1–4 of a button's timeline |
| Publish Settings › HTML › Scale | `publishSettings.html.scaleMode` |

## Document

| Property | Type | Meaning |
|---|---|---|
| `format` | `"bring-back-flash"` | identifies the file |
| `formatVersion` | `1` | this spec |
| `name` | string | document name |
| `width`, `height` | number (px) | stage size, e.g. `960` × `540` for 16:9 |
| `frameRate` | number | frames per second (Flash MX default: 12) |
| `backgroundColor` | `"#RRGGBB"` | stage color |
| `publishSettings.html` | object | see [Publishing](#publishing) |
| `library.items` | array | library items (symbols) |
| `timelines` | array | scenes; the player currently plays the first one |

## Library items (symbols)

```json
{
  "name": "Star",
  "itemType": "movie clip",
  "linkageExportForAS": true,
  "linkageIdentifier": "Star",
  "timeline": { "name": "Star", "layers": [ … ] }
}
```

| `itemType` | Behaves like in Flash |
|---|---|
| `"movie clip"` | has its own playhead and runs its own frame scripts; can have an instance name and event handlers |
| `"button"` | shows frame 1 (Up), 2 (Over) or 3 (Down) depending on the pointer; frame 4 (Hit) is the invisible clickable area |
| `"graphic"` | follows the playhead of the timeline it is placed on; no scripts, no instance name |

Names are unique in the library. A `/` in a name can later be used for library folders
(`"Buttons/Play"`).

## Timelines, layers and frames

```json
{
  "name": "Scene 1",
  "layers": [
    { "name": "actions", "frames": [ { "index": 0, "duration": 1, "actionScript": ["stop();"] } ] },
    { "name": "labels",  "frames": [ { "index": 0, "duration": 1, "name": "title", "labelType": "name" } ] },
    { "name": "content", "layerType": "normal", "frames": [ { "index": 0, "duration": 1, "elements": [ … ] } ] }
  ]
}
```

- **Layer order:** the first layer is the top one, as in the Timeline panel.
- **Layer types:** `"normal"` (default), `"guide"` (never published), `"folder"` (no frames),
  `"mask"` and `"masked"`. Player 0.1 hides mask layers but does not mask yet.
- **Frames** only lists keyframes. `index` is 0-based (like XFL). `duration` says how many frames
  the keyframe lasts (default `1`). Frames not covered by any keyframe are empty.
- **A blank keyframe** is a keyframe with `"elements": []`.
- **Elements** are listed back to front: the last one is drawn on top.
- **Labels:** frames with `name` and `labelType: "name"` can be targeted by scripts
  (`gotoAndStop("game")`). `labelType: "comment"` is just a note.
- **Scripts** (`actionScript`) run when the playhead enters that keyframe. The value is a string
  or an array of lines (arrays are easier to read and diff).
- **Frame numbers in scripts start at 1**, as in ActionScript: `gotoAndStop(1)` is the first
  frame, which has `"index": 0` in the file. Prefer labels.

### Motion tweens

A keyframe with `"tweenType": "motion"` animates its first symbol instance towards the same
symbol in the **next keyframe**, which has to start right where this one ends.

| Property | Values |
|---|---|
| `tweenEasing` | `-100` (ease in) … `0` … `100` (ease out) |
| `motionTweenRotate` | `"auto"` (shortest way), `"clockwise"`, `"counter-clockwise"` |
| `motionTweenRotateTimes` | extra full turns for clockwise / counter-clockwise |

Position, scale, rotation, skew and color are interpolated. Tip for a seamless loop, as Flash
animators did it: end on 357° (one step short of 360°) instead of 360°, so the first frame
doesn't show twice. The Spinning Star in the example does this.

## Elements

### Shape

```json
{
  "elementType": "shape",
  "fills": [ { "index": 1, "style": "solid", "color": "#FFD60A", "alpha": 1 } ],
  "strokes": [ { "index": 1, "style": "solid", "thickness": 5, "color": "#E89C00", "joinType": "round", "capType": "round" } ],
  "edges": [ { "fillStyle1": 1, "strokeStyle": 1, "path": "M 0 -58 L 15.87 -21.84 … Z" } ]
}
```

Like in Flash, a shape has style tables (`fills`, `strokes`) and **edges** that reference
them. Each edge says which fill lies on its left (`fillStyle0`) and right (`fillStyle1`) and
which stroke it draws (`strokeStyle`). This is the planar-map model behind Flash's merge
drawing, which the editor will use. `path` uses SVG path syntax (`M`, `L`, `Q`, `C`, `Z`).
Flash itself drew with quadratic curves (`Q`). Player 0.1 expects each edge path to be a
closed outline.

| Fill `style` | Extra properties |
|---|---|
| `"solid"` | `color`, `alpha` |
| `"linearGradient"`, `"radialGradient"` | `matrix`, `entries: [{ "ratio": 0..1, "color", "alpha" }]`, optional `focalPointRatio` (-1..1, radial only) |

Gradients work like in Flash. The gradient is defined in a 1638.4 × 1638.4 px box centered on
(0, 0): linear from left to right, radial from the center outwards. The fill's `matrix` moves,
scales and rotates that box onto the shape.

Strokes: `style` (`"solid"` or `"noStroke"`), `thickness` (px, 0 = hairline), `color`,
`alpha`, `capType` (`"round"`, `"square"`, `"none"`), `joinType` (`"round"`, `"bevel"`,
`"miter"`) and `miterLimit`.

### Text

```json
{
  "elementType": "text",
  "textType": "dynamic",
  "name": "score_txt",
  "variableName": "score",
  "matrix": { "a": 1, "b": 0, "c": 0, "d": 1, "tx": 28, "ty": 48.24 },
  "width": 220,
  "height": 55,
  "textRuns": [ { "characters": "0", "textAttrs": { "face": "_sans", "size": 44, "bold": true, "fillColor": "#FFFFFF", "alignment": "left" } } ]
}
```

- `textType`: `"static"`, `"dynamic"` or `"input"` (input fields are not supported yet).
- `name` is the instance name for scripts (`score_txt.text = "Hi"`).
- `variableName` is Flash MX's **Var:** field. The text always shows that timeline variable
  (`score`, or a path like `_root.score`).
- The text box's top-left corner is at `matrix` (`tx`, `ty`). It has a 2 px gutter, like Flash.
- `textAttrs`: `face` (`"_sans"`, `"_serif"`, `"_typewriter"` device fonts, or a font name),
  `size`, `bold`, `italic`, `fillColor`, `alpha`, `alignment` (`"left"`, `"center"`, `"right"`),
  `letterSpacing` and `lineSpacing`.
- Line breaks inside `characters` (`\n`) start new lines.

### Instance (of a symbol)

```json
{
  "elementType": "instance",
  "libraryItemName": "Play Button",
  "symbolType": "button",
  "name": "play_btn",
  "matrix": { "a": 1, "b": 0, "c": 0, "d": 1, "tx": 480, "ty": 352 },
  "color": { "brightness": 0.12 }
}
```

| Property | Meaning |
|---|---|
| `libraryItemName` | the symbol to place |
| `symbolType` | behave as `"movie clip"`, `"button"` or `"graphic"` (defaults to the item's type) |
| `name` | instance name, used in scripts. Flash MX code hints expected suffixes: `_mc`, `_btn`, `_txt` |
| `matrix` | position and transform of the symbol's registration point |
| `color` | color effect, see below |
| `loop`, `firstFrame` | graphics only: `"loop"`, `"play once"` or `"single frame"`, and the 0-based first frame |

## Matrices and colors

A `matrix` `{ a, b, c, d, tx, ty }` maps a point to `(a·x + c·y + tx, b·x + d·y + ty)`, like
Flash's Matrix. Missing values default to the identity. Rotating by θ and scaling by s gives
`a = s·cos θ`, `b = s·sin θ`, `c = −s·sin θ`, `d = s·cos θ`. The y axis points down, so
positive angles turn clockwise.

Colors are `"#RRGGBB"`, with a separate `alpha` from 0 to 1.

A `color` effect on an instance is one of:
- `{ "alphaMultiplier": 0.5 }` for alpha
- `{ "brightness": -1..1 }` for brightness
- `{ "tintColor": "#FF0000", "tintMultiplier": 0..1 }` for tint
- the advanced form with `redMultiplier` … `alphaMultiplier` (0..1) and `redOffset` …
  `alphaOffset` (-255..255)

## Scripting

Scripts are **JavaScript written the ActionScript 1/2 way**. Frame scripts, `onRelease`
handlers, `_x` and `_rotation` all work as they did in Flash MX:

```js
stop();

play_btn.onRelease = function () {
  gotoAndStop("game");
};
```

- `this` is the timeline the script is on.
- **Names resolve like in ActionScript:** instance names on that timeline (`play_btn`), then
  timeline variables, then global functions. Assigning to an unknown name creates a timeline
  variable (`score = 0` is `this.score = 0`). JavaScript globals such as `Math` and `JSON` work
  as usual.
- Handlers keep the scope they were written in. A handler defined on the main timeline can use
  `score++` and `gotoAndStop("gameover")` even though `this` is the button.
- `function` declarations are local to their frame script. To share a function with later
  frames, assign it: `spawnStar = function () { … };`.
- **Order:** a timeline's frame script runs before the first-frame scripts of clips placed on
  that frame, as in Flash.

Supported in player 0.1:

| Where | API |
|---|---|
| Global functions | `stop`, `play`, `gotoAndStop`, `gotoAndPlay`, `nextFrame`, `prevFrame`, `attachMovie`, `removeMovieClip`, `trace`, `getTimer`, `random`, `setInterval`, `clearInterval`, `getURL` |
| Global objects | `Stage.width`, `Stage.height`, `Key.isDown(Key.LEFT)` and the other key codes, `_root`, `_parent` |
| Movie clips | `play()`, `stop()`, `gotoAndPlay()`, `gotoAndStop()`, `nextFrame()`, `prevFrame()`, `attachMovie()`, `removeMovieClip()`, `hitTest(x, y, true)`, `localToGlobal()`, `globalToLocal()` |
| Properties | `_x`, `_y`, `_xscale`, `_yscale`, `_rotation`, `_alpha`, `_visible`, `_name`, `_parent`, `_root`, `_xmouse`, `_ymouse`; clips also have `_currentframe` and `_totalframes` |
| Events | `onPress`, `onRelease`, `onReleaseOutside`, `onRollOver`, `onRollOut`, `onDragOver`, `onDragOut`, `onEnterFrame` |
| Button-like clips | `enabled`, `useHandCursor`, `hitArea`, and the frame labels `_up`, `_over` and `_down` |
| Text fields | `text` (a field with `variableName` writes through to its variable) |

Once a script moves an instance (`_x`, `_rotation`, …), the timeline stops moving it, as in
Flash. `removeMovieClip()` only removes clips created with `attachMovie()`.

## Publishing

```json
"publishSettings": {
  "html": { "title": "Star Catcher", "scaleMode": "showAll", "pageBackgroundColor": "#050F2E", "pagePadding": 16 }
}
```

| Setting | Meaning |
|---|---|
| `title` | page title |
| `scaleMode` | `"showAll"` (keep aspect ratio, letterbox; default), `"noBorder"` (fill and crop), `"exactFit"` (stretch), `"noScale"` |
| `pageBackgroundColor` | color around the stage |
| `pagePadding` | margin around the stage in px (plus the iPhone's safe areas) |

`node tools/publish.mjs` (or `npm run build`) does this for every `examples/*/*.fla.json`:

1. Checks the document and **syntax-checks every frame script**, printing the layer and frame
   of any error, like Flash's compiler errors.
2. **Compiles the scripts** into functions in the page. Published pages never call `eval`, so
   they run under strict Content Security Policies.
3. Inlines the document and the player into `dist/<name>/index.html`: one file, no requests,
   works offline and from `file://`.

`--fragment` also writes `fragment.html` without `<html>`, `<head>` and `<body>`, for pasting
into an existing page.

To load a document at runtime instead (handy while developing), use
`<flash-movie src="movie.fla.json"></flash-movie>` with `player.js`. Scripts are then compiled
in the browser.

## Not supported yet (player 0.1)

Shape tweens and shape hints, masking, sounds, bitmaps and video, input text, multiple scenes,
filters and blend modes, `_width` and `_height`, `startDrag`, `hitTest(target)`,
`duplicateMovieClip`, the drawing API and `loadMovie`. For server calls such as saving a
highscore, `fetch()` works in scripts today.

## Versioning

Additions that older players can ignore keep `formatVersion: 1`. Anything that changes the
meaning of existing properties bumps the version, and players warn when a document is newer
than they are.
