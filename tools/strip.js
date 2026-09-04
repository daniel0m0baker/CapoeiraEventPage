#!/usr/bin/env node
// strip.js — generate the public single-file app from a private copy.
//
// Usage:
//   node tools/strip.js <private.html> <public.html>   write the stripped file
//   node tools/strip.js --test                          run the built-in self-test
//
// What it does, in order:
//   1. Removes every block between the markers below. Whole lines are removed,
//      marker lines included, and a block may span any number of lines.
//        JS:    /* OSS-STRIP-START */ ... /* OSS-STRIP-END */
//        HTML:  <!-- OSS-STRIP-START --> ... <!-- OSS-STRIP-END -->
//      Both marker styles may be mixed in one file. Markers may share a line
//      with other code only if that code is also meant to go.
//   2. Replaces the tokens listed in tools/strip.config.json ("replace": {from: to}).
//      Plain string replacement, all occurrences, longest key first.
//   3. Fails (exit 1) on an unbalanced or nested marker, and if any
//      "mustNotContain" string from the config survives in the output, or if
//      a <script> block in the output no longer passes node --check.
//
// No dependencies. Node 18+.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const START_RE = /\/\*\s*OSS-STRIP-START\s*\*\/|<!--\s*OSS-STRIP-START\s*-->/;
const END_RE = /\/\*\s*OSS-STRIP-END\s*\*\/|<!--\s*OSS-STRIP-END\s*-->/;

function stripMarkedBlocks(src) {
  const eol = src.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  const out = [];
  let inBlock = false;
  let openedAt = -1;
  let removed = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isStart = START_RE.test(line);
    const isEnd = END_RE.test(line);
    if (isStart && isEnd) {
      // single-line block: /* OSS-STRIP-START */ secret(); /* OSS-STRIP-END */
      if (inBlock) throw new Error(`nested OSS-STRIP-START on line ${i + 1} (block opened on line ${openedAt + 1})`);
      removed++;
      continue;
    }
    if (isStart) {
      if (inBlock) throw new Error(`nested OSS-STRIP-START on line ${i + 1} (block opened on line ${openedAt + 1})`);
      inBlock = true;
      openedAt = i;
      continue;
    }
    if (isEnd) {
      if (!inBlock) throw new Error(`OSS-STRIP-END without START on line ${i + 1}`);
      inBlock = false;
      removed++;
      continue;
    }
    if (!inBlock) out.push(line);
  }
  if (inBlock) throw new Error(`OSS-STRIP-START on line ${openedAt + 1} was never closed`);
  return { text: out.join(eol), removed };
}

function replaceTokens(src, map) {
  const keys = Object.keys(map || {}).sort((a, b) => b.length - a.length);
  let text = src;
  const counts = {};
  for (const from of keys) {
    const parts = text.split(from);
    counts[from] = parts.length - 1;
    text = parts.join(map[from]);
  }
  return { text, counts };
}

function strip(src, config) {
  const blocks = stripMarkedBlocks(src);
  const tokens = replaceTokens(blocks.text, config.replace);
  const leaks = (config.mustNotContain || []).filter((s) => tokens.text.indexOf(s) !== -1);
  return { text: tokens.text, removed: blocks.removed, counts: tokens.counts, leaks };
}

function loadConfig() {
  const cfgPath = path.join(__dirname, 'strip.config.json');
  return fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : { replace: {} };
}

// node --check on every inline <script> block; returns [] or a list of error strings.
function checkScripts(html, label) {
  const errors = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  let n = 0;
  while ((m = re.exec(html))) {
    n++;
    if (/\bsrc\s*=/i.test(m[1])) continue;
    const tmp = path.join(os.tmpdir(), `strip-check-${process.pid}-${label}-${n}.js`);
    fs.writeFileSync(tmp, m[2]);
    const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    fs.unlinkSync(tmp);
    if (r.status !== 0) errors.push(`<script> #${n}: ${r.stderr.trim()}`);
  }
  return errors;
}

// ── self-test ──────────────────────────────────────────────────────────────
function selfTest() {
  const fixture = [
    '<!DOCTYPE html><html><head>',
    '<!-- OSS-STRIP-START -->',
    '<script src="https://cdn.jsdelivr.net/npm/@twemoji/api@15/dist/twemoji.min.js" crossorigin="anonymous"></script>',
    '<!-- OSS-STRIP-END -->',
    '</head><body>',
    '<div id="app">hello</div>',
    '<script>',
    "var BUCKET='xara-real-bucket-name';",
    "var ACCESS_KEY='AKIAREALKEY';",
    "var PAYPAL_URL='https://www.paypal.com/ncp/payment/REALBUTTONID';",
    'function setLang(lang){',
    "  document.documentElement.lang=lang;",
    '  /* OSS-STRIP-START */',
    '  twemoji.parse(document.body, {',
    "    folder: 'svg',",
    "    ext: '.svg',",
    '    callback: function(icon, options){ return options.base + options.size + \'/\' + icon + options.ext; }',
    '  });',
    '  /* OSS-STRIP-END */',
    '  return lang;',
    '}',
    "document.addEventListener('DOMContentLoaded', function(){",
    "  setLang('en');",
    '  /* OSS-STRIP-START */ twemoji.parse(document.body); /* OSS-STRIP-END */',
    '});',
    '</script>',
    '</body></html>',
  ].join('\n');

  const config = {
    replace: {
      'xara-real-bucket-name': 'YOUR_BUCKET',
      AKIAREALKEY: 'YOUR_ACCESS_KEY',
      REALBUTTONID: 'YOUR_PAYPAL_BUTTON_ID',
    },
    mustNotContain: ['twemoji', 'AKIAREALKEY'],
  };

  const failures = [];
  const assert = (cond, msg) => { if (!cond) failures.push(msg); };

  const res = strip(fixture, config);
  assert(res.removed === 3, `expected 3 removed blocks, got ${res.removed}`);
  assert(res.text.indexOf('twemoji') === -1, 'twemoji reference survived');
  assert(res.text.indexOf('OSS-STRIP') === -1, 'a marker survived');
  assert(res.text.indexOf("BUCKET='YOUR_BUCKET'") !== -1, 'bucket token not replaced');
  assert(res.text.indexOf('YOUR_ACCESS_KEY') !== -1, 'access key token not replaced');
  assert(res.text.indexOf('payment/YOUR_PAYPAL_BUTTON_ID') !== -1, 'paypal token not replaced');
  assert(res.text.indexOf('<div id="app">hello</div>') !== -1, 'unmarked HTML was lost');
  assert(res.text.indexOf('  return lang;') !== -1, 'code after a multi-line block was lost');
  assert(res.text.indexOf("  setLang('en');") !== -1, 'code before a single-line block was lost');
  assert(res.leaks.length === 0, `leak check reported: ${res.leaks.join(', ')}`);
  const errs = checkScripts(res.text, 'selftest');
  assert(errs.length === 0, `stripped output does not parse:\n${errs.join('\n')}`);

  // CRLF input keeps CRLF output
  const crlf = strip(fixture.replace(/\n/g, '\r\n'), config);
  assert(crlf.text.indexOf('\r\n') !== -1 && crlf.text.indexOf('twemoji') === -1, 'CRLF input not handled');

  // unbalanced markers must fail loudly
  let threw = false;
  try { strip('a\n/* OSS-STRIP-START */\nb\n', config); } catch (e) { threw = true; }
  assert(threw, 'unclosed block did not throw');
  threw = false;
  try { strip('a\n/* OSS-STRIP-START */\n/* OSS-STRIP-START */\n/* OSS-STRIP-END */\n', config); } catch (e) { threw = true; }
  assert(threw, 'nested block did not throw');

  if (failures.length) {
    console.error('strip.js self-test FAILED');
    failures.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('strip.js self-test passed (3 blocks removed, 3 tokens replaced, output passes node --check)');
}

// ── CLI ────────────────────────────────────────────────────────────────────
function main(argv) {
  if (argv[0] === '--test') return selfTest();
  if (argv.length !== 2) {
    console.error('usage: node tools/strip.js <private.html> <public.html>\n       node tools/strip.js --test');
    process.exit(2);
  }
  const [inFile, outFile] = argv;
  const config = loadConfig();
  const src = fs.readFileSync(inFile, 'utf8');
  let res;
  try { res = strip(src, config); } catch (e) { console.error('strip.js: ' + e.message); process.exit(1); }
  fs.writeFileSync(outFile, res.text);
  console.log(`${inFile} -> ${outFile}: ${res.removed} marked block(s) removed`);
  for (const k of Object.keys(res.counts)) console.log(`  ${res.counts[k]}x  ${k} -> ${config.replace[k]}`);
  let exit = 0;
  if (res.leaks.length) {
    console.error('WARNING: strings from mustNotContain are still present: ' + res.leaks.join(', '));
    exit = 1;
  }
  const errs = checkScripts(res.text, path.basename(outFile));
  if (errs.length) {
    console.error('ERROR: output has a script block that does not parse:\n' + errs.join('\n'));
    exit = 1;
  } else {
    console.log('  all <script> blocks in the output pass node --check');
  }
  process.exit(exit);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { strip, stripMarkedBlocks, replaceTokens, checkScripts };
