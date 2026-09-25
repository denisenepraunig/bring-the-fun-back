# bring-the-fun-back

Flash like fun: bringing back the fun/creative times of the internet. Flash-style vector
animations and little games, made for today's web. No plugins, just HTML5, and it runs on
iPhone and iPad.

## What's here

| Path | What it is |
|---|---|
| [`docs/document-format.md`](docs/document-format.md) | 📄 The `.fla.json` document format, modeled on a Flash MX document (library, symbols, timeline, layers, frame scripts) |
| [`player/player.js`](player/player.js) | ▶️ The HTML5 player: plays documents on a Canvas 2D stage, with ActionScript-style scripting |
| [`tools/publish.mjs`](tools/publish.mjs) | 📦 "File › Publish": turns a document into one self-contained `.html` page |
| [`examples/star-catcher/`](examples/star-catcher/) | ⭐ Tech demo: tap 10 spinning stars |
| [`research/`](research/) | 🔎 Background research on modern Flash alternatives |

## Try it

```sh
npm run build                          # needs Node 18+, no dependencies
open dist/star-catcher/index.html      # or any static web server
```

The result is a single HTML file with the player and the movie inside. Upload it anywhere
(for example to Cloudflare Pages, Netlify, GitHub Pages or itch.io) and open the link on your
phone.

## Star Catcher: the tech demo

- A dark blue 16:9 stage that keeps its aspect ratio with a 16 px margin.
- Frame 1 (`title`): `stop();` and a yellow **Play** button (a Button symbol with Up, Over,
  Down and Hit frames).
- Frame 2 (`game`): a score field bound to the `score` variable (Flash MX's "Var:"). Stars come
  from the library via `attachMovie("Star", …)`.
- The **Star** movie clip: frame 1 has `stop();` while a nested clip spins it 360° with a motion
  tween. Tapping calls `gotoAndPlay("shrink")`: it shrinks, then calls `this.removeMovieClip()`.
- After 10 stars, frame 3 (`gameover`) shows the score and a **Retry** button.
