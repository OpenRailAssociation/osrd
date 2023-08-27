import {
  RollingStock2Img,
  RollingStockCurve,
} from 'modules/rollingStock/components/RollingStockSelector';
import { listCurvesComfort } from 'modules/rollingStock/components/RollingStockSelector/RollingStockCardDetail';
import { Comfort, ConditionalEffortCurve, RollingStock } from 'common/api/osrdEditoastApi';
import { isEmpty } from 'lodash';
import React, { Dispatch, SetStateAction, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Spreadsheet, { CellBase, Matrix, createEmptyMatrix } from 'react-spreadsheet';
import { emptyStringRegex } from 'utils/strings';
import {
  updateComfortLvl,
  updateElectricalProfile,
  updatePowerRestriction,
  updateTractionMode,
} from 'reducers/rollingstockEditor';
import { useDispatch, useSelector } from 'react-redux';
import {
  getComfortLevel,
  getElectricalProfile,
  getPowerRestriction,
  getTractionMode,
} from 'reducers/rollingstockEditor/selectors';
import SelectorSNCF from 'common/SelectorSNCF';
import {
  SelectedCurves,
  Curve,
  RollingStockSelectorParams,
  THERMAL_TRACTION_IDENTIFIER,
  STANDARD_COMFORT_LEVEL,
} from 'modules/rollingStock/consts';

export default function RollingStockEditorCurves({
  data,
  currentRsEffortCurve,
  setCurrentRsEffortCurve,
}: {
  data?: RollingStock;
  currentRsEffortCurve: RollingStock['effort_curves'];
  setCurrentRsEffortCurve: Dispatch<SetStateAction<RollingStock['effort_curves']>>;
}) {
  const { t } = useTranslation('rollingstock');
  const dispatch = useDispatch();

  const selectedComfortLvl = useSelector(getComfortLevel);
  const selectedTractionMode = useSelector(getTractionMode);
  const selectedElectricalProfile = useSelector(getElectricalProfile);
  const selectedPowerRestriction = useSelector(getPowerRestriction);

  const [hoveredelectricalProfile, setHoveredElectricalProfile] = useState<string | null>();
  const EMPTY_MATRIX = createEmptyMatrix<CellBase<string>>(8, 2);
  const EMPTY_SELECTED_CURVES: SelectedCurves = {
    [selectedTractionMode]: {
      ...currentRsEffortCurve.modes[selectedTractionMode],
      curves: [],
    },
  };
  const EMPTY_PARAMS = {
    comfortlevels: [],
    tractionModes: [],
    electricalProfiles: [],
    powerRestrictions: [],
  };
  const [selectedCurves, setSelectedCurves] = useState(EMPTY_SELECTED_CURVES);

  const dispatchComfortLvl = (value: string) => {
    dispatch(updateComfortLvl(value as Comfort));
  };
  const dispatchTractionMode = (value: string) => {
    dispatch(updateTractionMode(value));
  };
  const dispatchElectricalProfil = (value: string | null) => {
    dispatch(updateElectricalProfile(value));
  };
  const dispatchPowerRestriction = (value: string | null) => {
    dispatch(updatePowerRestriction(value));
  };

  const [rollingstockParams, setRollingstockParams] =
    useState<RollingStockSelectorParams>(EMPTY_PARAMS);

  /* ****  We get a list of all existing comfort levels, modes & profils in 
  the selected rollingstock to fill the selectors lists **** */
  const updateRollingstockParams = useCallback(() => {
    const rsComfortLevels = listCurvesComfort(currentRsEffortCurve);
    const tractionModes = Object.keys(currentRsEffortCurve.modes);
    const powerRestrictions: (string | null)[] = [null];
    const rsElectricalProfiles: (string | null)[] = [null];

    if (
      selectedTractionMode !== THERMAL_TRACTION_IDENTIFIER &&
      currentRsEffortCurve.modes[selectedTractionMode]
    ) {
      currentRsEffortCurve.modes[selectedTractionMode].curves.forEach((curve) => {
        const rsElectricalProfile = curve.cond?.electrical_profile_level as string;
        const rsPowerRestriction = curve.cond?.power_restriction_code as string;
        if (curve.cond?.comfort === selectedComfortLvl) {
          rsElectricalProfiles.push(rsElectricalProfile);
          if (curve.cond?.electrical_profile_level === selectedElectricalProfile) {
            powerRestrictions.push(rsPowerRestriction);
          }
        }
      });
    }
    if (!rsComfortLevels.includes(selectedComfortLvl)) {
      dispatchComfortLvl(rsComfortLevels[0] || STANDARD_COMFORT_LEVEL);
    }
    if (selectedTractionMode === '' || !tractionModes.includes(selectedTractionMode)) {
      dispatchTractionMode(Object.keys(currentRsEffortCurve.modes)[0]);
      dispatchElectricalProfil(null);
      dispatchPowerRestriction(null);
    }
    if (
      rsElectricalProfiles.length > 1 &&
      !rsElectricalProfiles.includes(selectedElectricalProfile)
    ) {
      dispatchElectricalProfil(rsElectricalProfiles[0]);
    }
    if (powerRestrictions.length > 1 && !powerRestrictions.includes(selectedPowerRestriction)) {
      dispatchPowerRestriction(powerRestrictions[0]);
    }

    const rollingstockParamsLists = {
      comfortlevels: rsComfortLevels,
      tractionModes,
      electricalProfiles: [...new Set(rsElectricalProfiles)],
      powerRestrictions: [...new Set(powerRestrictions)],
    };
    setRollingstockParams(rollingstockParamsLists);
    return rollingstockParamsLists;
  }, [selectedTractionMode, currentRsEffortCurve, selectedElectricalProfile]);

  /** Filter all the curves to find a list of curves matching the selected comfort and traction mode */
  const selectMatchingCurves = useCallback((): SelectedCurves => {
    const selectedTractionModeCurves = currentRsEffortCurve.modes[selectedTractionMode];
    if (!selectedTractionModeCurves) {
      return EMPTY_SELECTED_CURVES;
    }
    const curvesList = selectedTractionModeCurves?.curves.filter(
      (curve) => curve.cond?.comfort === selectedComfortLvl
    );

    const rollingstockParamsLists = updateRollingstockParams();

    return {
      [selectedTractionMode]: {
        ...selectedTractionModeCurves,
        curves:
          rollingstockParamsLists.powerRestrictions.length > 1
            ? curvesList.filter(
                (curve) => curve.cond?.electrical_profile_level === selectedElectricalProfile
              )
            : curvesList,
      },
    };
  }, [selectedTractionMode, selectedElectricalProfile, selectedComfortLvl]);

  /**  Select the curve to display in the spreadsheet and format it to match the Spreadsheet component type */
  const selectAndFormatCurveForSpreadsheet = (
    newSelectedCurves: RollingStock['effort_curves']['modes']
  ): Matrix<CellBase<string>> => {
    if (isEmpty(newSelectedCurves[selectedTractionMode].curves)) return EMPTY_MATRIX;

    const isElectric = selectedTractionMode !== THERMAL_TRACTION_IDENTIFIER;
    const curvesList = newSelectedCurves[selectedTractionMode].curves;
    const curveToDisplay = isElectric
      ? curvesList.filter(
          (curve) =>
            curve.cond?.electrical_profile_level === selectedElectricalProfile &&
            curve.cond?.power_restriction_code === selectedPowerRestriction
        )[0]
      : curvesList[0];
    const speedsList = curveToDisplay?.curve?.speeds;
    const effortsList = curveToDisplay?.curve?.max_efforts;

    const filledMatrix: (
      | {
          value: string;
        }
      | undefined
    )[][] =
      speedsList && effortsList
        ? effortsList.map((effort, index) => [
            { value: Math.round(speedsList[index] * 3.6).toString() },
            { value: Math.round(effort / 10).toString() },
          ])
        : [];

    return filledMatrix.length > 8
      ? filledMatrix
      : filledMatrix.concat(createEmptyMatrix<CellBase<string>>(8 - filledMatrix.length, 2));
  };

  const [curveForSpreadsheet, setCurveForSpreadsheet] = useState<Matrix<CellBase<string>>>(() =>
    selectAndFormatCurveForSpreadsheet(selectedCurves)
  );

  const updateSpreadsheet = (e: Matrix<{ value: string }>) => {
    const emptyRow = [undefined, undefined];
    const sheetValues = e.filter(
      (step) => step[0]?.value !== undefined || step[1]?.value !== undefined
    );

    if (!isEmpty(sheetValues) && sheetValues.length >= 8) {
      sheetValues.push(emptyRow);
      setCurveForSpreadsheet(sheetValues);
    } else if (!isEmpty(sheetValues) && sheetValues.length < 8) {
      const fillingRows = createEmptyMatrix<CellBase<string>>(8 - sheetValues.length, 2);
      setCurveForSpreadsheet(sheetValues.concat(fillingRows));
    } else {
      setCurveForSpreadsheet(selectAndFormatCurveForSpreadsheet(selectedCurves));
    }
  };

  /* * We filter the spreadsheet values to avoid undefined or empty cells
   * * then we format them back to match the Curve type * */
  const parseCurve = (e: Matrix<{ value: string }>) => {
    const sheetValues = e
      .filter(
        ([a, b]) =>
          a?.value !== undefined &&
          b?.value !== undefined &&
          !emptyStringRegex.test(a.value) &&
          !emptyStringRegex.test(b.value)
      )
      .map((row) => row.map((rowValue) => rowValue?.value.replaceAll(',', '.')));

    const newCurve: Curve = { max_efforts: [], speeds: [] };
    if (!isEmpty(sheetValues)) {
      sheetValues.forEach((step) => {
        newCurve.speeds.push(Number(step[0]) / 3.6);
        newCurve.max_efforts.push(Number(step[1]) * 10);
      });
    }
    return newCurve;
  };
  const updateCurrentRs = (e: Matrix<{ value: string }>) => {
    const parsedCurve = parseCurve(e);
    const selectedTractionModeCurves = currentRsEffortCurve.modes[selectedTractionMode].curves;
    if (!isEmpty(parsedCurve.max_efforts) && !isEmpty(parsedCurve.speeds)) {
      /* * * 1st find the index of the modified curve in the curves list, * *
       * * then slice the list to replace the selected curve by the new one */
      const index = selectedTractionModeCurves.findIndex(
        (curve) =>
          curve.cond?.comfort === selectedComfortLvl &&
          curve.cond?.electrical_profile_level === selectedElectricalProfile &&
          curve.cond?.power_restriction_code === selectedPowerRestriction
      );

      const updatedSelectedCurve: ConditionalEffortCurve = {
        cond: selectedTractionModeCurves[index].cond,
        curve: parsedCurve,
      };

      const updatedCurvesList = selectedTractionModeCurves
        .slice(0, index)
        .concat(updatedSelectedCurve, selectedTractionModeCurves.slice(index + 1));

      const updatedCurrentRsEffortCurve = {
        default_mode: currentRsEffortCurve.default_mode,
        modes: {
          ...currentRsEffortCurve.modes,
          [selectedTractionMode]: {
            ...currentRsEffortCurve.modes[selectedTractionMode],
            curves: updatedCurvesList,
          },
        },
      };

      setCurrentRsEffortCurve(updatedCurrentRsEffortCurve);

      // TODO: try to do it by only updating "currentRsEffortCurve" state.
      let updatedSelectedCurvesList = updatedCurrentRsEffortCurve.modes[
        selectedTractionMode
      ]?.curves.filter((curve) => curve.cond?.comfort === selectedComfortLvl);

      if (rollingstockParams?.powerRestrictions.length > 1)
        updatedSelectedCurvesList = updatedSelectedCurvesList.filter(
          (curve) => curve.cond?.electrical_profile_level === selectedElectricalProfile
        );

      setSelectedCurves({
        [selectedTractionMode]: {
          ...currentRsEffortCurve.modes[selectedTractionMode],
          curves: updatedSelectedCurvesList,
        },
      });
    } else if (data) {
      setCurrentRsEffortCurve(data.effort_curves);
    }
  };

  useEffect(() => {
    updateRollingstockParams();
  }, [selectedTractionMode, selectedComfortLvl, selectedElectricalProfile]);

  useEffect(() => {
    const newSelectedCurves = selectMatchingCurves();
    setSelectedCurves(newSelectedCurves);
    setCurveForSpreadsheet(selectAndFormatCurveForSpreadsheet(newSelectedCurves));
  }, [
    selectedComfortLvl,
    selectedTractionMode,
    selectedElectricalProfile,
    selectedPowerRestriction,
  ]);

  return (
    <>
      {rollingstockParams && (
        <div className="d-flex flex-wrap px-3 pb-2">
          <SelectorSNCF
            key="comfort-level-selector"
            borderClass="selector-blue"
            title="comfortLevel"
            itemsList={rollingstockParams.comfortlevels}
            onItemSelected={dispatchComfortLvl}
            selectedItem={selectedComfortLvl}
            translationFile="rollingstock"
            translationList="comfortTypes"
          />
          <SelectorSNCF
            key="traction-mode-selector"
            borderClass="selector-pink"
            title="tractionMode"
            itemsList={rollingstockParams.tractionModes}
            onItemSelected={dispatchTractionMode}
            selectedItem={selectedTractionMode}
            translationFile="rollingstock"
          />
          {!currentRsEffortCurve.modes.thermal && (
            <>
              <SelectorSNCF
                key="electrical-profile-selector"
                borderClass="selector-pink"
                title="electricalProfile"
                itemsList={[...rollingstockParams.electricalProfiles]}
                onItemSelected={dispatchElectricalProfil}
                selectedItem={selectedElectricalProfile}
                hoveredItem={hoveredelectricalProfile}
                onItemHovered={setHoveredElectricalProfile}
                translationFile="rollingstock"
              />
              {rollingstockParams.powerRestrictions.length > 1 && (
                <SelectorSNCF
                  key="power-restriction-selector"
                  borderClass="selector-pink"
                  title="powerRestriction"
                  itemsList={rollingstockParams.powerRestrictions}
                  onItemSelected={dispatchPowerRestriction}
                  selectedItem={selectedPowerRestriction}
                  translationFile="rollingstock"
                />
              )}
            </>
          )}
        </div>
      )}
      <div className="d-flex rollingstock-editor-curves p-3">
        <div className="rollingstock-editor-spreadsheet">
          <Spreadsheet
            data={curveForSpreadsheet}
            onChange={(e) => {
              updateSpreadsheet(e);
              updateCurrentRs(e);
            }}
            columnLabels={[t('speed'), t('effort')]}
          />
        </div>
        <div className="rollingstock-body">
          {!isEmpty(selectedCurves[selectedTractionMode]?.curves) && rollingstockParams && (
            <RollingStockCurve
              curvesComfortList={[selectedComfortLvl]}
              data={selectedCurves}
              isOnEditionMode
              showPowerRestriction={rollingstockParams.powerRestrictions.length > 1}
              hoveredElectricalProfile={hoveredelectricalProfile}
            />
          )}
          {data && (
            <div className="rollingstock-detail-container-img">
              <div className="rollingstock-detail-img">
                <RollingStock2Img rollingStock={data} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
