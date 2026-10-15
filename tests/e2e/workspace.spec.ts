import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end coverage of the journeys a reviewer would actually try, against
 * a real production build and a real SQLite database.
 */

async function signIn(page: Page, name: string) {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: new RegExp(`Continue as ${name}`) })
    .click();
  await expect(page).toHaveURL(/\/inbox/);
}

test.describe("authentication", () => {
  test("an unauthenticated visitor is sent to the demo sign-in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/inbox");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByRole("heading", { name: "SupportFlow", level: 1 }),
    ).toBeVisible();
  });

  test("signing in lands on the inbox and shows the role", async ({ page }) => {
    await signIn(page, "Nadia");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByText("agent · 7 permissions")).toBeVisible();
  });

  test("signing out clears the session", async ({ page }) => {
    await signIn(page, "Nadia");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/inbox");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("a tampered session cookie is rejected", async ({ page, context }) => {
    await signIn(page, "Nadia");
    // Re-sign the cookie as an admin without the signing key — the server must
    // refuse it and send the user back to sign-in.
    const forged = Buffer.from(
      JSON.stringify({
        agentId: "agt_rivera",
        role: "admin",
        issuedAt: Date.now(),
      }),
      "utf8",
    ).toString("base64url");
    await context.addCookies([
      {
        name: "supportflow_session",
        value: `${forged}.forgedsignature`,
        url: "http://127.0.0.1:3200",
      },
    ]);
    await page.goto("/inbox");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("inbox", () => {
  test.beforeEach(async ({ page }) => signIn(page, "Nadia"));

  test("lists tickets with status, priority and assignment", async ({ page }) => {
    await expect(page.getByText(/\d+ tickets/)).toBeVisible();
    const items = page.getByRole("listitem");
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeGreaterThan(5);
  });

  test("filters work without JavaScript state — they are links with real URLs", async ({ page }) => {
    await page
      .getByRole("complementary", { name: "Ticket filters" })
      .getByRole("link", { name: /^Pending/ })
      .click();
    await expect(page).toHaveURL(/status=pending/);
    await expect(page.getByText("1 filter active")).toBeVisible();

    const badges = page.getByRole("main").getByText("Pending", { exact: true });
    await expect(badges.first()).toBeVisible();
  });

  test("the unassigned queue shows only unassigned tickets", async ({ page }) => {
    await page.getByRole("link", { name: /^Unassigned/ }).click();
    await expect(page).toHaveURL(/assignee=unassigned/);
    const rows = page.getByRole("listitem");
    const count = await rows.count();
    for (let i = 0; i < Math.min(count, 5); i += 1) {
      await expect(rows.nth(i)).toContainText("Unassigned");
    }
  });

  test("search is a GET form, so the result is a shareable URL", async ({ page }) => {
    await page.getByRole("searchbox").fill("Northwind");
    await page.getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/q=Northwind/);
    await expect(page.getByRole("listitem").first()).toContainText("Northwind");
  });

  test("pagination moves through pages", async ({ page }) => {
    const firstPageSubjects = await page
      .getByRole("listitem")
      .first()
      .innerText();
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("listitem").first()).not.toHaveText(
      firstPageSubjects,
    );
  });

  test("an impossible search shows the empty state", async ({ page }) => {
    await page.goto("/inbox?q=zzzz-no-such-customer");
    await expect(page.getByText("No tickets match these filters")).toBeVisible();
    await page.getByRole("link", { name: "Reset filters" }).click();
    await expect(page.getByRole("listitem").first()).toBeVisible();
  });
});

test.describe("ticket detail and mutations", () => {
  test.beforeEach(async ({ page }) => signIn(page, "Nadia"));

  test("opens a ticket with its conversation, properties and customer context", async ({ page }) => {
    await page.getByRole("listitem").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/tickets\/tkt_/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Activity log", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: /Ticket properties/ }),
    ).toBeVisible();
    await expect(page.getByText("Their other tickets", { exact: false })).toBeVisible();
  });

  test("changing status updates the badge and writes an activity entry", async ({ page }) => {
    await page.goto("/inbox?status=open");
    await page.getByRole("listitem").first().getByRole("link").first().click();

    const panel = page.getByRole("complementary", { name: /Ticket properties/ });
    await panel.getByRole("button", { name: "pending", exact: true }).click();

    await expect(page.getByText("Status set to pending.")).toBeVisible();
    await page.getByText("Activity log", { exact: false }).click();
    await expect(
      page.getByText(/Status changed from open to pending/),
    ).toBeVisible();
  });

  test("an agent cannot close a ticket; a supervisor can", async ({ page }) => {
    await page.goto("/inbox?status=resolved");
    const url = await page
      .getByRole("listitem")
      .first()
      .getByRole("link")
      .first()
      .getAttribute("href");

    await page.goto(url!);
    const panel = page.getByRole("complementary", { name: /Ticket properties/ });
    // The control is disabled for an agent, and says why.
    await expect(panel.getByRole("button", { name: "closed", exact: true })).toBeDisabled();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signIn(page, "Mia");
    await page.goto(url!);
    await expect(
      page
        .getByRole("complementary", { name: /Ticket properties/ })
        .getByRole("button", { name: "closed", exact: true }),
    ).toBeEnabled();
  });

  test("an agent may take a ticket but not route it to someone else", async ({ page }) => {
    await page.goto("/inbox?assignee=unassigned");
    await page.getByRole("listitem").first().getByRole("link").first().click();

    await expect(
      page.getByText(/Routing it to another agent needs a supervisor/),
    ).toBeVisible();

    const options = await page
      .getByRole("combobox", { name: "Assign this ticket" })
      .locator("option")
      .allInnerTexts();
    // Only "Unassigned" and the agent themselves.
    expect(options).toHaveLength(2);
    expect(options.join(" ")).toContain("Nadia Rivera");
  });

  test("sending a reply appends a message and can transition the status atomically", async ({ page }) => {
    await page.goto("/inbox?status=open");
    await page.getByRole("listitem").first().getByRole("link").first().click();

    const thread = page.getByRole("list", { name: "Conversation" });
    // `count()` does not auto-wait, so the thread has to be on screen before
    // the baseline is taken.
    await expect(thread.getByRole("listitem").first()).toBeVisible();
    const before = await thread.getByRole("listitem").count();
    await page
      .getByRole("textbox", { name: "Reply to the customer" })
      .fill("Thanks for your patience — the fix is live and I have verified it on your account.");
    await page.getByLabel("Then set status to").selectOption("resolved");
    await page.getByRole("button", { name: "Send reply" }).click();

    await expect(page.getByText("Reply sent.")).toBeVisible();
    await expect(page.getByText("the fix is live")).toBeVisible();
    await expect(thread.getByRole("listitem")).toHaveCount(before + 1);
    await expect(
      page.getByRole("complementary", { name: /Ticket properties/ }),
    ).toContainText("Resolved");
  });

  test("a short reply is rejected with an inline, announced error", async ({ page }) => {
    await page.goto("/inbox?status=open");
    await page.getByRole("listitem").first().getByRole("link").first().click();

    const field = page.getByRole("textbox", { name: "Reply to the customer" });
    // Bypass the native minlength so the server-side rule is what is tested.
    await field.evaluate((node) => node.removeAttribute("minlength"));
    await field.fill("too short");
    await page.getByRole("button", { name: "Send reply" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /at least 10 characters/ }),
    ).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
  });

  test("an internal note is labelled as not sent to the customer", async ({ page }) => {
    await page.goto("/inbox?status=open");
    await page.getByRole("listitem").first().getByRole("link").first().click();

    await page.getByRole("radio", { name: "Internal note" }).click();
    await page
      .getByRole("textbox", { name: "Internal note" })
      .fill("Third report of this today — flagging to the platform team.");
    await page.getByRole("button", { name: "Add internal note" }).click();

    await expect(page.getByText("Internal note added.")).toBeVisible();
    await expect(
      page.getByText("Internal note — not sent to the customer").first(),
    ).toBeVisible();
  });

  test("a stale revision is rejected with a conflict rather than overwriting", async ({ page, context }) => {
    await page.goto("/inbox?status=open");
    const url = await page
      .getByRole("listitem")
      .first()
      .getByRole("link")
      .first()
      .getAttribute("href");
    await page.goto(url!);

    // A second tab edits the same ticket, moving its revision forward.
    const other = await context.newPage();
    await other.goto(url!);
    await other
      .getByRole("complementary", { name: /Ticket properties/ })
      .getByRole("button", { name: "pending", exact: true })
      .click();
    await expect(other.getByText("Status set to pending.")).toBeVisible();
    await other.close();

    // The first tab is still holding the revision it loaded.
    await page
      .getByRole("complementary", { name: /Ticket properties/ })
      .getByRole("button", { name: "low", exact: true })
      .click();

    const alert = page.getByRole("alert").filter({ hasText: /Someone else updated/ });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("pending");

    // The optimistic badge rolled back rather than sticking on "low".
    await expect(
      page.getByRole("complementary", { name: /Ticket properties/ }).getByText("Low", { exact: true }),
    ).toHaveCount(0);
  });
});

test.describe("AI assistant", () => {
  test.beforeEach(async ({ page }) => signIn(page, "Nadia"));

  test("summarises the ticket and labels the output as simulated", async ({ page }) => {
    await page.goto("/inbox?status=open");
    await page.getByRole("listitem").first().getByRole("link").first().click();

    await page.getByRole("button", { name: "Summarise" }).click();

    const assistant = page.getByText("Assistant", { exact: true });
    await expect(assistant).toBeVisible();
    await expect(
      page.getByText("Simulated — no API key configured"),
    ).toBeVisible();
    await expect(page.getByText(/Current state:/)).toBeVisible();
  });

  test("drafts a reply and inserts it into the composer", async ({ page }) => {
    await page.goto("/inbox?status=open");
    await page.getByRole("listitem").first().getByRole("link").first().click();

    await page
      .getByRole("textbox", { name: "Optional instruction for the assistant" })
      .fill("confirm the retry schedule");
    await page.getByRole("button", { name: "Draft reply" }).click();

    await expect(page.getByText(/^Hi /)).toBeVisible();
    await page.getByRole("button", { name: "Insert into reply" }).click();

    const field = page.getByRole("textbox", { name: "Reply to the customer" });
    await expect(field).not.toHaveValue("");
    expect(await field.inputValue()).toContain("Hi ");
  });
});

test.describe("knowledge base", () => {
  test.beforeEach(async ({ page }) => signIn(page, "Nadia"));

  test("full-text search stems word forms", async ({ page }) => {
    await page.goto("/kb");
    await expect(page.getByText("5 articles")).toBeVisible();

    await page.getByRole("searchbox").fill("retrying");
    await page.getByRole("searchbox").press("Enter");

    await expect(page.getByText(/\d+ articles? matching/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "How webhook retries work" }),
    ).toBeVisible();
  });

  test("FTS operators in user input do not break the page", async ({ page }) => {
    await page.goto('/kb?q=NEAR("a" "b") OR *');
    await expect(page.getByRole("heading", { name: "Knowledge base" })).toBeVisible();
    await expect(page.getByText(/articles? matching/)).toBeVisible();
  });

  test("an article opens from the list", async ({ page }) => {
    await page.goto("/kb");
    await page.getByRole("link", { name: "API rate limits explained" }).click();
    await expect(page).toHaveURL(/\/kb\/api-rate-limits/);
    await expect(page.getByText(/sliding sixty-second window/)).toBeVisible();
  });
});

test.describe("accessibility and resilience", () => {
  test.beforeEach(async ({ page }) => signIn(page, "Nadia"));

  test("the skip link is the first tab stop", async ({ page }) => {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });

  test("every page has one h1 and a main landmark", async ({ page }) => {
    for (const path of ["/inbox", "/kb", "/kb/export-limits"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main#main")).toBeVisible();
    }
  });

  test("the theme choice survives a reload", async ({ page }) => {
    await page.goto("/inbox");
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("an unknown ticket renders the not-found page", async ({ page }) => {
    await page.goto("/tickets/tkt_does_not_exist");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });

  test("customer-supplied text is escaped, never injected as markup", async ({ page }) => {
    await page.goto("/inbox?status=open");
    await page.getByRole("listitem").first().getByRole("link").first().click();

    const payload = '<img src=x onerror="window.__xss=1"> <script>window.__xss=1</script>';
    await page
      .getByRole("textbox", { name: "Reply to the customer" })
      .fill(`Testing escaping of user content: ${payload}`);
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByText("Reply sent.")).toBeVisible();

    // The payload is rendered as visible text and executed nowhere.
    await expect(page.getByText(payload, { exact: false })).toBeVisible();
    expect(await page.evaluate(() => "__xss" in window)).toBe(false);
  });
});
