import { expect, type Locator, type Page } from '@playwright/test';

import CommonPage from './common-page-model';
import { cleanText } from '../utils/dataNormalizer';

// Define the type for project details
type ProjectDetails = {
  name: string;
  description: string;
  objectives: string;
  funders: string;
  budget: string;
  tags: string[];
};

class ProjectPage extends CommonPage {
  // Page Locators
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

  readonly updateConfirmButton: Locator;

  readonly deleteConfirmButton: Locator;

  readonly createProjectButton: Locator;

  constructor(page: Page) {
    super(page);
    this.projectNameLabel = page.locator('.project-details-title-name');
    this.updateProjectButton = page.getByTestId('project-update-button');
    this.projectDescriptionLabel = page.locator('.project-details-title-description');
    this.projectObjectivesLabel = page.locator('.project-details-title-objectives');
    this.projectFinancialAmountLabel = page.locator('.project-details-financials-amount');
    this.projectFinancialInfoLabel = page.locator('.project-details-financials-infos');
    this.projectTagsLabel = page.locator('.project-details-tags');
    this.createProjectButton = page.getByTestId('create-project');
    this.addProjectButton = page.getByTestId('add-project');
    this.projectNameInput = page.locator('#projectInputName');
    this.projectDescriptionInput = page.locator('#projectDescription');
    this.projectObjectiveInput = page.locator('#projectObjectives');
    this.projectFunderInput = page.locator('#projectInputFunders');
    this.projectBudgetInput = page.locator('#projectInputBudget');
    this.updateConfirmButton = page.locator('#modal-content').getByTestId('update-project');
    this.deleteConfirmButton = page.locator('#modal-content').getByTestId('delete-project');
  }

  // Create a project based on the provided details.
  async createProject(details: ProjectDetails) {
    await expect(this.addProjectButton).toBeVisible();
    await this.addProjectButton.click();
    await this.fillProjectDetails(details);
    await this.createProjectButton.click();
    await this.page.waitForURL('**/projects/*');
  }

  // Update a project based on the provided details.
  async updateProject(details: ProjectDetails) {
    await this.updateProjectButton.click();
    await this.fillProjectDetails(details);
    await this.updateConfirmButton.click();
    await this.page.waitForURL('**/projects/*');
  }

  // Fills the project details in the form inputs.
  private async fillProjectDetails(details: ProjectDetails) {
    const { name, description, objectives, funders, budget, tags } = details;

    await this.projectNameInput.fill(name);
    await this.projectDescriptionInput.fill(description);
    await this.projectObjectiveInput.fill(objectives);
    await this.projectFunderInput.fill(funders);
    await this.projectBudgetInput.fill(budget);

    for (const tag of tags) {
      await this.setTag(tag);
    }
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
  async validateProjectData(details: ProjectDetails) {
    const { name, description, objectives, funders, budget, tags } = details;

    expect(await this.projectNameLabel.textContent()).toContain(name);
    expect(await this.projectDescriptionLabel.textContent()).toContain(description);
    await this.validateObjectives(objectives);
    expect(await this.projectFinancialInfoLabel.textContent()).toContain(funders);
    await this.validateNumericBudget(budget);
    expect(await this.projectTagsLabel.textContent()).toContain(tags.join(''));
  }

  // Opens a project by its test ID (The Test ID is the same as the Name)
  async openProjectByTestId(projectTestId: string | RegExp) {
    await this.page.getByTestId(projectTestId).first().hover();
    await this.page.getByTestId(projectTestId).getByTestId('openProject').click();
  }

  // Retrieves a project element by its name.
  getProjectByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  // Deletes a project by its name.
  async deleteProject(name: string) {
    await this.updateProjectButton.click();
    await expect(this.deleteConfirmButton).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.deleteConfirmButton).not.toBeVisible();
    await expect(this.getProjectByName(name)).not.toBeVisible();
  }
}

export default ProjectPage;
