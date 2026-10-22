import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

test("one fixed mood rotates photos, type and placement, including after reload", async ({
  page,
}, info) => {
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
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ai: "disabled", photos: "disabled" } }),
  );
  await page.goto("/");
  const viewer = page.getByTestId("viewer");
  await expect(viewer).toBeVisible();
  const cards: {
    photo: string;
    font: string;
    region: string;
    alignment: string;
    scrim: number;
    size: number;
    caption: string;
  }[] = [];
  const images = [];
  for (let i = 0; i < 16; i++) {
    const current = await viewer.getAttribute("data-card-id");
    const metadata = await viewer.evaluate((el) => ({
      photo: el.getAttribute("data-photo-id")!,
      font: el.getAttribute("data-font")!,
      region: el.getAttribute("data-region")!,
      alignment: el.getAttribute("data-alignment")!,
      scrim: Number(el.getAttribute("data-scrim")),
      size: Number(el.getAttribute("data-font-size")),
      caption: el.querySelector("img")!.alt,
    }));
    expect(cards.slice(-12).map((c) => c.photo)).not.toContain(metadata.photo);
    expect(cards.slice(-2).map((c) => c.font)).not.toContain(metadata.font);
    expect(metadata.size).toBeGreaterThanOrEqual(64);
    cards.push(metadata);
    if (info.project.name === "android-chromium" && i < 12) {
      const dataUrl = await page
        .locator(".composition")
        .evaluate(async (img: HTMLImageElement) => {
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = 324;
          canvas.height = 432;
          canvas.getContext("2d")!.drawImage(img, 0, 0, 324, 432);
          return canvas.toDataURL("image/png");
        });
      images.push({
        input: Buffer.from(dataUrl.split(",")[1], "base64"),
        left: (i % 4) * 324,
        top: Math.floor(i / 4) * 432,
      });
    }
    if (i === 12) {
      await page.reload();
      await expect(viewer).toBeVisible();
    } else {
      // Wait for composition of the next card, as a real reader would.
      await page.waitForTimeout(350);
      await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    }
    await expect(viewer).not.toHaveAttribute("data-card-id", current!);
  }
  expect(new Set(cards.map((c) => c.font)).size).toBeGreaterThanOrEqual(3);
  expect(new Set(cards.map((c) => c.region)).size).toBeGreaterThanOrEqual(2);
  expect(new Set(cards.map((c) => c.alignment)).size).toBeGreaterThanOrEqual(2);
  expect(new Set(cards.map((c) => c.size)).size).toBeGreaterThanOrEqual(3);
  expect(cards.filter((c) => c.scrim === 0).length).toBeGreaterThanOrEqual(4);
  if (info.project.name === "android-chromium") {
    await sharp({
      create: { width: 1296, height: 1296, channels: 3, background: "#151515" },
    })
      .composite(images)
      .png()
      .toFile("artifacts/dark-humor-variety.png");
    await writeFile(
      "artifacts/dark-humor-variety.json",
      JSON.stringify(cards, null, 2) + "\n",
    );
  }
});
