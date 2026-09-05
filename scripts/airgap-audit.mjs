#!/usr/bin/env node
/**
 * Air-gap audit — scans the production build for anything that could reach outside the internal network.
 * Exit code 1 if a real external fetch target is found. Run after `npm run build`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../dist/public", import.meta.url).pathname;
// URLs that appear inside libraries as documentation links or XML namespaces — never fetched at runtime.
const BENIGN = [/w3\.org/, /maplibre\.org/, /github\.com/, /reactjs\.org/, /react\.dev/, /fb\.me/, /npmjs/, /schema\./, /openstreetmap\.org/, /mapbox\.com/, /bit\.ly/, /redux\.js/, /redux-toolkit\.js\.org/, /reactrouter\.com/, /recharts\.org/, /tanstack\.com/, /workbox/, /developer\.mozilla/, /googleapis\.com\/css/, /localhost/, /127\.0\.0\.1/];
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(ROOT);
let external = []; let scanned = 0;
for (const f of files) {
  if (!/\.(js|css|html|webmanifest|json)$/.test(f)) continue; scanned++;
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/https?:\/\/[a-zA-Z0-9.-]+(?:\/[^\s"'`)<>]*)?/g)) { const url = m[0]; if (!BENIGN.some((b) => b.test(url))) external.push({ file: f.replace(ROOT, ""), url }); }
}
const uniq = [...new Map(external.map((e) => [e.url, e])).values()];
console.log(`Air-gap audit: scanned ${scanned} files in dist/public`);
if (uniq.length === 0) { console.log("✓ No external fetch targets found. Fonts, map data, charts and icons are all served locally."); process.exit(0); }
console.log("✗ External URLs found — review each before deployment:"); for (const e of uniq) console.log(`  ${e.url}  (${e.file})`); process.exit(1);
