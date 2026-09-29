import { test, expect } from "@playwright/test";
import { Pool } from "pg";
test("profile, password, theme and financial dashboard work on desktop and mobile", async ({
  page,
}, info) => {
  const email = `features-ui-${info.project.name}-${Date.now()}@example.com`;
  const navigate = async (name: string) => {
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await page.getByLabel("Seu nome").fill("Conta Financeira");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Senha", { exact: true })
      .fill("initial-strong-password");
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Seu tempo, com intenção." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ativar tema escuro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await navigate("Meu perfil");
    await page.getByLabel("Seu nome", { exact: true }).fill("Nome Atualizado");
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 4;
      canvas.height = 4;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#7963d2";
      ctx.fillRect(0, 0, 4, 4);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await page
      .locator("input[type=file]")
      .setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      });
    await expect(
      page.getByRole("img", { name: "Foto do perfil" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Salvar perfil", exact: true })
      .click();
    await expect(page.getByText("Perfil atualizado.")).toBeVisible();
    await page
      .getByLabel("Senha atual", { exact: true })
      .fill("initial-strong-password");
    await page
      .getByLabel("Nova senha", { exact: true })
      .fill("updated-strong-password");
    await page
      .getByLabel("Confirme a nova senha", { exact: true })
      .fill("updated-strong-password");
    await page
      .getByRole("button", { name: "Alterar senha", exact: true })
      .click();
    await expect(
      page.getByText("Senha alterada. As outras sessões foram encerradas."),
    ).toBeVisible();
    await navigate("Finanças");
    await page
      .getByRole("button", { name: "Gerenciar categorias", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Nome da categoria", { exact: true })
      .fill("Moradia");
    await dialog
      .getByRole("button", { name: "Salvar categoria", exact: true })
      .click();
    await expect(dialog.getByText("Moradia", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
    await page
      .getByRole("button", { name: "Novo lançamento", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Descrição", { exact: true }).fill("Salário");
    await dialog.getByLabel("Valor (R$)", { exact: true }).fill("2500,00");
    await dialog
      .getByRole("combobox", { name: "Tipo", exact: true })
      .selectOption("income");
    await dialog
      .getByRole("button", { name: "Salvar lançamentos", exact: true })
      .click();
    await expect(
      page.locator(".transaction-list").getByText("Salário", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Novo lançamento", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Descrição", { exact: true }).fill("Aluguel");
    await dialog.getByLabel("Valor (R$)", { exact: true }).fill("850,50");
    await dialog
      .getByRole("combobox", { name: "Categoria", exact: true })
      .selectOption({ label: "Moradia" });
    await dialog
      .getByRole("button", { name: "Salvar lançamentos", exact: true })
      .click();
    await expect(page.locator(".financial-stats")).toContainText(/1.649,50/);
    await page
      .getByRole("button", { name: "Editar lançamento: Aluguel", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Valor (R$)", { exact: true }).fill("800");
    await dialog
      .getByRole("button", { name: "Salvar lançamentos", exact: true })
      .click();
    await expect(page.locator(".financial-stats")).toContainText(/1.700,00/);
    const date = await page
      .getByLabel("Data de referência", { exact: true })
      .inputValue();
    await page.route("**/finance/propose", (route) =>
      route.fulfill({
        json: {
          transactions: [
            {
              description: "Ônibus por IA",
              amountCents: 450,
              type: "expense",
              date,
              categoryId: null,
            },
          ],
        },
      }),
    );
    await page
      .getByRole("textbox", {
        name: "Conte como seu dinheiro se movimentou",
        exact: true,
      })
      .fill("Gastei 4,50 de ônibus hoje");
    await page
      .getByRole("button", { name: "Organizar com IA", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Descrição", { exact: true })).toHaveValue(
      "Ônibus por IA",
    );
    await expect(
      page.locator(".transaction-list").getByText("Ônibus por IA"),
    ).toHaveCount(0);
    await dialog
      .getByRole("button", { name: "Salvar lançamentos", exact: true })
      .click();
    await expect(
      page.locator(".transaction-list").getByText("Ônibus por IA"),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Gastos por categoria", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/${info.project.name}-finance-dark.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Ativar tema claro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Senha", { exact: true })
      .fill("updated-strong-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Seu tempo, com intenção." }),
    ).toBeVisible();
    await expect(page.locator(".profile strong")).toHaveText("Nome Atualizado");
    await expect(page.locator(".profile .avatar img")).toHaveCount(1);
  } finally {
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    await db.query("DELETE FROM users WHERE email=$1", [email]);
    await db.end();
  }
});
