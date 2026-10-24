import type { Locator } from '@playwright/test';

export async function choose(select: Locator, value: string) {
  await select.click();
  await select.page().getByRole('listbox').locator(`[role="option"][data-value=${JSON.stringify(value)}]`).click();
}
