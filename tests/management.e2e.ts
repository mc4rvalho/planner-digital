import { test,expect } from '@playwright/test';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcrypt';

test('explicit routine, partial bills and investment capital work on desktop and mobile',async({page},info)=>{
  const email=`management-ui-${info.project.name}-${Date.now()}@example.com`;
  const routine='Rodar das 05h30 até às 12h.\nAlmoçar e Descansar das 12h até às 15h.\nArrumar a casa às 16h até às 17h.\nRodar das 17h até às 20h.\nEstudar das 20h até às 22h.';
  try {
    // Signup is covered by planner.e2e.ts. Seed this independent finance fixture
    // so six browser scenarios do not exhaust the five-signups/minute protection.
    const setupPool = new Pool({connectionString:process.env.DATABASE_URL});
    try {
      await setupPool.query('INSERT INTO users(id,name,email,password) VALUES($1,$2,$3,$4)', [randomUUID(), 'Gestão Financeira', email, await hash('management-strong-password', 10)]);
    } finally { await setupPool.end(); }
    await page.goto('/');
    await page.getByLabel('E-mail',{exact:true}).fill(email);
    await page.getByLabel('Senha',{exact:true}).fill('management-strong-password');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Seu tempo, com intenção.'})).toBeVisible();
    await page.locator('textarea').fill(routine);
    // This explicit timetable is parsed by the real backend, with no provider mock or API key needed.
    await page.locator('.ai-bottom .primary').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').locator('.draft')).toHaveCount(5);
    await expect(page.getByRole('dialog').getByText(/não foi necessário usar IA/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
    if(info.project.name==='mobile')await page.getByRole('button',{name:'Menu',exact:true}).click();
    await page.getByRole('button',{name:'Finanças',exact:true}).click();
    await page.getByRole('button',{name:'Contas e dívidas',exact:true}).click();
    await page.getByRole('button',{name:'Nova conta',exact:true}).click();
    await page.getByLabel('Nome da conta',{exact:true}).fill('Energia');
    await page.getByLabel('Valor previsto (R$)',{exact:true}).fill('400');
    await page.getByRole('button',{name:'Salvar conta',exact:true}).click();
    const energy=page.locator('.obligation-card').filter({has:page.getByRole('heading',{name:'Energia',exact:true})});
    await expect(energy).toBeVisible();
    await energy.getByRole('button',{name:'Registrar pagamento'}).click();
    await page.getByRole('dialog').getByLabel('Valor (R$)',{exact:true}).fill('300');
    await page.getByRole('button',{name:'Salvar lançamentos',exact:true}).click();
    await expect(energy.locator('.bill-values')).toContainText(/300,00/);
    await expect(energy.locator('.bill-values')).toContainText(/100,00/);
    await expect(energy.locator('.payment-status')).toContainText('Parcial');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await energy.getByRole('button',{name:'Histórico',exact:true}).click();
    await energy.getByRole('button',{name:'Editar lançamento: Energia',exact:true}).click();
    await page.getByRole('dialog').getByLabel('Valor (R$)',{exact:true}).fill('200');
    await page.getByRole('button',{name:'Salvar lançamentos',exact:true}).click();
    await expect(energy.locator('.bill-values').getByText(/200,00/)).toHaveCount(2);
    await page.getByRole('button',{name:'Ativar tema escuro'}).click();
    await page.screenshot({path:`test-results/${info.project.name}-bills-dark.png`,fullPage:true});
    await page.getByRole('button',{name:'Investimentos',exact:true}).click();
    await page.getByRole('button',{name:'Novo investimento',exact:true}).click();
    await page.getByLabel('Nome do investimento',{exact:true}).fill('Reserva');
    await page.getByLabel('Meta de aportes (R$, opcional)',{exact:true}).fill('1000');
    await page.getByRole('button',{name:'Salvar investimento',exact:true}).click();
    const reserve=page.locator('.obligation-card').filter({has:page.getByRole('heading',{name:'Reserva',exact:true})});
    await reserve.getByRole('button',{name:'Aporte',exact:true}).click();
    await page.getByRole('dialog').getByLabel('Valor (R$)',{exact:true}).fill('500');
    await page.getByRole('button',{name:'Salvar lançamentos',exact:true}).click();
    await expect(reserve.locator('.investment-balance')).toContainText('500,00');
    await reserve.getByRole('button',{name:'Resgate',exact:true}).click();
    await page.getByRole('dialog').getByLabel('Valor (R$)',{exact:true}).fill('200');
    await page.getByRole('button',{name:'Salvar lançamentos',exact:true}).click();
    await expect(reserve.locator('.investment-balance')).toContainText('300,00');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`test-results/${info.project.name}-investments-dark.png`,fullPage:true});
  }finally{
    const pool=new Pool({connectionString:process.env.DATABASE_URL});
    await pool.query('DELETE FROM users WHERE email=$1',[email]);await pool.end();
  }
});
