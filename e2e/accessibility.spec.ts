import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("feed and modal have no automated WCAG A/AA violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("viewer")).toBeVisible();
  const audit = () =>
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
  expect((await audit()).violations).toEqual([]);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  expect((await audit()).violations).toEqual([]);
});
