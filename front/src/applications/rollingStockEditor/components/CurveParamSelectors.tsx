import { useEffect, useState, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { Alert } from '@osrd-project/ui-icons';
import { compact, isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { ConditionalEffortCurve, RollingStock, Comfort } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import Selector from 'common/Selector';
import {
  COMFORTS,
  STANDARD_COMFORT_LEVEL,
  THERMAL_TRACTION_IDENTIFIER,
} from 'modules/rollingStock/consts';

import { EP_BY_MODE } from '../consts';
import PowerRestrictionGridModal from './PowerRestrictionGridModal';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';
import { sortSelectedModeCurves } from '../helpers/curves';
import { createEmptyCurve, createEmptyCurves } from '../helpers/defaultValues';
import { translateItemsList } from '../helpers/utils';
import type {
  ConditionalEffortCurveForm,
  EffortCurveForms,
  ElectricalProfileByMode,
  RollingStockSelectorParams,
} from '../types';

const addNewCurveToMode = (
  effortCurves: EffortCurveForms,
  selectedMode: string,
  newCurve: ConditionalEffortCurveForm
) => {
  const selectedModeCurves = effortCurves[selectedMode];
  return {
    ...effortCurves,
    [selectedMode]: {
      ...selectedModeCurves,
      curves: sortSelectedModeCurves([...selectedModeCurves.curves, newCurve]),
    },
  };
};

type RollingStockEditorCurvesProps = {
  selectedParams: {
    comfortLevel: Comfort;
    electricalProfile: string | null;
    powerRestriction: string | null;
    tractionMode: string | null;
  };
  selectedParamsSetter: (
    key: 'comfortLevel' | 'tractionMode' | 'electricalProfile' | 'powerRestriction',
    value: Comfort | string | null
  ) => void;

  effortCurves: EffortCurveForms | null;
  setEffortCurves: Dispatch<SetStateAction<EffortCurveForms | null>>;

  powerRestrictionsClass: RollingStock['power_restrictions'];
  setPowerRestrictionsClass: (data: RollingStock['power_restrictions']) => void;
  basePowerClass: string | null;
  rollingstockParams: RollingStockSelectorParams;

  setHoveredItem: (newHoveredItem: string | null) => void;
};

const CurveParamSelectors = ({
  effortCurves,
  setEffortCurves,
  selectedParams: {
    comfortLevel: selectedComfortLvl,
    electricalProfile: selectedElectricalProfile,
    powerRestriction: selectedPowerRestriction,
    tractionMode: selectedTractionMode,
  },
  selectedParamsSetter,
  powerRestrictionsClass,
  setPowerRestrictionsClass,
  basePowerClass,
  rollingstockParams,
  setHoveredItem,
}: RollingStockEditorCurvesProps) => {
  const { t } = useTranslation();
  const { t: rollingStockT } = useTranslation('translation', { keyPrefix: 'rollingStock' });
  const { openModal } = useModal();

  const { data: availableModes } = osrdEditoastApi.endpoints.getInfraVoltages.useQuery();

  const { data: powerRestrictionCodes } =
    osrdEditoastApi.endpoints.getRollingStockPowerRestrictions.useQuery();

  const [powerRestrictionList, setPowerRestrictionList] = useState<string[]>(
    powerRestrictionCodes || []
  );

  const extraColumnData = useMemo(
    () => ({
      defaultValue: basePowerClass ?? '',
      data: powerRestrictionsClass,
      updateData: setPowerRestrictionsClass,
    }),
    [powerRestrictionsClass]
  );

  const comfortOptions = useMemo(() => {
    const { comfortLevels: alreadySelectedComforts } = rollingstockParams;
    return COMFORTS.filter((comfort) => !alreadySelectedComforts.includes(comfort)).map(
      (comfort) => ({ id: comfort, label: t(`rollingStock.comfortTypes.${comfort}`) })
    );
  }, [rollingstockParams.comfortLevels]);

  const tractionModeOptions = useMemo(() => {
    const { tractionModes: alreadySelectedModes } = rollingstockParams;
    return [...(availableModes || []), THERMAL_TRACTION_IDENTIFIER]
      .filter((mode) => !alreadySelectedModes.includes(mode))
      .map((tractionMode) => ({
        id: tractionMode,
        label: rollingStockT(tractionMode, { defaultValue: tractionMode }),
      }));
  }, [availableModes, rollingstockParams.tractionModes]);

  const updateComfortLevelsList = (value: Comfort) => {
    if (!effortCurves) return;
    // add the new comfort to all the modes
    const updatedCurves = Object.keys(effortCurves).reduce((acc, mode) => {
      const currentMode = effortCurves[mode];
      const newEmptyCurve = createEmptyCurve(value);
      return {
        ...acc,
        [mode]: {
          ...currentMode,
          curves: [...currentMode.curves, newEmptyCurve],
        },
      };
    }, {});

    setEffortCurves(updatedCurves);
    selectedParamsSetter('comfortLevel', value);
  };

  const updateTractionModesList = (newTractionMode: string) => {
    setEffortCurves({
      ...effortCurves,
      [newTractionMode]: createEmptyCurves(newTractionMode, rollingstockParams.comfortLevels),
    });
    selectedParamsSetter('tractionMode', newTractionMode);
  };

  const updateElectricalProfilesList = (value: string) => {
    if (!selectedTractionMode || !effortCurves) return;

    const newEmptyCurve = createEmptyCurve(selectedComfortLvl, value);
    const updatedEffortCurves = addNewCurveToMode(
      effortCurves,
      selectedTractionMode,
      newEmptyCurve
    );

    setEffortCurves(updatedEffortCurves);
    selectedParamsSetter('electricalProfile', value);
  };

  const updatePowerRestrictionsList = (newPowerRestriction: string) => {
    if (!selectedTractionMode || !effortCurves) return;

    const newEmptyCurve = createEmptyCurve(
      selectedComfortLvl,
      selectedElectricalProfile,
      newPowerRestriction
    );
    const updatedEffortCurves = addNewCurveToMode(
      effortCurves,
      selectedTractionMode,
      newEmptyCurve
    );

    if (!powerRestrictionList.includes(newPowerRestriction)) {
      setPowerRestrictionList([...powerRestrictionList, newPowerRestriction]);
    }

    setPowerRestrictionsClass({ ...powerRestrictionsClass, [newPowerRestriction]: '' });
    setEffortCurves(updatedEffortCurves);
    selectedParamsSetter('powerRestriction', newPowerRestriction);
  };

  const removeTractionMode = (mode: string) => {
    if (!effortCurves) return;
    const filteredModesList = Object.fromEntries(
      Object.entries(effortCurves).filter(([key]) => key !== mode)
    );
    setEffortCurves(filteredModesList);
  };

  const removeAnotherRsParam = (
    title: 'comfort' | 'electrical_profile_level' | 'power_restriction_code',
    value: string | Comfort
  ) => {
    if (!effortCurves) return;
    const condKey = title as keyof ConditionalEffortCurve['cond'];

    const updatedModesCurves = Object.keys(effortCurves).reduce((acc, mode) => {
      const cleanedList = effortCurves[mode].curves.filter(
        (curve) => curve.cond[condKey] !== value
      );
      if (isEmpty(cleanedList)) return acc;
      return {
        ...acc,
        [mode]: {
          ...effortCurves[mode],
          curves: sortSelectedModeCurves(cleanedList),
        },
      };
    }, {});

    if (title === 'power_restriction_code') {
      const updatedPowerRestrictionsClass = { ...powerRestrictionsClass };
      delete updatedPowerRestrictionsClass[value];
      setPowerRestrictionsClass(updatedPowerRestrictionsClass);
    }
    setEffortCurves(updatedModesCurves);
  };

  const confirmRsParamRemoval = (
    title: 'comfort' | 'tractionMode' | 'electrical_profile_level' | 'power_restriction_code',
    value: string | null | Comfort
  ) => {
    if (value === null) return;
    openModal(
      <RollingStockEditorFormModal
        mainText={t(`rollingStock.delete.${title}`)}
        request={() =>
          title === 'tractionMode' ? removeTractionMode(value) : removeAnotherRsParam(title, value)
        }
        buttonText={t('common.confirm')}
      />
    );
  };

  const isWarningNb = Object.values(extraColumnData.data).reduce(
    (count, value) => count + (value === '' ? 1 : 0),
    0
  );

  useEffect(() => {
    if (powerRestrictionCodes) setPowerRestrictionList(powerRestrictionCodes);
  }, [powerRestrictionCodes]);

  return (
    <div className="rollingstock-editor-effort-speed-curves">
      <div className="selector-container">
        <Selector
          title={t('rollingStock.comfortLevels')}
          displayedItems={translateItemsList(
            rollingStockT,
            rollingstockParams.comfortLevels,
            'comfortTypes'
          )}
          selectedItem={selectedComfortLvl}
          permanentItems={[STANDARD_COMFORT_LEVEL]}
          onItemSelected={(item: Comfort) => {
            selectedParamsSetter('comfortLevel', item);
          }}
          onItemRemoved={(item: Comfort) => {
            confirmRsParamRemoval('comfort', item);
          }}
          selectNewItemButtonProps={{
            options: comfortOptions,
            selectNewItem: updateComfortLevelsList,
            disabled: !selectedTractionMode,
          }}
          dataTestId="comfort-level-selector"
        />
      </div>
      <div className="selector-container">
        <Selector
          title={t('rollingStock.tractionModes')}
          displayedItems={translateItemsList(rollingStockT, rollingstockParams.tractionModes)}
          selectedItem={selectedTractionMode || undefined}
          onItemSelected={(item: string | null) => {
            selectedParamsSetter('tractionMode', item);
          }}
          onItemRemoved={(item: string | null) => {
            confirmRsParamRemoval('tractionMode', item);
          }}
          selectNewItemButtonProps={{
            options: tractionModeOptions,
            authorizeNewItem: true,
            addNewItemButtonText: t('rollingStock.addNewTractionMode'),
            selectNewItem: updateTractionModesList,
          }}
          dataTestId="traction-mode-selector"
        />
      </div>
      {selectedTractionMode && selectedTractionMode !== THERMAL_TRACTION_IDENTIFIER && (
        <>
          <div className="selector-container">
            <Selector
              title={t('rollingStock.electricalProfiles')}
              displayedItems={translateItemsList(
                rollingStockT,
                rollingstockParams.electricalProfiles
              )}
              selectedItem={selectedElectricalProfile}
              onItemSelected={(item: string | null) => {
                selectedParamsSetter('electricalProfile', item);
              }}
              onItemHovered={setHoveredItem}
              onItemRemoved={(item: string | null) => {
                confirmRsParamRemoval('electrical_profile_level', item);
              }}
              selectNewItemButtonProps={{
                options: compact(EP_BY_MODE[selectedTractionMode as keyof ElectricalProfileByMode]),
                selectNewItem: updateElectricalProfilesList,
              }}
              dataTestId="electrical-profile-selector"
            />
          </div>
          <div className="selector-container">
            <Selector
              title={t('rollingStock.powerRestrictions')}
              displayedItems={translateItemsList(
                rollingStockT,
                rollingstockParams.powerRestrictions
              )}
              selectedItem={selectedPowerRestriction}
              onItemSelected={(item: string | null) => {
                selectedParamsSetter('powerRestriction', item);
              }}
              onItemHovered={setHoveredItem}
              onItemRemoved={(item: string | null) => {
                confirmRsParamRemoval('power_restriction_code', item);
              }}
              extraColumn={extraColumnData}
              selectNewItemButtonProps={{
                options: powerRestrictionList,
                selectNewItem: updatePowerRestrictionsList,
                customOnClick: () =>
                  openModal(
                    <PowerRestrictionGridModal
                      powerRestrictionsList={powerRestrictionList}
                      updatePowerRestrictions={updatePowerRestrictionsList}
                      currentPowerRestrictions={[...rollingstockParams.powerRestrictions]}
                    />,
                    'lg'
                  ),
              }}
              dataTestId="power-restriction-selector"
            />
            {isWarningNb > 0 && (
              <div className="warning-message text-secondary">
                <div className="pl-3 d-flex align-items-center">
                  <div className="mr-2 warning-icon">
                    <Alert />
                  </div>
                  <span>{t('rollingStock.missingPowerClass', { count: isWarningNb })}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CurveParamSelectors;
