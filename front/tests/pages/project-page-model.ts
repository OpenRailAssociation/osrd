import { expect, type Locator, type Page } from '@playwright/test';

import CommonPage from './common-page-model';
import { cleanText } from '../utils/dataNormalizer';

class ProjectPage extends CommonPage {
  // Page locators
  readonly projectNameLabel: Locator;

  readonly updateProjectButton: Locator;

  readonly projectDescriptionLabel: Locator;

  readonly projectObjectivesLabel: Locator;

  readonly projectFinancialInfoLabel: Locator;

  readonly projectFinancialAmountLabel: Locator;

  readonly projectTagsLabel: Locator;

  readonly addProjectButton: Locator;

  readonly projectNameInput: Locator;

  readonly projectDescriptionInput: Locator;

  readonly projectObjectiveInput: Locator;

  readonly projectFunderInput: Locator;

  readonly projectBudgetInput: Locator;

  readonly deleteProjectButton: Locator;

  readonly updateConfirmButton: Locator;

  readonly deleteConfirmButton: Locator;

  readonly createProjectButton: Locator;

  readonly firstSelectedProject: Locator;

  constructor(page: Page) {
    super(page);
    this.projectNameLabel = page.locator('.project-details-title-name');
    this.updateProjectButton = page.getByTestId('project-update-button');
    this.projectDescriptionLabel = page.locator('.project-details-title-description');
    this.projectObjectivesLabel = page.locator('.project-details-title-objectives');
    this.projectFinancialAmountLabel = page.locator('.project-details-financials-amount');
    this.projectFinancialInfoLabel = page.locator('.project-details-financials-infos');
    this.projectTagsLabel = page.locator('.project-details-tags');
    this.createProjectButton = page.getByTestId('createProject');
    this.addProjectButton = page.getByTestId('addProject');
    this.projectNameInput = page.locator('#projectInputName');
    this.projectDescriptionInput = page.locator('#projectDescription');
    this.projectObjectiveInput = page.locator('#projectObjectives');
    this.projectFunderInput = page.locator('#projectInputFunders');
    this.projectBudgetInput = page.locator('#projectInputBudget');
    this.deleteProjectButton = page.getByTestId('deleteProjects');
    this.updateConfirmButton = page.locator('#modal-content').getByTestId('updateProject');
    this.deleteConfirmButton = page.locator('#modal-content').getByTestId('deleteProject');
    this.firstSelectedProject = page.locator('.projects-selection-toolbar').locator('span').first();
  }

  // Creates or updates a project based on the provided details.
  async createOrUpdateProject({
    name,
    description,
    objectives,
    funders,
    budget,
    tags,
    isUpdate = false,
  }: {
    name: string;
    description: string;
    objectives: string;
    funders: string;
    budget: string;
    tags: string[];
    isUpdate?: boolean;
  }) {
    if (isUpdate) {
      await this.updateProjectButton.click();
    } else {
      await expect(this.addProjectButton).toBeVisible();
      await this.addProjectButton.click();
    }

    await this.fillProjectDetails({ name, description, objectives, funders, budget, tags });
    await (isUpdate ? this.updateConfirmButton.click() : this.createProjectButton.click());
    await this.page.waitForURL('**/projects/*');
  }

  // Fills the project details in the form inputs.
  private async fillProjectDetails({
    name,
    description,
    objectives,
    funders,
    budget,
    tags,
  }: {
    name: string;
    description: string;
    objectives: string;
    funders: string;
    budget: string;
    tags: string[];
  }) {
    await this.projectNameInput.fill(name);
    await this.projectDescriptionInput.fill(description);
    await this.projectObjectiveInput.fill(objectives);
    await this.projectFunderInput.fill(funders);
    await this.projectBudgetInput.fill(budget);
    for (const tag of tags) await this.setTag(tag);
  }

  // Validates if the project's financial budget matches the expected value.
  async validateNumericBudget(expectedBudget: string) {
    const budgetText = await this.projectFinancialAmountLabel.textContent();
    expect(budgetText?.replace(/[^0-9]/g, '')).toEqual(expectedBudget);
  }

  // Validates if the project objectives match the expected objectives.
  async validateObjectives(expectedObjectives: string) {
    const objectives = await this.projectObjectivesLabel.textContent();
    expect(cleanText(objectives)).toContain(cleanText(expectedObjectives));
  }

  // Validates if all project details are displayed correctly.
  async validateProjectData({
    name,
    description,
    objectives,
    funders,
    budget,
    tags,
  }: {
    name: string;
    description: string;
    objectives: string;
    funders: string;
    budget: string;
    tags: string[];
  }) {
    expect(await this.projectNameLabel.textContent()).toContain(name);
    expect(await this.projectDescriptionLabel.textContent()).toContain(description);
    await this.validateObjectives(objectives);
    expect(await this.projectFinancialInfoLabel.textContent()).toContain(funders);
    await this.validateNumericBudget(budget);
    expect(await this.projectTagsLabel.textContent()).toContain(tags.join(''));
  }

  // Opens a project by its test ID.
  async openProjectByTestId(projectTestId: string | RegExp) {
    await this.page.getByTestId(projectTestId).getByTestId('openProject').first().click();
  }

  // Clicks on a project based on its name.
  async clickProjectByName(name: string) {
    await this.getProjectByName(name).first().click();
    expect(this.firstSelectedProject);
  }

  // Retrieves a project element by its name.
  getProjectByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  // Deletes a project by its name.
  async deleteProject(name: string) {
    await this.deleteProjectButton.click();
    await expect(this.deleteProjectButton).not.toBeEmpty();
    await expect(this.deleteConfirmButton).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.deleteConfirmButton).not.toBeVisible();
    await expect(this.deleteProjectButton).not.toBeVisible();
    await expect(this.getProjectByName(name)).not.toBeVisible();
  }
}

export default ProjectPage;
