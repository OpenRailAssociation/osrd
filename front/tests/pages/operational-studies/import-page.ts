import { expect, type Locator, type Page } from '@playwright/test';

import OperationalStudiesPage from './operational-studies-page';

class ImportPage extends OperationalStudiesPage {
  private readonly importTimetableItemButton: Locator;
  private readonly importTimetableItemForm: Locator;
  private readonly importTimetableItemUploadButton: Locator;
  private readonly uploadFileDropzone: Locator;
  private readonly cancelUploadButton: Locator;
  private readonly uploadFileDownloadButton: Locator;
  private readonly importTimetableItemResults: Locator;
  private readonly launchImportButton: Locator;

  constructor(page: Page) {
    super(page);
    this.importTimetableItemButton = page.getByTestId('scenarios-import-timetable-item-button');
    this.importTimetableItemForm = page.getByTestId('import-timetable-item');
    this.importTimetableItemUploadButton = page.getByTestId('import-timetable-item-upload-button');
    this.uploadFileDropzone = page.getByTestId('upload-file-modal-dropzone');
    this.cancelUploadButton = page.getByTestId('upload-file-modal-cancel-button');
    this.uploadFileDownloadButton = page.getByTestId('upload-file-modal-download-button');
    this.importTimetableItemResults = page.getByTestId('import-timetable-item-results');
    this.launchImportButton = page.getByTestId('launch-import-button');
  }

  async openImportTimetableItemForm() {
    await this.importTimetableItemButton.click();
    await expect(this.importTimetableItemForm).toBeVisible();
  }

  async openUploadDialog() {
    await this.importTimetableItemUploadButton.click();
    await expect(this.uploadFileDropzone).toBeVisible();
    await expect(this.cancelUploadButton).toBeEnabled();
    await expect(this.uploadFileDownloadButton).toBeDisabled();
  }

  async uploadTimetableItemFile(
    filePath: string,
    itemCounts: {
      totalPacedTrainCount: number;
      totalTrainScheduleCount: number;
    }
  ): Promise<void> {
    const { totalPacedTrainCount, totalTrainScheduleCount } = itemCounts;

    await this.uploadFileDropzone.setInputFiles(filePath);
    await expect(this.uploadFileDownloadButton).toBeEnabled();

    await expect(this.uploadFileDownloadButton).toBeVisible();
    await this.uploadFileDownloadButton.click();
    await expect
      .poll(async () => {
        const resultsText = await this.importTimetableItemResults.innerText();
        // Extract the numeric counts from the text
        const [displayedPacedTrainCount, displayedTrainScheduleCount] =
          resultsText.match(/\d+/g)?.map(Number) ?? [];
        return { displayedPacedTrainCount, displayedTrainScheduleCount };
      })
      .toEqual({
        displayedPacedTrainCount: totalPacedTrainCount,
        displayedTrainScheduleCount: totalTrainScheduleCount,
      });
  }
  async launchTimetableItemImport(toastMessage: string) {
    await this.launchImportButton.click();
    await this.checkToastHasBeenLaunched(toastMessage);
  }
}
export default ImportPage;
