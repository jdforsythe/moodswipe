import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir("artifacts", { recursive: true });
await Promise.all(
  ["static", "source"].map((kind) =>
    rm(`artifacts/moodswipe-${kind}.zip`, { force: true }),
  ),
);
execFileSync("zip", ["-qr", "../artifacts/moodswipe-static.zip", "."], {
  cwd: "dist",
});
const roots = [
  "artifacts/phase1-android-chromium.png",
  "artifacts/phase1-iphone-webkit.png",
  "artifacts/typography-grid.png",
  "src",
  "shared",
  "worker",
  "public",
  "scripts",
  "tests",
  "e2e",
  "docs",
  ".github",
  "package.json",
  "package-lock.json",
  "index.html",
  "vite.config.ts",
  "vitest.config.ts",
  "playwright.config.ts",
  "tsconfig.json",
  "tsconfig.worker.json",
  "wrangler.jsonc",
  ".gitignore",
  ".env.example",
  "README.md",
  "ARCHITECTURE.md",
  "PRIVACY.md",
  "LICENSES.md",
  "TESTING.md",
  "OPERATOR.md",
];
for (const path of [
  "artifacts/dark-humor-variety.png",
  "artifacts/dark-humor-variety.json",
  "artifacts/caption-evaluation.json",
  "artifacts/production-android-chromium.png",
  "artifacts/production-iphone-webkit.png",
  "artifacts/live-ai-android-chromium.png",
  "artifacts/live-ai-loading.png",
  "artifacts/live-ai-result.json",
]) {
  if (await stat(path).catch(() => null)) roots.push(path);
}
for (const name of await readdir("artifacts")) {
  const path = `artifacts/${name}`;
  if (/^caption-evaluation.*\.json$/.test(name) && !roots.includes(path))
    roots.push(path);
}
execFileSync("zip", ["-qr", "artifacts/moodswipe-source.zip", ...roots]);
for (const name of ["moodswipe-static.zip", "moodswipe-source.zip"])
  console.log(`${name}: ${(await stat(`artifacts/${name}`)).size} bytes`);
