import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, devices, expect } from "@playwright/test";

// This deliberately uses the live provider and can consume the shared AI quota.
// Run manually after enabling AI, not as part of CI or the offline test suite.
const base = process.argv[2] || "https://moodswipe.jdforsythe.workers.dev";
const health = await fetch(new URL("/api/health", base)).then((r) => r.json());
assert.equal(
  health.ai,
  "configured",
  "Enable AI on the Worker before this check.",
);
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();
  if (process.argv.includes("--dark")) {
    await page.addInitScript(() =>
      localStorage.setItem(
        "moodswipe:params",
        JSON.stringify({
          mood: "dark",
          topic: "Surprise Me",
          intensity: 4,
          aesthetic: "Cinematic",
          random: false,
        }),
      ),
    );
  }
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const generation = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/generate",
    { timeout: 60000 },
  );
  const started = Date.now();
  await page.goto(base);
  const viewer = page.getByTestId("viewer");
  await expect(page.getByTestId("first-card-loading")).toBeVisible();
  await expect(viewer).toHaveCount(0);
  await page.screenshot({ path: "artifacts/live-ai-loading.png" });
  const response = await generation;
  assert.equal(response.status(), 200, "The generation endpoint must succeed.");
  const batch = await response.json();
  const responseMs = Date.now() - started;
  assert.ok(
    batch.captions?.some((c) => c.source === "llm"),
    "No fresh captions returned: check provider availability, quota, cooldown and filters.",
  );
  await expect(viewer).toHaveAttribute("data-source", "llm", {
    timeout: 10000,
  });
  const generated = await viewer.getAttribute("data-card-id");
  const caption = await page.locator(".composition").getAttribute("alt");
  assert.ok(batch.captions.some((c) => c.text === caption));
  await page.screenshot({ path: "artifacts/live-ai-android-chromium.png" });

  const preview = await page.locator(".composition").evaluate(async (img) => {
    const bytes = await (await fetch(img.src)).arrayBuffer();
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      hash: Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };
  });
  assert.equal(preview.width, 1080);
  assert.equal(preview.height, 1440);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    }),
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const download = await downloadEvent;
  const chunks = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(chunk);
  assert.equal(
    createHash("sha256").update(Buffer.concat(chunks)).digest("hex"),
    preview.hash,
  );
  await expect(viewer).toHaveAttribute("data-card-id", generated);

  await page.getByRole("button", { name: "Photo and caption details" }).click();
  await expect(page.getByRole("dialog")).toContainText("AI-generated");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(viewer).not.toHaveAttribute("data-card-id", generated);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await page.reload();
  await expect(viewer).toBeVisible();
  await expect(
    page.getByText("Offline collection", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rejected feed", exact: true })
    .click();
  await expect(viewer).toHaveAttribute("data-card-id", generated);
  await expect(viewer).toHaveAttribute("data-source", "llm");
  assert.deepEqual(errors, []);
  const result = {
    url: base,
    health,
    acceptedCaptions: batch.captions.length,
    responseMs,
    captions: batch.captions.map((c) => c.text),
    firstCardIsAI: true,
    liveAICaption: caption,
    image: `${preview.width}x${preview.height}`,
    identicalPNGExport: true,
    shareRetainsCard: true,
    generatedCardSurvivesOfflineReloadInRejected: true,
    screenshot: "artifacts/live-ai-android-chromium.png",
  };
  await writeFile(
    "artifacts/live-ai-result.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
