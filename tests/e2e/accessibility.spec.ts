import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated WCAG 2.1 A/AA scan of every route in both themes. It catches the
 * mechanical failures — contrast, missing accessible names, ARIA misuse,
 * landmark structure — that are easy to regress and tedious to find by hand.
 */
async function scan(page: Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
}

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: /Continue as Mia/ }).click();
  await expect(page).toHaveURL(/\/inbox/);
}

const ROUTES = ["/inbox", "/kb", "/kb/sso-login-loop"];

test("the sign-in page has no detectable violations", async ({ page }) => {
  await page.goto("/sign-in");
  const results = await scan(page);
  expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))).toEqual([]);
});

for (const path of ROUTES) {
  for (const theme of ["light", "dark"] as const) {
    test(`${path} has no detectable violations (${theme})`, async ({ page }) => {
      await signIn(page);
      await page.goto(path);
      await page.evaluate(
        (value) => localStorage.setItem("supportflow.theme", value),
        theme,
      );
      await page.reload();
      await page.waitForLoadState("networkidle");
      const results = await scan(page);
      expect(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      ).toEqual([]);
    });
  }
}

test("the ticket detail view is accessible, composer and all", async ({ page }) => {
  await signIn(page);
  await page.goto("/inbox?status=open");
  await page.getByRole("listitem").first().getByRole("link").first().click();
  await page.waitForLoadState("networkidle");
  const results = await scan(page);
  expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))).toEqual([]);
});

test("the AI panel is accessible once it has output", async ({ page }) => {
  await signIn(page);
  await page.goto("/inbox?status=open");
  await page.getByRole("listitem").first().getByRole("link").first().click();
  await page.getByRole("button", { name: "Summarise" }).click();
  await expect(page.getByText("Assistant", { exact: true })).toBeVisible();
  const results = await scan(page);
  expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))).toEqual([]);
});
