import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page';
import {
  DEFAULT_DETAILS,
  VIA_STOP_TIMES,
  VIA_STOP_TYPES,
} from '../../assets/constants/stdcm-const';
import { EXPLICIT_UI_STABILITY_TIMEOUT } from '../../assets/constants/timeout-const';
import { getTranslations } from '../../utils';
import readJsonFile from '../../utils/file-utils';
import type { StdcmTranslations } from '../../utils/types';

const enTranslations: StdcmTranslations = readJsonFile('public/locales/en/stdcm.json');
const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

class ViaSection extends STDCMPage {
  private readonly viaIcon: Locator;

  private readonly viaDeleteButton: Locator;

  private readonly suggestionNS: Locator;

  private readonly suggestionMES: Locator;

  private readonly suggestionMWS: Locator;

  constructor(page: Page) {
    super(page);

    this.viaIcon = page.locator('.stdcm-via-icons');
    this.viaDeleteButton = page.getByTestId('delete-via-button');
    this.suggestionNS = this.suggestionList.locator('.suggestion-item', {
      hasText: 'NS North_station',
    });

    this.suggestionMES = this.suggestionList.locator('.suggestion-item', {
      hasText: 'MES Mid_East_station',
    });
    this.suggestionMWS = this.suggestionList.locator('.suggestion-item', {
      hasText: 'MWS Mid_West_station',
    });
  }

  // Dynamic selectors for via cards
  private getViaCard(viaNumber: number): Locator {
    return this.page.locator(`.stdcm-card:has(.stdcm-via-icons:has-text("${viaNumber}"))`);
  }

  private getViaCH(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('[data-testid="operational-point-ch"]');
  }

  private getViaCI(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('[data-testid="operational-point-ci"]');
  }

  private getViaType(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('#type');
  }

  private getViaStopTime(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('#stdcm-via-stop-time');
  }

  private getViaWarning(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('.status-message');
  }

  // Add a via card, verify fields, and delete it
  async addAndDeletedDefaultVia() {
    await this.addViaButton.click();
    await this.page.waitForTimeout(EXPLICIT_UI_STABILITY_TIMEOUT); // Wait for the animation to complete
    await expect(this.getViaCI(1)).toHaveValue('');
    await expect(this.getViaCH(1)).toHaveValue('');
    await expect(this.getViaType(1)).toHaveValue(VIA_STOP_TYPES.PASSAGE_TIME);
    await this.viaIcon.hover();
    await expect(this.viaDeleteButton).toBeVisible();
    await this.viaDeleteButton.click();
    await expect(this.getViaCI(1)).not.toBeVisible();
    await expect(this.getViaCH(1)).not.toBeVisible();
    await expect(this.getViaType(1)).not.toBeVisible();
  }

  async fillAndVerifyViaDetails({
    viaNumber,
    ciSearchText,
  }: {
    viaNumber: number;
    ciSearchText: string;
  }): Promise<void> {
    const { PASSAGE_TIME, SERVICE_STOP, DRIVER_SWITCH } = VIA_STOP_TYPES;
    const { serviceStop, driverSwitch } = VIA_STOP_TIMES;
    const translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
    const warning = this.getViaWarning(viaNumber);
    // Helper function to fill common fields
    const fillVia = async (selectedSuggestion: Locator) => {
      await this.addViaButton.nth(viaNumber - 1).click();
      expect(await this.addViaButton.count()).toBe(viaNumber + 1);
      await expect(this.getViaCI(viaNumber)).toBeVisible();
      await this.getViaCI(viaNumber).fill(ciSearchText);
      await selectedSuggestion.click();
      await expect(this.getViaCH(viaNumber)).toHaveValue(DEFAULT_DETAILS.chValue);
      await expect(this.getViaType(viaNumber)).toHaveValue(PASSAGE_TIME);
    };

    switch (ciSearchText) {
      case 'mid_west':
        await fillVia(this.suggestionMWS);
        break;

      case 'mid_east':
        await fillVia(this.suggestionMES);
        await this.getViaType(viaNumber).selectOption(SERVICE_STOP);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(serviceStop.default);
        await this.getViaStopTime(viaNumber).fill(serviceStop.input);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(serviceStop.input);
        break;

      case 'nS':
        await fillVia(this.suggestionNS);
        await this.getViaType(viaNumber).selectOption(DRIVER_SWITCH);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(driverSwitch.default);
        await this.getViaStopTime(viaNumber).fill(driverSwitch.invalidInput);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(driverSwitch.invalidInput);
        await expect(warning).toBeVisible();
        expect(await warning.textContent()).toEqual(translations.trainPath.warningMinStopTime);
        await this.getViaStopTime(viaNumber).fill(driverSwitch.validInput);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(driverSwitch.validInput);
        await expect(warning).not.toBeVisible();
        break;

      default:
        throw new Error(`Unsupported viaSearch value: ${ciSearchText}`);
    }
  }
}

export default ViaSection;
