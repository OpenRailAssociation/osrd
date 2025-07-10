import { expect, type Locator, type Page } from '@playwright/test';

import CommonPage from '../common-page';

class OperationalStudiesImportSection extends CommonPage {
  private readonly importTimetableButton: Locator;

  private readonly timetableImportModalBody: Locator;

  constructor(page: Page) {
    super(page);
    this.importTimetableButton = page.getByTestId('import-timetable-button');
    this.timetableImportModalBody = page.locator('#modal-body');
  }

  // Click on the "Import" button to add multiple train schedules and/or paced trains.
  async openTimetableImportModal() {
    await this.importTimetableButton.click();
    await expect(this.timetableImportModalBody).toBeVisible();
  }
}

export default OperationalStudiesImportSection;
