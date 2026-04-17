import { expect, type Locator, type Page } from '@playwright/test';

import { logger } from '../../logging-fixture';
import {
  assertSuggestedFilename,
  saveDownloadToDir,
  triggerFileDownload,
} from '../../utils/file-utils';
import ScenarioTimetableSection from './scenario-timetable-section';

class ImportExportPage extends ScenarioTimetableSection {
  private readonly importTimetableMenuButton: Locator;
  private readonly importTrainScheduleButton: Locator;
  private readonly uploadFileDropzone: Locator;
  private readonly cancelUploadButton: Locator;
  private readonly uploadFileDownloadButton: Locator;

  constructor(page: Page) {
    super(page);
    this.importTimetableMenuButton = page.getByTestId('scenarios-import-train-schedule-button');
    this.importTrainScheduleButton = page.getByTestId('scenarios-import-timetable-by-file');
    this.uploadFileDropzone = page.getByTestId('upload-file-modal-dropzone');
    this.cancelUploadButton = page.getByTestId('upload-file-modal-cancel-button');
    this.uploadFileDownloadButton = page.getByTestId('upload-file-modal-download-button');
  }

  async openImportTrainScheduleUploadDialog() {
    await this.importTimetableMenuButton.click();
    await expect(this.importTimetableMenuButton).toBeVisible();
    await this.importTrainScheduleButton.click();
    await expect(this.uploadFileDropzone).toBeVisible();
    await expect(this.cancelUploadButton).toBeEnabled();
    await expect(this.uploadFileDownloadButton).toBeDisabled();
  }

  async uploadTrainScheduleFile(filePath: string, toastMessage: string): Promise<void> {
    await this.uploadFileDropzone.setInputFiles(filePath);
    await expect(this.uploadFileDownloadButton).toBeEnabled();

    await expect(this.uploadFileDownloadButton).toBeVisible();
    await this.uploadFileDownloadButton.click();
    await this.checkToastHasBeenLaunched(toastMessage);
  }

  async exportTrainSchedules(downloadDir: string): Promise<string> {
    const download = await triggerFileDownload(this.page, this.exportTrainScheduleButton);

    assertSuggestedFilename(download, /^timetable.*\.json$/);

    const downloadPath = await saveDownloadToDir(download, downloadDir);

    logger.info(`The JSON file was successfully downloaded to: ${downloadPath}`);
    return downloadPath;
  }
}
export default ImportExportPage;
