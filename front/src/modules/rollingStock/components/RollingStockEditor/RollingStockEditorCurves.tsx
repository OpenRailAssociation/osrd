import { isEmpty } from 'lodash';
import React, { useMemo, useState } from 'react';
import { STANDARD_COMFORT_LEVEL, THERMAL_TRACTION_IDENTIFIER } from 'modules/rollingStock/consts';
import {
  filterUndefinedValueInCurve,
  orderElectricalProfils,
  orderSelectorList,
} from 'modules/rollingStock/helpers/utils';
import { getCurvesComforts } from 'modules/rollingStock/components/RollingStockCard/RollingStockCardDetail';
import { getElectricalProfilesAndPowerRestrictions } from 'modules/rollingStock/helpers/rollingStockEditor';
import { removeDuplicates } from 'utils/array';

import CurveParamSelectors from 'modules/rollingStock/components/RollingStockEditor/CurveParamSelectors';
import CurveSpreadsheet from 'modules/rollingStock/components/RollingStockEditor/CurveSpreadsheet';
import RollingStockCurve from 'modules/rollingStock/components/RollingStockCurve';

import type {
  ConditionalEffortCurveForm,
  EffortCurveForms,
  RollingStockParametersValues,
} from 'modules/rollingStock/types';
import type { Dispatch, PropsWithChildren, SetStateAction } from 'react';
import type {
  EffortCurves,
  RollingStock,
  RollingStockComfortType,
} from 'common/api/osrdEditoastApi';

const EMPTY_PARAMS = {
  comfortLevels: [STANDARD_COMFORT_LEVEL],
  tractionModes: [],
  electricalProfiles: [],
  powerRestrictions: [],
};

const EMPTY_SELECTED_PARAMS = {
  comfortLevel: STANDARD_COMFORT_LEVEL,
  electricalProfile: null,
  powerRestriction: null,
};

type RollingStockEditorCurvesProps = {
  effortCurves: EffortCurveForms | null;
  setEffortCurves: Dispatch<SetStateAction<EffortCurveForms | null>>;
  selectedTractionMode: string | null;
  setSelectedTractionMode: (arg: string | null) => void;
  powerRestrictionsClass: RollingStock['power_restrictions'];
  setPowerRestrictionsClass: (data: RollingStock['power_restrictions']) => void;
  rollingStockBasePowerClass: RollingStockParametersValues['basePowerClass'];
};

const RollingStockEditorCurves = ({
  effortCurves,
  setEffortCurves,
  selectedTractionMode,
  setSelectedTractionMode,
  powerRestrictionsClass,
  setPowerRestrictionsClass,
  rollingStockBasePowerClass,
  children,
}: PropsWithChildren<RollingStockEditorCurvesProps>) => {
  const [selectedParams, setSelectedParams] = useState<{
    comfortLevel: RollingStockComfortType;
    electricalProfile: string | null;
    powerRestriction: string | null;
  }>(EMPTY_SELECTED_PARAMS);

  const updateSelectedParams = (
    key: 'comfortLevel' | 'tractionMode' | 'electricalProfile' | 'powerRestriction',
    value: RollingStockComfortType | string | null
  ) => {
    if (key === 'tractionMode') {
      setSelectedTractionMode(value);
    } else {
      setSelectedParams((prevState) => ({
        ...prevState,
        [key]: value,
      }));
    }
  };

  const { selectedCurveIndex, selectedCurve } = useMemo(() => {
    if (!selectedTractionMode || !effortCurves || !effortCurves[selectedTractionMode])
      return { selectedCurveIndex: null, selectedCurve: null };

    const isElectric = selectedTractionMode !== THERMAL_TRACTION_IDENTIFIER;
    const modeCurves = effortCurves[selectedTractionMode].curves.filter(
      (curve) => curve.cond.comfort === selectedParams.comfortLevel
    );

    if (isElectric) {
      const index = modeCurves.findIndex(
        (curve) =>
          curve.cond.electrical_profile_level === selectedParams.electricalProfile &&
          curve.cond.power_restriction_code === selectedParams.powerRestriction
      );
      return { selectedCurveIndex: index, selectedCurve: modeCurves[index] };
    }

    return { selectedCurveIndex: 0, selectedCurve: modeCurves[0] };
  }, [effortCurves, selectedTractionMode, selectedParams]);

  const [hoveredRollingstockParam, setHoveredRollingstockParam] = useState<string | null>();

  /** Dict of all the params of the rollingStock */
  const rollingStockParams = useMemo(() => {
    if (!effortCurves) return EMPTY_PARAMS;

    const comfortLevels = getCurvesComforts(effortCurves);
    const tractionModes = Object.keys(effortCurves);

    const shouldComputeElectricalProfiles =
      selectedTractionMode &&
      selectedTractionMode !== THERMAL_TRACTION_IDENTIFIER &&
      effortCurves[selectedTractionMode];

    const { electricalProfiles, powerRestrictions } = shouldComputeElectricalProfiles
      ? getElectricalProfilesAndPowerRestrictions(
          effortCurves[selectedTractionMode],
          selectedParams.comfortLevel,
          selectedParams.electricalProfile
        )
      : { electricalProfiles: [null], powerRestrictions: [] as (string | null)[] };

    // update the selected params if needed
    if (!comfortLevels.includes(selectedParams.comfortLevel))
      updateSelectedParams('comfortLevel', comfortLevels[0] || STANDARD_COMFORT_LEVEL);
    if (selectedTractionMode && !tractionModes.includes(selectedTractionMode))
      updateSelectedParams('tractionMode', tractionModes[0] || null);
    if (!electricalProfiles.includes(selectedParams.electricalProfile))
      updateSelectedParams('electricalProfile', electricalProfiles[0] || null);
    if (!powerRestrictions.includes(selectedParams.powerRestriction))
      updateSelectedParams('powerRestriction', powerRestrictions[0] || null);

    return {
      comfortLevels,
      tractionModes,
      electricalProfiles: orderElectricalProfils(
        removeDuplicates(electricalProfiles),
        selectedTractionMode
      ),
      powerRestrictions: orderSelectorList(removeDuplicates(powerRestrictions)),
    };
  }, [
    selectedParams.comfortLevel,
    selectedParams.electricalProfile,
    selectedTractionMode,
    effortCurves,
  ]);

  /** List of curves matching the selected comfort, traction mode and electrical profile */
  const curvesToDisplay = useMemo(() => {
    if (!selectedTractionMode || !effortCurves) return {};
    const selectedModeCurves = effortCurves[selectedTractionMode];
    if (!selectedModeCurves) return {};

    const filterFunc =
      rollingStockParams.powerRestrictions.length > 1
        ? (curve: ConditionalEffortCurveForm) =>
            curve.cond.comfort === selectedParams.comfortLevel &&
            curve.cond.electrical_profile_level === selectedParams.electricalProfile
        : (curve: ConditionalEffortCurveForm) => curve.cond.comfort === selectedParams.comfortLevel;

    const matchingCurves = selectedModeCurves.curves.filter((curve) => filterFunc(curve));

    return {
      [selectedTractionMode]: {
        ...selectedModeCurves,
        curves: matchingCurves.map((condCurve) => ({
          ...condCurve,
          curve: filterUndefinedValueInCurve(condCurve.curve),
        })),
      },
    } as EffortCurves['modes'];
  }, [
    selectedParams.comfortLevel,
    selectedParams.electricalProfile,
    selectedTractionMode,
    effortCurves,
  ]);

  const showPowerRestriction = useMemo(
    () => rollingStockParams.powerRestrictions.length > 1,
    [rollingStockParams.powerRestrictions]
  );

  return (
    <>
      <CurveParamSelectors
        effortCurves={effortCurves}
        setEffortCurves={setEffortCurves}
        rollingstockParams={rollingStockParams}
        powerRestrictionsClass={powerRestrictionsClass}
        setPowerRestrictionsClass={setPowerRestrictionsClass}
        basePowerClass={rollingStockBasePowerClass}
        setHoveredItem={setHoveredRollingstockParam}
        selectedParams={{
          tractionMode: selectedTractionMode,
          ...selectedParams,
        }}
        selectedParamsSetter={updateSelectedParams}
      />
      {selectedTractionMode && selectedCurve && selectedCurveIndex !== null && (
        <div className="rollingstock-editor-curves d-flex p-3">
          <CurveSpreadsheet
            selectedCurve={selectedCurve}
            selectedCurveIndex={selectedCurveIndex}
            effortCurves={effortCurves}
            selectedTractionMode={selectedTractionMode}
            setEffortCurves={setEffortCurves}
            isDefaultCurve={
              selectedParams.comfortLevel === STANDARD_COMFORT_LEVEL &&
              selectedParams.electricalProfile === null &&
              selectedParams.powerRestriction === null
            }
          />
          <div className="rollingstock-card-body">
            {!isEmpty(curvesToDisplay[selectedTractionMode]?.curves) && (
              <RollingStockCurve
                curvesComfortList={[selectedParams.comfortLevel]}
                data={curvesToDisplay}
                isOnEditionMode
                showPowerRestriction={showPowerRestriction}
                hoveredElectricalParam={hoveredRollingstockParam}
                selectedElectricalParam={
                  showPowerRestriction
                    ? selectedParams.powerRestriction
                    : selectedParams.electricalProfile
                }
              />
            )}
            {children}
          </div>
        </div>
      )}
    </>
  );
};

export default RollingStockEditorCurves;
