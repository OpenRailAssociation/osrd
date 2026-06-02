import { expect, type Locator, type Page } from '@playwright/test';

import { PROJECT_URLS } from '../../assets/operation-studies/project-const';
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

  private getProjectByName(name: string): Locator {
    return this.page.getByTestId(name);
  }

  private openProjectButton(name: string): Locator {
    return this.getProjectByName(name).getByTestId('openProject');
  }

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

  private async validateObjectives(expectedObjectives: string) {
    const objectives = await this.projectObjectivesLabel.textContent();
    expect(cleanText(objectives)).toContain(cleanText(expectedObjectives));
  }

  async createProject(details: ProjectDetails) {
    await this.waitForSpinnerToDisappear();
    await expect(this.addProjectButton).toBeVisible();
    await this.addProjectButton.click();
    await this.fillProjectDetails(details);
    await this.createProjectButton.click();
    await this.page.waitForURL(PROJECT_URLS.detail);
  }

  async updateProject(details: ProjectDetails) {
    await this.waitForSpinnerToDisappear();
    await expect(this.updateProjectButton).toBeVisible();
    await this.updateProjectButton.click();
    await this.fillProjectDetails(details);
    await this.updateConfirmButton.click();
    await this.page.waitForURL(PROJECT_URLS.detail);
  }

  async validateProjectData(details: ProjectDetails) {
    const { name, description, objectives, funders, budget, tags } = details;

    await expect(this.projectNameLabel).toContainText(name);
    await expect(this.projectDescriptionLabel).toContainText(description);
    await expect(this.projectFinancialInfoLabel).toContainText(funders);
    await expect(this.projectTagsLabel).toContainText(tags.join(''));
    await this.validateObjectives(objectives);
    await this.validateNumericBudget(this.projectFinancialAmountLabel, budget);
  }

  async openProjectByName(projectName: string) {
    const project = this.getProjectByName(projectName);
    await expect(project).toBeVisible();
    await project.scrollIntoViewIfNeeded();
    await project.hover();
    await this.openProjectButton(projectName).click();
  }

  async deleteProject(name: string) {
    await this.waitForSpinnerToDisappear();
    await expect(this.updateProjectButton).toBeVisible();
    await this.updateProjectButton.click();
    await expect(this.projectDeleteButton).toBeVisible();
    await this.projectDeleteButton.click();
    await expect(this.projectConfirmDeleteButton).toBeVisible();
    await this.projectConfirmDeleteButton.click();
    await expect(this.projectConfirmDeleteButton).not.toBeVisible();
    await expect(this.getProjectByName(name)).not.toBeVisible();
  }
}

export default ProjectPage;
