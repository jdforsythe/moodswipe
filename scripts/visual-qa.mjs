import { chromium, devices } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
const browser = await chromium.launch();
const page = await browser.newPage({ ...devices["Pixel 7"] });
await page.goto("http://127.0.0.1:4173");
await page.getByTestId("viewer").waitFor();
const moods = [
  "Motivational",
  "Sarcastic",
  "Funny",
  "Absurd",
  "Dark Humor",
  "Wholesome",
];
const images = [];
for (let i = 0; i < moods.length; i++) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: moods[i], exact: true }).click();
  await page.getByRole("button", { name: "Set the mood" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.waitForTimeout(150);
  const bytes = await page
    .locator(".composition")
    .evaluate(async (img) =>
      Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())),
    );
  const buffer = Buffer.from(bytes);
  await writeFile(`artifacts/mood-${i}.png`, buffer);
  images.push({
    input: await sharp(buffer).resize(324, 432).toBuffer(),
    left: (i % 3) * 324,
    top: Math.floor(i / 3) * 432,
  });
}
await sharp({
  create: { width: 972, height: 864, channels: 3, background: "#131815" },
})
  .composite(images)
  .png()
  .toFile("artifacts/typography-grid.png");
await browser.close();
console.log("Six rendered mood compositions captured.");
