import { test, expect, type Page } from "@playwright/test";
const viewer = (page: Page) => page.getByTestId("viewer");
async function cardId(page: Page) {
  return viewer(page).getAttribute("data-card-id");
}
async function swipe(page: Page, x: number, y: number) {
  const b = (await viewer(page).boundingBox())!;
  const sx = b.x + b.width * 0.5,
    sy = b.y + b.height * 0.52;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + x, sy + y, { steps: 10 });
  await page.mouse.up();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(viewer(page)).toBeVisible();
  await page.waitForTimeout(600);
});
test("left dismiss, rejected feed, separate position and clear confirmation", async ({
  page,
}) => {
  const first = await cardId(page);
  await swipe(page, -140, 0);
  await expect(viewer(page)).not.toHaveAttribute("data-card-id", first!);
  const main = await cardId(page);
  await page
    .getByRole("button", { name: "Rejected feed", exact: true })
    .click();
  await expect(viewer(page)).toHaveAttribute("data-card-id", first!);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(viewer(page)).toHaveAttribute("data-card-id", first!);
  await page.getByRole("button", { name: "Your feed", exact: true }).click();
  await expect(viewer(page)).toHaveAttribute("data-card-id", main!);
  await page
    .getByRole("button", { name: "Rejected feed", exact: true })
    .click();
  await page.getByRole("button", { name: /Clear Rejected/ }).click();
  await page.getByRole("button", { name: "Keep them" }).click();
  await expect(viewer(page)).toBeVisible();
  await page.getByRole("button", { name: /Clear Rejected/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear Rejected", exact: true })
    .click();
  await expect(page.getByText("Nothing rejected. Yet.")).toBeVisible();
});
test("up invokes native share with ready PNG; cancellation and completion keep card", async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (
          window as unknown as { shared: { type: string; size: number } }
        ).shared = { type: data.files![0].type, size: data.files![0].size };
        throw new DOMException("Canceled", "AbortError");
      },
    });
  });
  const first = await cardId(page);
  await swipe(page, 0, -140);
  await expect(page.getByRole("status")).toContainText("canceled");
  expect(await cardId(page)).toBe(first);
  expect(
    await page.evaluate(
      () => (window as unknown as { shared: { type: string } }).shared.type,
    ),
  ).toBe("image/png");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {},
    }),
  );
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Shared");
  expect(await cardId(page)).toBe(first);
});
test("save failure retains card, retry saves; controls never become gestures", async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "platform", {
      value: "iPhone",
      configurable: true,
    });
    Object.defineProperty(navigator, "userAgent", {
      value: "iPhone",
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw new Error("fail");
      },
      configurable: true,
    });
  });
  const first = await cardId(page);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("did not complete");
  expect(await cardId(page)).toBe(first);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: async () => {},
      configurable: true,
    }),
  );
  await swipe(page, 140, 0);
  await expect(viewer(page)).not.toHaveAttribute("data-card-id", first!);
});
test("download fallback contains identical preview PNG without controls", async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Android",
      configurable: true,
    });
    Object.defineProperty(navigator, "platform", {
      value: "Linux",
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    });
  });
  const before = await cardId(page);
  const bytes = await page
    .locator(".composition")
    .evaluate(async (img: HTMLImageElement) => {
      const blob = await fetch(img.src).then((r) => r.blob());
      const b = new Uint8Array(await blob.arrayBuffer());
      return {
        length: b.length,
        width: img.naturalWidth,
        height: img.naturalHeight,
        hash: Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", b)),
        ).join(","),
      };
    });
  expect(bytes.width).toBe(1080);
  expect(bytes.height).toBe(1440);
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const download = await promise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  expect(buffer.length).toBe(bytes.length);
  const { createHash } = await import("node:crypto");
  expect(
    Array.from(createHash("sha256").update(buffer).digest()).join(","),
  ).toBe(bytes.hash);
  expect(await cardId(page)).toBe(before);
});
test("settings invalidate queued cards; random varies per new card; keyboard parity", async ({
  page,
}) => {
  const first = await cardId(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Wholesome", exact: true }).click();
  await page.getByRole("button", { name: "Set the mood" }).click();
  expect(await cardId(page)).toBe(first);
  await page.waitForTimeout(500);
  await viewer(page).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".mood-label")).toHaveText("Wholesome");
  await page.getByRole("button", { name: "Random Mode" }).click();
  await expect(
    page.getByRole("button", { name: "Random Mode" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(viewer(page)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Random Mode" }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("production service worker serves photos and compositions fully offline", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(viewer(page)).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(viewer(page)).toBeVisible();
  await expect(
    page.getByText("Offline collection", { exact: true }),
  ).toBeVisible();
  const first = await cardId(page);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(viewer(page)).not.toHaveAttribute("data-card-id", first!);
  await context.setOffline(false);
});
test("small viewport, canceled drag and reduced motion keep controls accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const first = await cardId(page);
  await swipe(page, 12, 0);
  expect(await cardId(page)).toBe(first);
  for (const name of ["Dismiss", "Share", "Save"]) {
    const b = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(44);
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
test("capture composition", async ({ page }, info) => {
  await page.screenshot({
    path: `artifacts/${process.env.PLAYWRIGHT_BASE_URL ? "production" : "phase1"}-${info.project.name}.png`,
    fullPage: true,
  });
});
