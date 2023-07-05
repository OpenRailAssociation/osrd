import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import project from './assets/operationStudies/project.json';
import study from './assets/operationStudies/study.json';
import { StudyPage } from './pages/study-page-model';
import { ProjectPage } from './pages/project-page-model';
import PlaywrightCommonPage from './pages/common-page-model';

test.describe('Test is operationnal study: study creation workflow is working properly', () => {
  test('Create a new study', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const studyPage = new StudyPage(page);
    const projectPage = new ProjectPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId(project.name);

    expect(studyPage.getAddStudyBtn).toBeVisible();
    await studyPage.openStudyCreationModal();
    await studyPage.setStudyName(study.name);
    await studyPage.setStudyTypeByText(study.type);
    await studyPage.setStudyStatusByText(`${study.state}`);

    await studyPage.setStudyDescription(study.description);
    const todayDateISO = new Date().toISOString().split('T')[0];
    await studyPage.setStudyStartDate(todayDateISO);
    await studyPage.setStudyEstimatedEndDate(todayDateISO);
    await studyPage.setStudyEndDate(todayDateISO);

    await studyPage.setStudyServiceCode(study.service_code);

    await studyPage.setStudyBusinessCode(study.business_code);

    await studyPage.setStudyBudget(study.budget);

    await commonPage.setTag(project.tags[0]);
    await commonPage.setTag(project.tags[1]);
    await commonPage.setTag(project.tags[2]);

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
    expect(tags).toContain(study.tags.join(''));
  });
});
