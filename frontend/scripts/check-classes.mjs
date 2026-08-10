#!/usr/bin/env node
/**
 * Fails the build on Tailwind utility classes that emit no CSS.
 *
 * Tailwind's default palette only defines shades 50/100/200/.../900/950. A class
 * like `text-slate-450` is not an error — Tailwind simply skips it, so the build
 * succeeds, TypeScript passes, and the element silently renders with inherited
 * colour instead of the intended one. This codebase accumulated 60 such classes
 * before anyone noticed.
 *
 * Custom shades declared in the `@theme inline` block of globals.css are valid
 * and are read from that file rather than hardcoded here, so adding a token
 * automatically permits its utility.
 *
 * Usage:  node scripts/check-classes.mjs
 * Exit:   0 clean, 1 violations found
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");
const GLOBALS = join(SRC, "app", "globals.css");

/** Shades Tailwind generates by default. */
const DEFAULT_SHADES = new Set([
  "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950",
]);

/** Utility prefixes that take a colour value. */
const COLOR_PREFIXES = [
  "text", "bg", "border", "ring", "fill", "stroke", "divide", "placeholder",
  "from", "to", "via", "outline", "shadow", "accent", "caret", "decoration",
];

/** Tailwind's built-in colour families. */
const COLOR_FAMILIES = [
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber",
  "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

/**
 * Numeric-scale utilities Tailwind v4 computes rather than enumerates.
 * `z-55` and `pl-27` are valid; `scale-102` is not, because scale reads from a
 * fixed set. Listed explicitly so the check does not produce false positives.
 */
const COMPUTED_NUMERIC_PREFIXES = new Set([
  "z", "p", "px", "py", "pt", "pr", "pb", "pl", "m", "mx", "my", "mt", "mr",
  "mb", "ml", "w", "h", "min-w", "min-h", "max-w", "max-h", "gap", "gap-x",
  "gap-y", "top", "right", "bottom", "left", "inset", "space-x", "space-y",
  "basis", "size", "translate-x", "translate-y", "rounded",
]);

const FIXED_SCALE_PREFIXES = new Set(["scale", "opacity", "order", "grow", "shrink"]);
const VALID_SCALE = new Set([
  "0", "50", "75", "90", "95", "100", "105", "110", "125", "150", "200",
]);
const VALID_OPACITY = new Set([
  "0", "5", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55", "60",
  "65", "70", "75", "80", "85", "90", "95", "100",
]);

/** Read custom `--color-<name>-<shade>` declarations out of globals.css. */
function readThemeShades() {
  const allowed = new Set();
  let css;
  try {
    css = readFileSync(GLOBALS, "utf8");
  } catch {
    return allowed;
  }
  const theme = css.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/);
  if (!theme) return allowed;
  for (const m of theme[1].matchAll(/--color-([a-z0-9-]+)\s*:/gi)) {
    allowed.add(m[1].toLowerCase());
  }
  return allowed;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx|ts|js)$/.test(entry)) out.push(full);
  }
  return out;
}

const themeColors = readThemeShades();
const colorRe = new RegExp(
  `\\b(?:[a-z-]+:)*(${COLOR_PREFIXES.join("|")})-(${COLOR_FAMILIES.join("|")})-(\\d+)\\b`,
  "g",
);
const numericRe = /\b(?:[a-z-]+:)*([a-z-]+?)-(\d+)\b/g;

const violations = [];

for (const file of walk(SRC)) {
  const lines = readFileSync(file, "utf8").split("\n");
  const rel = relative(ROOT, file).replace(/\\/g, "/");

  lines.forEach((line, i) => {
    for (const m of line.matchAll(colorRe)) {
      const [full, , family, shade] = m;
      if (DEFAULT_SHADES.has(shade)) continue;
      if (themeColors.has(`${family}-${shade}`)) continue;
      violations.push({
        file: rel,
        line: i + 1,
        cls: full,
        why: `shade ${shade} is not in Tailwind's palette and no --color-${family}-${shade} token exists`,
      });
    }

    for (const m of line.matchAll(numericRe)) {
      const [full, prefix, value] = m;
      if (!FIXED_SCALE_PREFIXES.has(prefix)) continue;
      if (COMPUTED_NUMERIC_PREFIXES.has(prefix)) continue;
      const valid = prefix === "opacity" ? VALID_OPACITY : VALID_SCALE;
      if (valid.has(value)) continue;
      violations.push({
        file: rel,
        line: i + 1,
        cls: full,
        why: `${prefix} does not accept ${value}; use an arbitrary value like ${prefix}-[1.02]`,
      });
    }
  });
}

if (violations.length === 0) {
  console.log("check-classes: no dead utility classes found");
  process.exit(0);
}

console.error(`check-classes: ${violations.length} class(es) emit no CSS\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.cls}`);
  console.error(`      ${v.why}`);
}
console.error("\nThese fail silently: the build succeeds and the element renders unstyled.");
process.exit(1);
