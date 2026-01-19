import { expect, type Locator, type Page } from '@playwright/test';

import OperationalStudiesPage from './operational-studies-page';

class ImportPage extends OperationalStudiesPage {
  private readonly importTimetableMenuButton: Locator;
  private readonly importTimetableItemButton: Locator;
  private readonly uploadFileDropzone: Locator;
  private readonly cancelUploadButton: Locator;
  private readonly uploadFileDownloadButton: Locator;

  constructor(page: Page) {
    super(page);
    this.importTimetableMenuButton = page.getByTestId('scenarios-import-timetable-item-button');
    this.importTimetableItemButton = page.getByTestId('scenarios-import-timetable-by-file');
    this.uploadFileDropzone = page.getByTestId('upload-file-modal-dropzone');
    this.cancelUploadButton = page.getByTestId('upload-file-modal-cancel-button');
    this.uploadFileDownloadButton = page.getByTestId('upload-file-modal-download-button');
  }

  async openImportTimetableItemUploadDialog() {
    await this.importTimetableMenuButton.click();
    await expect(this.importTimetableMenuButton).toBeVisible();
    await this.importTimetableItemButton.click();
    await expect(this.uploadFileDropzone).toBeVisible();
    await expect(this.cancelUploadButton).toBeEnabled();
    await expect(this.uploadFileDownloadButton).toBeDisabled();
  }

  async uploadTimetableItemFile(filePath: string, toastMessage: string): Promise<void> {
    await this.uploadFileDropzone.setInputFiles(filePath);
    await expect(this.uploadFileDownloadButton).toBeEnabled();

    await expect(this.uploadFileDownloadButton).toBeVisible();
    await this.uploadFileDownloadButton.click();
    await this.checkToastHasBeenLaunched(toastMessage);
  }
}
export default ImportPage;
