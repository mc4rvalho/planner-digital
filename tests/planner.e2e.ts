import { test, expect } from "@playwright/test";
import { Pool } from "pg";
test("register, create and complete an event, switch locale and use year view", async ({
  page,
}, testInfo) => {
  const email = `browser-${testInfo.project.name}-${Date.now()}@example.com`;
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await page.getByLabel("Seu nome").fill("Pessoa Teste");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Senha", { exact: true })
      .fill("planner-test-strong-password");
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Seu tempo, com intenção." }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Novo evento", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Título", { exact: true })
      .fill("Caminhada no parque");
    await page
      .getByRole("button", { name: "Salvar na agenda", exact: true })
      .click();
    await expect(page.getByText("Caminhada no parque").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Marcar como concluído", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Marcar como pendente", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-overview.png`,
      fullPage: true,
    });
    if (testInfo.project.name === "mobile")
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Configurações", exact: true })
      .click();
    await page.getByRole("combobox", { name: "Idioma", exact: true }).selectOption("en-US");
    await page
      .getByRole("combobox", { name: "Formato de horário", exact: true })
      .selectOption("h12");
    await page
      .getByRole("button", { name: "Salvar preferências", exact: true })
      .click();
    await expect(page.getByText("Preferences saved.")).toBeVisible();
    if (testInfo.project.name === "mobile")
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    await page.getByRole("button", { name: "Year", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "January", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-calendar.png`,
      fullPage: true,
    });
  } finally {
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    await db.query("DELETE FROM users WHERE email=$1", [email]);
    await db.end();
  }
});
