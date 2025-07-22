import { expect, type Locator, type Page } from '@playwright/test';

import { cleanText } from '../../utils/data-normalizer';
import type { ProjectDetails } from '../../utils/types';
import HomePage from '../home-page';

class ProjectPage extends HomePage {
  private readonly projectNameLabel: Locator;

  private readonly updateProjectButton: Locator;

  private readonly projectDescriptionLabel: Locator;

  private readonly projectObjectivesLabel: Locator;

  private readonly projectFinancialInfoLabel: Locator;

  private readonly projectFinancialAmountLabel: Locator;

  private readonly projectTagsLabel: Locator;

  private readonly addProjectButton: Locator;

  private readonly projectNameInput: Locator;

  private readonly projectDescriptionInput: Locator;

  private readonly projectObjectiveInput: Locator;

  private readonly projectFunderInput: Locator;

  private readonly projectBudgetInput: Locator;

  private readonly updateConfirmButton: Locator;

  private readonly projectDeleteButton: Locator;

  private readonly createProjectButton: Locator;

  private readonly projectConfirmDeleteButton: Locator;

  constructor(page: Page) {
    super(page);
    this.projectNameLabel = page.getByTestId('project-name');
    this.updateProjectButton = page.getByTestId('project-update-button');
    this.projectDescriptionLabel = page.getByTestId('project-description');
    this.projectObjectivesLabel = page.getByTestId('project-objectives');
    this.projectFinancialAmountLabel = page.getByTestId('project-financial-amount');
    this.projectFinancialInfoLabel = page.getByTestId('project-financials-infos');
    this.projectTagsLabel = page.getByTestId('project-tags');
    this.createProjectButton = page.getByTestId('create-project');
    this.addProjectButton = page.getByTestId('add-project');
    this.projectNameInput = page.getByTestId('projectInputName-input');
    this.projectDescriptionInput = page.getByTestId('projectDescription-input');
    this.projectObjectiveInput = page.getByTestId('projectObjectives-input');
    this.projectFunderInput = page.getByTestId('projectInputFunders-input');
    this.projectBudgetInput = page.getByTestId('projectInputBudget-input');
    this.updateConfirmButton = page.getByTestId('update-project');
    this.projectDeleteButton = page.getByTestId('delete-project');
    this.projectConfirmDeleteButton = page.getByTestId('confirm-delete-button');
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

  // Fill the project details in the form inputs.
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

  // Validate if the project's financial budget matches the expected value.
  async validateNumericBudget(expectedBudget: string) {
    const budgetText = await this.projectFinancialAmountLabel.textContent();
    expect(budgetText?.replace(/[^0-9]/g, '')).toEqual(expectedBudget);
  }

  // Validate if the project objectives match the expected objectives.
  async validateObjectives(expectedObjectives: string) {
    const objectives = await this.projectObjectivesLabel.textContent();
    expect(cleanText(objectives)).toContain(cleanText(expectedObjectives));
  }

  // Validate if all project details are displayed correctly.
  async validateProjectData(details: ProjectDetails) {
    const { name, description, objectives, funders, budget, tags } = details;

    expect(await this.projectNameLabel.textContent()).toContain(name);
    expect(await this.projectDescriptionLabel.textContent()).toContain(description);
    await this.validateObjectives(objectives);
    expect(await this.projectFinancialInfoLabel.textContent()).toContain(funders);
    await this.validateNumericBudget(budget);
    expect(await this.projectTagsLabel.textContent()).toContain(tags.join(''));
  }

  // Open a project by its test ID (The Test ID is the same as the Name).
  async openProjectByTestId(projectTestId: string | RegExp) {
    await this.page.getByTestId(projectTestId).first().hover();
    await this.page.getByTestId(projectTestId).getByTestId('openProject').click();
  }

  // Retrieve a project element by its name.
  getProjectByName(name: string) {
    return this.page.locator(`.project-card .project-card-name:has-text("${name}")`);
  }

  // Delete a project by its name.
  async deleteProject(name: string) {
    await this.updateProjectButton.click();
    await expect(this.projectDeleteButton).toBeVisible();
    await this.projectDeleteButton.click();
    await expect(this.projectDeleteButton).not.toBeVisible();
    await expect(this.projectConfirmDeleteButton).toBeVisible();
    await this.projectConfirmDeleteButton.click();
    await expect(this.projectConfirmDeleteButton).not.toBeVisible();
    await expect(this.getProjectByName(name)).not.toBeVisible();
  }
}

export default ProjectPage;
