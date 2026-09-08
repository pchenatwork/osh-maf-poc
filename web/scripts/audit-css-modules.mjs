/**
 * Cross-checks every CSS Module reference against the stylesheet behind it.
 *
 * Why this exists: vite/client types a CSS Module as
 *   { readonly [key: string]: string }
 * an index signature, so `styles.tpyo` type-checks cleanly and renders no
 * class at all. Neither tsc nor eslint can see it. The failure is silent and
 * visual — exactly the kind that survives review.
 *
 * Reports both directions:
 *   - a styles.X with no matching selector  -> renders className={undefined}
 *   - a selector nothing references         -> dead CSS
 *
 * Usage: npm run audit:css   (exits non-zero on any finding, so CI can gate)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
    return [p];
  });
}

const files = walk(SRC);
const rel = (p) => relative(SRC, p).replaceAll("\\", "/");

const referenced = new Map(); // css path -> Set of keys
const problems = [];

for (const tsx of files.filter((f) => f.endsWith(".tsx"))) {
  const src = readFileSync(tsx, "utf8");
  const imports = [...src.matchAll(/import\s+(\w+)\s+from\s+"([^"]+\.module\.css)"/g)];

  for (const [, alias, spec] of imports) {
    const css = resolve(dirname(tsx), spec);
    let sheet;
    try {
      sheet = readFileSync(css, "utf8");
    } catch {
      problems.push(`${rel(tsx)}: imports ${spec}, which does not exist`);
      continue;
    }

    const defined = new Set([...sheet.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));
    if (!referenced.has(css)) referenced.set(css, new Set());

    for (const [, key] of src.matchAll(new RegExp(`\\b${alias}\\.(\\w+)`, "g"))) {
      referenced.get(css).add(key);
      if (!defined.has(key)) {
        problems.push(`${rel(tsx)}: ${alias}.${key} has no selector in ${rel(css)}`);
      }
    }
  }
}

for (const css of files.filter((f) => f.endsWith(".module.css"))) {
  const sheet = readFileSync(css, "utf8");
  const defined = new Set([...sheet.matchAll(/^\s*\.([A-Za-z][\w-]*)/gm)].map((m) => m[1]));
  const used = referenced.get(css) ?? new Set();
  for (const key of defined) {
    if (!used.has(key)) problems.push(`${rel(css)}: .${key} is never referenced`);
  }
}

if (problems.length) {
  console.error(`CSS Module audit — ${problems.length} problem(s):`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("CSS Module audit: clean.");
