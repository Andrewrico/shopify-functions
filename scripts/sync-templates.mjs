// Pulls Shopify's Function templates (JavaScript flavor) into templates/<type>/.
// One-way only: reads Shopify/extensions-templates, writes this repo. Never pushes upstream.
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";

const UPSTREAM = "https://github.com/Shopify/extensions-templates.git";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "templates");

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ext-templates-"));
const git = (...args) => execFileSync("git", args, { cwd: tmp, encoding: "utf8" }).trim();
execFileSync("git", ["clone", "--quiet", "--depth", "1", UPSTREAM, tmp]);
git("remote", "set-url", "--push", "origin", "no-push");
const sha = git("rev-parse", "HEAD");

const engine = new Liquid();
const types = (await fs.readdir(tmp))
  .map((d) => d.match(/^functions-(.+)-js$/)?.[1])
  .filter(Boolean)
  .sort();

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

await fs.rm(out, { recursive: true, force: true });
for (const type of types) {
  const src = path.join(tmp, `functions-${type}-js`);
  const dest = path.join(out, type);
  const data = { name: `functions-${type}`, handle: `${type}-js`, flavor: "vanilla-js" };
  for await (const file of walk(src)) {
    const rel = path.relative(src, file);
    const isLiquid = rel.endsWith(".liquid");
    let target = path.join(dest, isLiquid ? rel.slice(0, -".liquid".length) : rel);
    // Extensionless files in src/ are the function entry points (.js for this flavor).
    if (isLiquid && path.dirname(rel) === "src" && !path.extname(target)) target += ".js";
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (isLiquid) await fs.writeFile(target, await engine.parseAndRender(await fs.readFile(file, "utf8"), data));
    else await fs.copyFile(file, target);
  }
  console.log(`templates/${type}`);
}

await fs.writeFile(
  path.join(out, "UPSTREAM"),
  `source: ${UPSTREAM.replace(/\.git$/, "")}\ncommit: ${sha}\n`,
);
await fs.rm(tmp, { recursive: true, force: true });
console.log(`${types.length} templates from ${sha.slice(0, 7)}`);
