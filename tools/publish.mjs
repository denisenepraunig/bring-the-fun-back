#!/usr/bin/env node
// Publish: turns Flash-style documents (*.fla.json) into self-contained HTML pages,
// like File > Publish in Flash turned an .fla into .swf + .html.
//
//   node tools/publish.mjs                       all examples/*/*.fla.json -> dist/<name>/index.html
//   node tools/publish.mjs my.fla.json --out out one document, custom output folder
//   --fragment                                   also write <name>/fragment.html (no <html>/<head>/<body>,
//                                                for pasting into an existing page)
//
// Frame scripts are syntax-checked and compiled into real functions here, so published
// pages never need eval() and work under strict Content-Security-Policies.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLAYER = join(ROOT, 'player', 'player.js');
const FORMAT = 'bring-back-flash';

function parseArgs(argv) {
  const opts = { out: join(ROOT, 'dist'), fragment: false, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') opts.out = resolve(argv[++i] || 'dist');
    else if (arg === '--fragment') opts.fragment = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else opts.files.push(resolve(arg));
  }
  return opts;
}

async function findExamples() {
  const dir = join(ROOT, 'examples');
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of await readdir(join(dir, entry.name))) {
      if (file.endsWith('.fla.json')) found.push(join(dir, entry.name, file));
    }
  }
  return found.sort();
}

const slugOf = (file) => basename(file).replace(/\.fla\.json$/i, '').replace(/\.json$/i, '');
const scriptText = (s) => (Array.isArray(s) ? s.join('\n') : typeof s === 'string' ? s : '');
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const isHexColor = (s) => typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);

function validate(doc, file) {
  const problems = [];
  if (!doc || typeof doc !== 'object') problems.push('the file does not contain a JSON object');
  else {
    if (doc.format !== FORMAT) problems.push(`"format" must be "${FORMAT}"`);
    if (doc.formatVersion !== 1) problems.push('"formatVersion" must be 1');
    if (!(doc.width > 0) || !(doc.height > 0)) problems.push('"width" and "height" must be positive numbers');
    if (!Array.isArray(doc.timelines) || !doc.timelines.length) problems.push('"timelines" needs at least one scene');
    const names = new Set();
    for (const item of doc.library?.items || []) {
      if (names.has(item.name)) problems.push(`library item "${item.name}" exists twice`);
      names.add(item.name);
    }
  }
  if (problems.length) throw new Error(`${relative(ROOT, file)}:\n  - ${problems.join('\n  - ')}`);
}

// Every keyframe with ActionScript, keyed exactly like the player looks it up
function collectScripts(doc) {
  const scripts = [];
  const visit = (timeline, key, label) => {
    (timeline.layers || []).forEach((layer, li) => {
      for (const frame of layer.frames || []) {
        const code = scriptText(frame.actionScript);
        if (!code.trim()) continue;
        scripts.push({
          key: `${key}/${li}/${frame.index | 0}`,
          code,
          where: `${label} › layer "${layer.name}" › frame ${(frame.index | 0) + 1}`,
        });
      }
    });
  };
  doc.timelines.forEach((tl, i) => {
    const name = tl.name || `Scene ${i + 1}`;
    visit(tl, `scene:${name}`, name);
  });
  for (const item of doc.library?.items || []) {
    if (item.timeline) visit(item.timeline, `symbol:${item.name}`, `symbol "${item.name}"`);
  }
  return scripts;
}

// Like Flash's compiler errors panel: fail the publish with the exact location
function checkSyntax(scripts, file) {
  const errors = [];
  for (const s of scripts) {
    try {
      // eslint-disable-next-line no-new-func
      new Function('__scope__', `with (__scope__) {\n${s.code}\n}`);
    } catch (err) {
      errors.push(`${s.where}: ${err.message}`);
    }
  }
  if (errors.length) throw new Error(`${relative(ROOT, file)} has script errors:\n  - ${errors.join('\n  - ')}`);
}

// Keep inline code from ending its <script> element early
const safeForScriptTag = (js) => js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

function compileScripts(scripts) {
  if (!scripts.length) return '';
  // The code is copied verbatim (not re-indented) so multi-line strings keep their content
  const fns = scripts.map((s) => `  /* ${s.where.replace(/\*\//g, '* /')} */\n  ${JSON.stringify(s.key)}: function (__scope__) { with (__scope__) {\n${s.code}\n  } }`);
  return safeForScriptTag(`document.currentScript.parentElement.frameScripts = {\n${fns.join(',\n')}\n};`);
}

function embedJson(doc) {
  // "<" is escaped so the JSON can never close its <script> tag
  return JSON.stringify(doc).replace(/</g, '\\u003c');
}

function pageStyles({ page, pad, fragment }) {
  const inset = (side) => `max(${pad}px, env(safe-area-inset-${side}, 0px))`;
  const padding = fragment
    ? `padding-block: ${pad}px;\n    padding-inline: ${inset('left')} ${inset('right')};`
    : `padding: ${inset('top')} ${inset('right')} ${inset('bottom')} ${inset('left')};`;
  return `<style>
  :root { color-scheme: dark; --page: ${page}; }
  html, body { height: 100%; }
  html { background: var(--page); overscroll-behavior: none; }
  body {
    margin: 0;
    box-sizing: border-box;
    overflow: hidden;
    background: var(--page);
    ${padding}
  }
  flash-movie { display: block; width: 100%; height: 100%; }
  flash-movie::part(stage) { box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45); }
  noscript { display: block; color: #fff; font: 16px/1.4 system-ui, sans-serif; }
</style>`;
}

function movieMarkup({ title, json, compiled }) {
  return [
    `<flash-movie aria-label="${escapeHtml(title)}">`,
    `<script type="application/json">${json}</script>`,
    compiled ? `<script>\n${compiled}\n</script>` : '',
    '</flash-movie>',
    '<noscript>This movie needs JavaScript.</noscript>',
  ].filter(Boolean).join('\n');
}

function buildPage(opts) {
  const { title, page, player } = opts;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${page}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${escapeHtml(title)}">
<meta name="generator" content="Bring Back Flash publish">
<title>${escapeHtml(title)}</title>
${pageStyles({ ...opts, fragment: false })}
</head>
<body>
${movieMarkup(opts)}
<script>
${player}
</script>
</body>
</html>
`;
}

function buildFragment(opts) {
  const { title, player } = opts;
  return `<title>${escapeHtml(title)}</title>
${pageStyles({ ...opts, fragment: true })}
${movieMarkup(opts)}
<script>
${player}
</script>
`;
}

function buildIndex(entries) {
  const items = entries.map((e) => `    <li><a href="./${e.slug}/">${escapeHtml(e.title)}</a> <span>${e.width} × ${e.height}, ${e.frameRate} fps</span></li>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bring Back Flash</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 32px 16px; background: #050F2E; color: #E8EEFF; font: 16px/1.5 "Helvetica Neue", Helvetica, Arial, sans-serif; }
  main { max-width: 640px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 28px; }
  p { margin: 0 0 24px; color: #8DB4FF; }
  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 12px; }
  a { color: #FFD60A; font-weight: bold; font-size: 20px; }
  span { color: #8DB4FF; font-size: 14px; margin-left: 8px; }
</style>
</head>
<body>
<main>
  <h1>Bring Back Flash</h1>
  <p>Published movies</p>
  <ul>
${items}
  </ul>
</main>
</body>
</html>
`;
}

async function publish(file, player, opts) {
  let doc;
  try {
    doc = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    throw new Error(`${relative(ROOT, file)} is not valid JSON: ${err.message}`);
  }
  validate(doc, file);
  const scripts = collectScripts(doc);
  checkSyntax(scripts, file);

  const html = doc.publishSettings?.html || {};
  const slug = slugOf(file);
  const settings = {
    title: html.title || doc.name || slug,
    page: isHexColor(html.pageBackgroundColor) ? html.pageBackgroundColor : isHexColor(doc.backgroundColor) ? doc.backgroundColor : '#000000',
    pad: Math.max(0, Math.min(64, Number.isFinite(+html.pagePadding) ? +html.pagePadding : 16)),
    json: embedJson(doc),
    compiled: compileScripts(scripts),
    player,
  };

  const outDir = join(opts.out, slug);
  await mkdir(outDir, { recursive: true });
  const page = buildPage(settings);
  await writeFile(join(outDir, 'index.html'), page);
  const written = [`${relative(ROOT, join(outDir, 'index.html'))} (${(page.length / 1024).toFixed(1)} KB)`];
  if (opts.fragment) {
    const fragment = buildFragment(settings);
    await writeFile(join(outDir, 'fragment.html'), fragment);
    written.push(`${relative(ROOT, join(outDir, 'fragment.html'))} (${(fragment.length / 1024).toFixed(1)} KB)`);
  }
  console.log(`✔ ${relative(ROOT, file)} → ${written.join(', ')} · ${scripts.length} frame scripts`);
  return { slug, title: settings.title, width: doc.width, height: doc.height, frameRate: doc.frameRate || 12 };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('usage: node tools/publish.mjs [document.fla.json ...] [--out dist] [--fragment]');
    return;
  }
  const files = opts.files.length ? opts.files : await findExamples();
  if (!files.length) throw new Error('No documents found (looked for examples/*/*.fla.json).');

  const player = await readFile(PLAYER, 'utf8');
  if (/<\/script|<!--/i.test(player)) throw new Error('player/player.js must not contain "</script" or "<!--".');

  const entries = [];
  for (const file of files) entries.push(await publish(file, player, opts));
  await writeFile(join(opts.out, 'index.html'), buildIndex(entries));
  console.log(`✔ ${relative(ROOT, join(opts.out, 'index.html'))} lists ${entries.length} movie${entries.length === 1 ? '' : 's'}`);
}

main().catch((err) => {
  console.error(`✘ ${err.message}`);
  process.exit(1);
});
