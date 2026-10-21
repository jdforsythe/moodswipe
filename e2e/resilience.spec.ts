import { test, expect } from "@playwright/test";
const candidate = {
  id: "server-id",
  text: "This mountain has respectfully declined to join my video call.",
  mood: "sarcastic",
  topic: "Everyday",
  intensity: 3,
  technique: "deadpan",
  visualKeywords: ["mountain"],
  visualAesthetic: "Nature",
  source: "llm",
};
test("depleted AI supply retries a short cooldown and replaces only queued cards", async ({
  page,
}) => {
  let calls = 0;
  const next = {
    ...candidate,
    text: "The forest has put my entire inbox on a very quiet hold.",
  };
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ai: "configured" } }),
  );
  await page.route("**/api/generate", (r) => {
    calls++;
    return r.fulfill({
      json:
        calls === 2
          ? { captions: [], reason: "paced", retryAfter: 1 }
          : { captions: [calls === 1 ? candidate : next], retryAfter: 1 },
    });
  });
  await page.goto("/");
  const viewer = page.getByTestId("viewer");
  await expect(viewer).toHaveAttribute("data-source", "llm");
  const first = await viewer.getAttribute("data-card-id");
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(viewer).not.toHaveAttribute("data-card-id", first!);
  const current = await viewer.getAttribute("data-card-id");
  await expect.poll(() => calls).toBe(3);
  await expect(page.getByTestId("generation-status")).toContainText(
    "Fresh captions are ready",
  );
  await expect(viewer).toHaveAttribute("data-card-id", current!);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.locator(".composition")).toHaveAttribute("alt", next.text);
});

test("a budget fallback is explained and can recover through Try fresh captions", async ({
  page,
}) => {
  let available = false;
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ai: "configured" } }),
  );
  await page.route("**/api/generate", (r) =>
    r.fulfill({
      json: available
        ? { captions: [candidate], retryAfter: 15 }
        : { captions: [], reason: "daily_budget", retryAfter: 86400 },
    }),
  );
  await page.goto("/");
  const viewer = page.getByTestId("viewer");
  await expect(viewer).toHaveAttribute("data-source", "local");
  await expect(page.getByTestId("generation-status")).toContainText(
    "AI limit has been reached",
  );
  available = true;
  await page.getByRole("button", { name: "Try fresh captions" }).click();
  await expect(page.getByTestId("generation-status")).toContainText(
    "Fresh captions are ready",
  );
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-source", "llm");
});
test("online launch waits with a spinner and shows AI as the first card", async ({
  page,
}) => {
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ai: "configured", photos: "disabled" } }),
  );
  await page.route("**/api/generate", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await r.fulfill({ json: { captions: [candidate], retryAfter: 60 } });
  });
  await page.goto("/");
  const viewer = page.getByTestId("viewer");
  await expect(page.getByTestId("first-card-loading")).toBeVisible();
  await expect(page.locator(".loading-spinner")).toBeVisible();
  await expect(viewer).toHaveCount(0);
  await expect(viewer).toHaveAttribute("data-source", "llm");
  await expect(page.locator(".composition")).toHaveAttribute(
    "alt",
    candidate.text,
  );
});
test("failed provider and malicious model payload preserve usable offline feed", async ({
  page,
}) => {
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ai: "configured" } }),
  );
  await page.route("**/api/generate", (r) =>
    r.fulfill({ status: 503, json: { captions: [], mode: "local" } }),
  );
  await page.goto("/");
  await expect(page.getByTestId("viewer")).toHaveAttribute(
    "data-source",
    "local",
  );
  await page.waitForTimeout(700);
  const first = await page.getByTestId("viewer").getAttribute("data-card-id");
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.getByTestId("viewer")).not.toHaveAttribute(
    "data-card-id",
    first!,
  );
  await page.unroute("**/api/generate");
  await page.route("**/api/generate", (r) =>
    r.fulfill({
      json: {
        captions: [{ ...candidate, text: "<img src=x onerror=alert(1)>evil" }],
      },
    }),
  );
  await page.reload();
  await expect(page.getByTestId("viewer")).toHaveAttribute(
    "data-source",
    "local",
  );
  await page.waitForTimeout(700);
  expect(await page.locator("script[src=x]").count()).toBe(0);
});
test("remote photo CORS failure falls back to a bundled, exportable composition", async ({
  page,
}) => {
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ai: "disabled", photos: "configured" } }),
  );
  await page.route("**/api/photos", (r) =>
    r.fulfill({
      json: {
        photos: [
          {
            id: "pexels-99",
            url: "https://images.pexels.com/photos/99/photo.jpg",
            source: "Pexels",
            sourceUrl: "https://www.pexels.com/photo/test-99/",
            creator: "Test Photographer",
            license: "Pexels License",
            licenseUrl: "https://www.pexels.com/license/",
            width: 1200,
            height: 1600,
            cacheAllowed: true,
            categories: [
              "forest",
              "nature",
              "quiet",
              "space",
              "water",
              "work",
              "city",
            ],
            aesthetics: ["Nature"],
          },
        ],
      },
    }),
  );
  let failed = 0;
  await page.route("https://images.pexels.com/**", (r) => {
    failed++;
    return r.abort("failed");
  });
  await page.goto("/");
  await expect(page.getByTestId("viewer")).toBeVisible();
  await page.waitForTimeout(1000);
  for (let i = 0; i < 7; i++) {
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await page.waitForTimeout(200);
  }
  await expect(page.getByTestId("viewer")).toBeVisible();
  expect(failed).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Photo and caption details" }).click();
  await expect(page.getByRole("dialog")).toContainText("Unsplash License");
});
test("real touch swipe advances the feed", async ({ page, browserName }) => {
  test.skip(
    browserName !== "chromium",
    "CDP touch injection is Chromium-specific; WebKit pointer suite is separate.",
  );
  await page.goto("/");
  const viewer = page.getByTestId("viewer");
  await expect(viewer).toBeVisible();
  await page.waitForTimeout(700);
  const box = (await viewer.boundingBox())!;
  const x = box.x + box.width * 0.6,
    y = box.y + box.height * 0.5;
  const first = await viewer.getAttribute("data-card-id");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - i * 14, y }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(viewer).not.toHaveAttribute("data-card-id", first!);
  await cdp.detach();
});
test("iOS open-image Share fallback never advances", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: "iPhone",
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    });
  });
  await page.goto("/");
  const v = page.getByTestId("viewer");
  await expect(v).toBeVisible();
  const first = await v.getAttribute("data-card-id");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Back to this meme" }).click();
  await expect(v).toHaveAttribute("data-card-id", first!);
});
test("landscape controls fit within the visible screen", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(page.getByTestId("viewer")).toBeVisible();
  for (const name of ["Dismiss", "Share", "Save"]) {
    const b = (await page
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(390);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
});
test("rejected PNG survives reload and repeated share commands invoke once", async ({
  page,
}) => {
  await page.goto("/");
  const v = page.getByTestId("viewer");
  await expect(v).toBeVisible();
  await page.waitForTimeout(500);
  const first = await v.getAttribute("data-card-id");
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(v).not.toHaveAttribute("data-card-id", first!);
  await page.reload();
  await expect(v).toBeVisible();
  await page
    .getByRole("button", { name: "Rejected feed", exact: true })
    .click();
  await expect(v).toHaveAttribute("data-card-id", first!);
  await page.evaluate(() => {
    const w = window as unknown as { calls: number; finish: () => void };
    w.calls = 0;
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: () => {
        w.calls++;
        return new Promise<void>((resolve) => {
          w.finish = resolve;
        });
      },
      configurable: true,
    });
  });
  await v.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  expect(
    await page.evaluate(() => (window as unknown as { calls: number }).calls),
  ).toBe(1);
  await page.evaluate(() =>
    (window as unknown as { finish: () => void }).finish(),
  );
  await expect(page.getByRole("status")).toContainText("Shared");
  await expect(v).toHaveAttribute("data-card-id", first!);
});
