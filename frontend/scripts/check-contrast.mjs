#!/usr/bin/env node
/**
 * Verifies the design tokens meet WCAG 2.1 AA contrast requirements.
 *
 * Checking tokens rather than call sites is deliberate. Once components
 * reference `text-content-muted` instead of a literal shade, validating the
 * dozen tokens validates every one of the hundred-plus places they are used —
 * and keeps doing so for components written later.
 *
 * Thresholds (WCAG 2.1):
 *   1.4.3 Contrast (Minimum)  — 4.5:1 normal text, 3:1 large text (>=24px, or
 *                               >=18.66px bold)
 *   1.4.11 Non-text Contrast  — 3:1 for UI components and meaningful graphics
 *
 * `content-faint` is exempt from the text threshold by naming convention: it is
 * reserved for icons and rules, and is asserted against the 3:1 non-text bar
 * instead. If it ever carries body text, that is the bug — not this script.
 *
 * Usage:  node scripts/check-contrast.mjs
 * Exit:   0 pass, 1 any token below its threshold
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const GLOBALS = join(ROOT, "src", "app", "globals.css");

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3.0;

/** Tokens reserved for non-text use, held to 1.4.11's 3:1 instead of 4.5:1. */
const NON_TEXT_TOKENS = new Set(["content-faint"]);

function parseTokens() {
  const css = readFileSync(GLOBALS, "utf8");
  const theme = css.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/);
  if (!theme) {
    console.error("check-contrast: no @theme inline block found in globals.css");
    process.exit(1);
  }
  const tokens = new Map();
  for (const m of theme[1].matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})/gi)) {
    tokens.set(m[1].toLowerCase(), m[2].toLowerCase());
  }
  return tokens;
}

/** WCAG 2.1 relative luminance. */
function luminance(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const tokens = parseTokens();
const surfaces = [...tokens.keys()].filter((k) => k.startsWith("surface-"));
const foregrounds = [...tokens.keys()].filter(
  (k) => k.startsWith("content-") || k.startsWith("status-"),
);

if (surfaces.length === 0 || foregrounds.length === 0) {
  console.error("check-contrast: expected surface-* and content-*/status-* tokens");
  process.exit(1);
}

const failures = [];
const rows = [];

for (const fg of foregrounds) {
  const required = NON_TEXT_TOKENS.has(fg) ? AA_NON_TEXT : AA_TEXT;
  for (const bg of surfaces) {
    // surface-hover is a transient state of surface-raised; checking against
    // the resting surface is the meaningful test.
    if (bg === "surface-hover") continue;
    const ratio = contrast(tokens.get(fg), tokens.get(bg));
    const pass = ratio >= required;
    rows.push({ fg, bg, ratio, required, pass });
    if (!pass) failures.push({ fg, bg, ratio, required });
  }
}

const width = Math.max(...rows.map((r) => `${r.fg} on ${r.bg}`.length));
for (const r of rows) {
  const label = `${r.fg} on ${r.bg}`.padEnd(width);
  const note = NON_TEXT_TOKENS.has(r.fg) ? " (non-text, 3:1)" : "";
  console.log(
    `  ${r.pass ? "PASS" : "FAIL"}  ${label}  ${r.ratio.toFixed(2)}:1  need ${r.required}:1${note}`,
  );
}

if (failures.length > 0) {
  console.error(`\ncheck-contrast: ${failures.length} token pairing(s) below WCAG AA`);
  for (const f of failures) {
    console.error(
      `  ${f.fg} on ${f.bg} is ${f.ratio.toFixed(2)}:1, needs ${f.required}:1`,
    );
  }
  process.exit(1);
}

console.log(`\ncheck-contrast: ${rows.length} token pairings pass WCAG AA`);
process.exit(0);
