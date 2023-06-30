import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import project from './assets/operationStudies/project.json';
import study from './assets/operationStudies/study.json';
import { StudyPage } from './pages/study-page-model';

test.describe('Test is operationnal study: study creation workflow is working properly', () => {
  let playwrightHomePage: PlaywrightHomePage;
  let studyPage: StudyPage;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    playwrightHomePage = new PlaywrightHomePage(page);
    studyPage = new StudyPage(page);
    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    const projectCardButton = playwrightHomePage.page
      .getByTestId('Test e2e projet')
      .getByRole('button', { name: 'Ouvrir' });
    await projectCardButton.click();
  });

  test('Create a new study', async () => {
    const addStudy = playwrightHomePage.page.getByRole('button', { name: 'Créer une étude' });
    expect(addStudy).not.toEqual(null);
    await addStudy.click();
    const studyNameInput = playwrightHomePage.page.locator('#studyInputName');
    await studyNameInput.fill(study.name);
    const studyTypeInput = playwrightHomePage.page.locator('.input-group').first();
    await studyTypeInput.click();
    await playwrightHomePage.page.locator('#modal-body').getByText(`${study.type}`).click();
    const studyStatusInput = playwrightHomePage.page.locator(
      '.study-edition-modal-state > div > .select-improved > .select-control > .input-group'
    );
    await studyStatusInput.click();
    await playwrightHomePage.page.getByText(`${study.state}`).click();
    const studyDescriptionInput = playwrightHomePage.page.locator('#studyDescription');
    await studyDescriptionInput.fill(study.description);
    const studyStartDateInput = playwrightHomePage.page.getByLabel("Début de l'étude");
    const todayDateISO = new Date().toISOString().split('T')[0];
    await studyStartDateInput.fill(todayDateISO);
    const studyEstimatedEndDateInput = playwrightHomePage.page.getByLabel('Fin estimée');
    await studyEstimatedEndDateInput.fill(todayDateISO);
    const studyEndDateInput = playwrightHomePage.page.getByLabel('Fin réalisée');
    await studyEndDateInput.fill(todayDateISO);
    const studyServiceCodeInput = playwrightHomePage.page.getByLabel('Code service');
    await studyServiceCodeInput.fill(study.service_code);
    const studyBusinessCodeInput = playwrightHomePage.page.getByLabel('Code business');
    await studyBusinessCodeInput.fill(study.business_code);
    const studyBudgetCodeInput = playwrightHomePage.page.getByLabel('Budget');
    await studyBudgetCodeInput.fill(study.budget);
    const tagsInput = playwrightHomePage.page.getByTestId('chips-input');
    await tagsInput.fill(project.tags[0]);
    await tagsInput.press('Enter');
    await tagsInput.fill(project.tags[1]);
    await tagsInput.press('Enter');
    await tagsInput.fill(project.tags[2]);
    await tagsInput.press('Enter');
    const createButton = playwrightHomePage.page.getByText("Créer l'étude");
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/study');
    expect(await studyPage.getStudyName.textContent()).toContain(study.name);
    expect(await studyPage.getStudyDescription.textContent()).toContain(study.description);
    expect(await studyPage.getStudyType.textContent()).toContain(study.type);
    expect(await studyPage.getStudyState.last().textContent()).toContain(study.state);

    expect(await studyPage.getStudyFinancialsInfos.first().textContent()).toContain(
      study.service_code
    );
    expect(await studyPage.getStudyFinancialsInfos.last().textContent()).toContain(
      study.business_code
    );
    const budget = await studyPage.getStudyFinancialsAmount.textContent();
    expect(budget).not.toEqual(null);
    if (budget !== null) expect(budget.replace(/[^0-9]/g, '')).toContain(study.budget);
    const tags = await studyPage.getStudyTags.textContent();
    expect(tags).toContain(study.tags[0]);
    expect(tags).toContain(study.tags[1]);
    expect(tags).toContain(study.tags[2]);
  });
});
