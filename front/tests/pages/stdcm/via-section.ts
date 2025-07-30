import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page';
import {
  DEFAULT_DETAILS,
  VIA_STOP_TIMES,
  VIA_STOP_TYPES,
} from '../../assets/constants/stdcm-const';
import readJsonFile from '../../utils/file-utils';
import type { StdcmTranslations } from '../../utils/types';

const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

class ViaSection extends STDCMPage {
  private readonly viaIcon: Locator;

  private readonly viaDeleteButton: Locator;

  private readonly suggestionNS: Locator;

  private readonly suggestionMES: Locator;

  private readonly suggestionMWS: Locator;

  private readonly viaCard: Locator;

  constructor(page: Page) {
    super(page);

    this.viaIcon = page.getByTestId('stdcm-via-icons');
    this.viaDeleteButton = page.getByTestId('delete-via-button');

    this.suggestionNS = this.suggestionItems.filter({
      hasText: 'NS North_station',
    });

    this.suggestionMES = this.suggestionItems.filter({
      hasText: 'MES Mid_East_station',
    });
    this.suggestionMWS = this.suggestionItems.filter({
      hasText: 'MWS Mid_West_station',
    });
    this.viaCard = this.page.getByTestId('stdcm-via-card');
  }

  // Dynamic selectors for via cards
  private getViaCard(viaNumber: number): Locator {
    return this.page.getByTestId('stdcm-via-card').nth(viaNumber - 1);
  }

  private getViaCH(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('operational-point-ch');
  }

  private getViaCI(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('operational-point-ci');
  }

  private getViaType(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('#type');
  }

  private getViaStopTime(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('stdcm-via-stop-time-input');
  }

  private getViaWarning(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('status-message-warning');
  }

  async addAndDeletedDefaultVia() {
    await this.addViaButton.click();
    await expect(this.viaCard).toBeVisible();
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
    const warning = this.getViaWarning(viaNumber);
    // Helper function to fill common fields
    const fillVia = async (selectedSuggestion: Locator) => {
      await this.addViaButton.nth(viaNumber - 1).click();
      expect(await this.addViaButton.count()).toBe(viaNumber + 1);
      await expect(this.getViaCI(viaNumber)).toBeVisible();
      await this.getViaCI(viaNumber).fill(ciSearchText);
      await expect(selectedSuggestion).toBeVisible();
      await selectedSuggestion.click();
      await this.getViaCH(viaNumber).click({ trial: true });
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
        expect(await warning.textContent()).toEqual(
          frTranslations.stdcmErrors.routeErrors.viaStopDurationTooShort
        );
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
