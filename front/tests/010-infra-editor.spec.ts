import { expect, test } from '@playwright/test';
import { PlaywrightEditorPage } from './pages/infra-editor-page-model';

test.describe('Testing the Infra Editor app', () => {
  test('Testing there is no error by default in the Editor', async ({ page }) => {
    const playwrightEditorPage = new PlaywrightEditorPage(page);
    await playwrightEditorPage.goToEditorPage();

    await expect(playwrightEditorPage.getErrorBox).not.toBeVisible();
  });
});
