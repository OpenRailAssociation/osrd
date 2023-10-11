import {
  RollingStock2Img,
  RollingStockCurve,
} from 'modules/rollingStock/components/RollingStockSelector';
import { listCurvesComfort } from 'modules/rollingStock/components/RollingStockSelector/RollingStockCardDetail';
import {
  Comfort,
  ConditionalEffortCurve,
  RollingStock,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { isEmpty, isNull } from 'lodash';
import React, { Dispatch, SetStateAction, useEffect, useState, useCallback, useMemo } from 'react';
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
} from 'reducers/rollingstockEditor/selectors';
import SelectorSNCF from 'common/SelectorSNCF';
import {
  SelectedCurves,
  Curve,
  RollingStockSelectorParams,
  THERMAL_TRACTION_IDENTIFIER,
  STANDARD_COMFORT_LEVEL,
  comfortOptions,
  electricalProfilesByMode,
  ElectricalProfileByMode,
  effortCurveCondKeys,
  EffortCurveCondKeys,
  RollingStockSelectorParam,
} from 'modules/rollingStock/consts';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { createEmptyCurve, orderSelectorList } from 'modules/rollingStock/helpers/utils';
import AddRollingstockParam from './AddRollingstockParam';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';

const EMPTY_MATRIX = createEmptyMatrix<CellBase<string>>(8, 2);
const EMPTY_PARAMS = {
  comfortLevels: [STANDARD_COMFORT_LEVEL],
  tractionModes: [],
  electricalProfiles: [],
  powerRestrictions: [],
};

type RollingStockEditorCurvesProps = {
  data?: RollingStock;
  currentRsEffortCurve: RollingStock['effort_curves'] | null;
  setCurrentRsEffortCurve: Dispatch<SetStateAction<RollingStock['effort_curves'] | null>>;
  selectedTractionMode: string | null;
  powerRestrictionsClass: RollingStock['power_restrictions'];
  setPowerRestrictionsClass: (data: RollingStock['power_restrictions']) => void;
};

export default function RollingStockEditorCurves({
  data,
  currentRsEffortCurve,
  setCurrentRsEffortCurve,
  selectedTractionMode,
  powerRestrictionsClass,
  setPowerRestrictionsClass,
}: RollingStockEditorCurvesProps) {
  const { t } = useTranslation('rollingstock');
  const dispatch = useDispatch();
  const { openModal } = useModal();

  const selectedComfortLvl = useSelector(getComfortLevel);
  const selectedElectricalProfile = useSelector(getElectricalProfile);
  const selectedPowerRestriction = useSelector(getPowerRestriction);

  const EmptySelectedCurves: SelectedCurves = useMemo(
    () =>
      selectedTractionMode && currentRsEffortCurve
        ? {
            [selectedTractionMode]: {
              ...currentRsEffortCurve.modes[selectedTractionMode],
              curves: [],
            },
          }
        : {},
    [selectedTractionMode]
  );

  const [rollingstockParams, setRollingstockParams] =
    useState<RollingStockSelectorParams>(EMPTY_PARAMS);

  /** given a tractionMode and a list of comfort, return empty EffortCurves */
  const createEmptyCurves = (tractionMode: string, comforts: Comfort[]) => ({
    curves: comforts.map((comfort) => createEmptyCurve(comfort)),
    default_curve: { speeds: [0], max_efforts: [0] },
    is_electric: tractionMode !== THERMAL_TRACTION_IDENTIFIER,
  });
  const [hoveredRollingstockParam, setHoveredRollingstockParam] = useState<string | null>();
  const [hoveredRollingstockTractionParam, setHoveredRollingstockTractionParam] = useState<
    string | null
  >();
  const [selectedCurves, setSelectedCurves] = useState(EmptySelectedCurves);

  const dispatchComfortLvl = (value: string) => {
    dispatch(updateComfortLvl(value as Comfort));
  };
  const dispatchTractionMode = (value: string | null) => {
    dispatch(updateTractionMode(value));
  };
  const dispatchElectricalProfil = (value: string | null) => {
    dispatch(updateElectricalProfile(value));
  };
  const dispatchPowerRestriction = (value: string | null) => {
    dispatch(updatePowerRestriction(value));
  };

  /**
   * We get a list of all existing comfort levels, modes & profiles in
   * the selected rollingstock to fill the selectors lists
   */
  const updateRollingstockParams = useCallback(() => {
    if (!currentRsEffortCurve) return EMPTY_PARAMS;

    const rsComfortLevels = listCurvesComfort(currentRsEffortCurve);
    const tractionModes = Object.keys(currentRsEffortCurve.modes);
    const powerRestrictions: (string | null)[] = [];
    const rsElectricalProfiles =
      selectedTractionMode &&
      selectedTractionMode !== THERMAL_TRACTION_IDENTIFIER &&
      currentRsEffortCurve.modes[selectedTractionMode]
        ? currentRsEffortCurve.modes[selectedTractionMode].curves.reduce((acc, curve) => {
            const rsElectricalProfile = curve.cond?.electrical_profile_level as string;
            const rsPowerRestriction = curve.cond?.power_restriction_code as string;
            if (curve.cond?.comfort === selectedComfortLvl) {
              if (!isNull(rsElectricalProfile)) {
                acc.push(rsElectricalProfile);
              } else {
                acc.unshift(rsElectricalProfile);
              }
              if (curve.cond?.electrical_profile_level === selectedElectricalProfile) {
                if (!isNull(rsPowerRestriction)) {
                  powerRestrictions.push(rsPowerRestriction);
                } else {
                  powerRestrictions.unshift(rsPowerRestriction);
                }
              }
            }
            return acc;
          }, [] as (string | null)[])
        : [null];

    if (!rsComfortLevels.includes(selectedComfortLvl)) {
      dispatchComfortLvl(rsComfortLevels[0] || STANDARD_COMFORT_LEVEL);
    }
    if (selectedTractionMode && !tractionModes.includes(selectedTractionMode)) {
      dispatchTractionMode(Object.keys(currentRsEffortCurve.modes)[0] || null);
    }
    if (!rsElectricalProfiles.includes(selectedElectricalProfile)) {
      dispatchElectricalProfil(rsElectricalProfiles[0]);
    }
    if (!powerRestrictions.includes(selectedPowerRestriction)) {
      dispatchPowerRestriction(powerRestrictions[0] || null);
    }
    const rollingstockParamsLists = {
      comfortLevels: [...new Set(rsComfortLevels)],
      tractionModes: [...new Set(tractionModes)],
      electricalProfiles: orderSelectorList([...new Set(rsElectricalProfiles)]),
      powerRestrictions: orderSelectorList([...new Set(powerRestrictions)]),
    };

    setRollingstockParams(rollingstockParamsLists);
    return rollingstockParamsLists;
  }, [selectedComfortLvl, currentRsEffortCurve, selectedTractionMode, selectedElectricalProfile]);

  /** Filter all the curves to find a list of curves matching the selected comfort and traction mode */
  const selectMatchingCurves = useCallback((): SelectedCurves => {
    if (!selectedTractionMode || !currentRsEffortCurve) return {};
    const selectedTractionModeCurves = currentRsEffortCurve.modes[selectedTractionMode];
    if (!selectedTractionModeCurves) {
      return EmptySelectedCurves;
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
  }, [selectedTractionMode, selectedElectricalProfile, selectedComfortLvl, rollingstockParams]);

  /** Select the curve to display in the spreadsheet and format it to match the Spreadsheet component type */
  const selectAndFormatCurveForSpreadsheet = (
    newSelectedCurves: RollingStock['effort_curves']['modes']
  ): Matrix<CellBase<string>> => {
    if (!selectedTractionMode || isEmpty(newSelectedCurves[selectedTractionMode].curves)) {
      return EMPTY_MATRIX;
    }

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

    const numberOfRows = filledMatrix.length < 8 ? 8 - filledMatrix.length : 1;
    return filledMatrix.concat(createEmptyMatrix<CellBase<string>>(numberOfRows, 2));
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

  /**
   * We filter the spreadsheet values to avoid undefined or empty cells
   * then we format them back to match the Curve type
   */
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
    if (!selectedTractionMode || !currentRsEffortCurve) return;
    const parsedCurve = parseCurve(e);
    const selectedTractionModeCurves = currentRsEffortCurve.modes[selectedTractionMode].curves;
    if (!isEmpty(parsedCurve.max_efforts) && !isEmpty(parsedCurve.speeds)) {
      /* 1st find the index of the modified curve in the curves list,
       * then slice the list to replace the selected curve by the new one */
      const index = selectedTractionModeCurves.findIndex(
        (curve) =>
          curve.cond?.comfort === selectedComfortLvl &&
          curve.cond?.electrical_profile_level === selectedElectricalProfile &&
          curve.cond?.power_restriction_code === selectedPowerRestriction
      );

      const updatedSelectedCurve =
        index < 0
          ? {
              cond: {
                comfort: selectedComfortLvl,
                electrical_profile_level: selectedElectricalProfile,
                power_restriction_code: selectedPowerRestriction,
              },
              curve: parsedCurve,
            }
          : {
              cond: selectedTractionModeCurves[index].cond,
              curve: parsedCurve,
            };

      const updatedCurvesList = [
        updatedSelectedCurve,
        ...selectedTractionModeCurves.slice(index + 1),
      ];

      if (index > 0) updatedCurvesList.unshift(...selectedTractionModeCurves.slice(0, index));
      const defaultCurve =
        index === 0
          ? updatedSelectedCurve.curve
          : currentRsEffortCurve.modes[selectedTractionMode].default_curve;

      const updatedCurrentRsEffortCurve = {
        default_mode: currentRsEffortCurve.default_mode,
        modes: {
          ...currentRsEffortCurve.modes,
          [selectedTractionMode]: {
            ...currentRsEffortCurve.modes[selectedTractionMode],
            default_curve: defaultCurve,
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

  const orderSpreadsheetValues = () => {
    const orderedValuesByVelocity = curveForSpreadsheet.sort(
      (a, b) => Number(a[0]?.value) - Number(b[0]?.value)
    );
    updateSpreadsheet(orderedValuesByVelocity);
    updateCurrentRs(orderedValuesByVelocity);
  };

  const updateComfortLevelsList = (value: string) => {
    if (!currentRsEffortCurve) return;
    const updatedModesCurves = Object.keys(currentRsEffortCurve.modes).reduce((acc, key) => {
      const currentMode = currentRsEffortCurve.modes[key];
      const newEmptyCurve = createEmptyCurve(value as Comfort);
      return {
        ...acc,
        [key]: {
          ...currentMode,
          curves: [...currentMode.curves, newEmptyCurve],
        },
      };
    }, {});

    setCurrentRsEffortCurve((prevState) => ({
      default_mode: prevState !== null ? prevState.default_mode : currentRsEffortCurve.default_mode,
      modes: updatedModesCurves,
    }));
    dispatchComfortLvl(value as Comfort);
  };

  const updateTractionModesList = (newTractionMode: string) => {
    setCurrentRsEffortCurve((prevState) => ({
      default_mode: prevState ? prevState.default_mode : newTractionMode,
      modes: {
        ...(prevState ? prevState.modes : {}),
        [newTractionMode]: createEmptyCurves(newTractionMode, rollingstockParams.comfortLevels),
      },
    }));
    dispatchTractionMode(newTractionMode);
  };

  const updateElectricalProfilesList = (value: string) => {
    if (!selectedTractionMode || !currentRsEffortCurve) return;
    const selectedModeCurves = currentRsEffortCurve.modes[selectedTractionMode];
    const newEmptyCurve = createEmptyCurve(selectedComfortLvl, value);

    const updatedCurrentRsEffortCurve = {
      ...currentRsEffortCurve,
      modes: {
        ...currentRsEffortCurve.modes,
        [selectedTractionMode]: {
          ...selectedModeCurves,
          curves: [...selectedModeCurves.curves, newEmptyCurve],
        },
      },
    };

    setCurrentRsEffortCurve(updatedCurrentRsEffortCurve);
    dispatchElectricalProfil(value);
  };

  const removeTractionMode = (value: string) => {
    if (!currentRsEffortCurve) return;
    const filteredModesList = Object.fromEntries(
      Object.entries(currentRsEffortCurve.modes).filter(([key]) => key !== value)
    );
    const updatedCurrentRsEffortCurve = {
      default_mode: currentRsEffortCurve.default_mode,
      modes: filteredModesList,
    };
    setCurrentRsEffortCurve(updatedCurrentRsEffortCurve);
  };

  const removeAnotherRsParam = <K extends keyof EffortCurveCondKeys>(
    value: EffortCurveCondKeys[K],
    title: K
  ) => {
    if (!currentRsEffortCurve) return;
    const rsEffortCurveCondKey = effortCurveCondKeys[title as keyof EffortCurveCondKeys];
    const updatedModesCurves = Object.keys(currentRsEffortCurve.modes).reduce((acc, key) => {
      const cleanedList = currentRsEffortCurve.modes[key].curves.filter(
        (curve) =>
          curve.cond &&
          curve.cond[rsEffortCurveCondKey as keyof ConditionalEffortCurve['cond']] !== value
      );

      if (isEmpty(cleanedList)) return acc;

      return {
        ...acc,
        [key]: {
          ...currentRsEffortCurve.modes[key],
          curves: cleanedList,
        },
      };
    }, {});

    const updatedCurrentRsEffortCurve = {
      ...currentRsEffortCurve,
      modes: updatedModesCurves,
    };
    setCurrentRsEffortCurve(updatedCurrentRsEffortCurve);
  };

  const confirmRsParamRemoval = <K extends keyof RollingStockSelectorParam>(
    value: RollingStockSelectorParam[K],
    title: K
  ) => {
    const isTractionModeRemoved = title === 'tractionModes';
    openModal(
      <RollingStockEditorFormModal
        mainText={t(`delete.${title}`)}
        request={() =>
          isTractionModeRemoved
            ? removeTractionMode(value as string)
            : removeAnotherRsParam(value as string, title)
        }
        buttonText={t('translation:common.confirm')}
      />
    );
  };

  useEffect(() => {
    updateRollingstockParams();
  }, [selectedTractionMode, selectedComfortLvl, selectedElectricalProfile, currentRsEffortCurve]);

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

  const extraColumnData = useMemo(
    () =>
      data && {
        defaultValue: data.base_power_class ?? '',
        data: powerRestrictionsClass,
        updateData: setPowerRestrictionsClass,
      },
    [data, powerRestrictionsClass]
  );

  const { data: availableModes } = osrdEditoastApi.endpoints.getInfraVoltages.useQuery();

  return (
    <>
      {rollingstockParams && (
        <div className="d-flex flex-wrap px-3 pb-2">
          <div className="selector-container">
            <SelectorSNCF
              key="comfort-level-selector"
              borderClass="selector-blue"
              title="comfortLevels"
              itemsList={rollingstockParams.comfortLevels}
              selectedItem={selectedComfortLvl}
              hoveredItem={hoveredRollingstockParam}
              permanentItems={[STANDARD_COMFORT_LEVEL]}
              onItemSelected={dispatchComfortLvl}
              onItemHovered={setHoveredRollingstockParam}
              onItemRemoved={confirmRsParamRemoval}
              translationFile="rollingstock"
              translationList="comfortTypes"
            />
            <AddRollingstockParam
              disabled={rollingstockParams.tractionModes.length === 0}
              displayedLists={rollingstockParams}
              updateDisplayedLists={updateComfortLevelsList}
              allOptionsList={comfortOptions}
              listName="comfortLevels"
            />
          </div>
          <div className="selector-container">
            <SelectorSNCF
              key="traction-mode-selector"
              borderClass="selector-pink"
              title="tractionModes"
              itemsList={rollingstockParams.tractionModes}
              selectedItem={selectedTractionMode || undefined}
              hoveredItem={hoveredRollingstockTractionParam}
              onItemSelected={dispatchTractionMode}
              onItemHovered={setHoveredRollingstockTractionParam}
              onItemRemoved={confirmRsParamRemoval}
              translationFile="rollingstock"
            />
            {availableModes && (
              <AddRollingstockParam
                displayedLists={rollingstockParams}
                updateDisplayedLists={updateTractionModesList}
                allOptionsList={[...availableModes, 'thermal']}
                listName="tractionModes"
              />
            )}
          </div>
          {selectedTractionMode && selectedTractionMode !== THERMAL_TRACTION_IDENTIFIER && (
            <>
              <div className="selector-container">
                <SelectorSNCF
                  key="electrical-profile-selector"
                  borderClass="selector-pink"
                  title="electricalProfiles"
                  itemsList={[...rollingstockParams.electricalProfiles]}
                  selectedItem={selectedElectricalProfile}
                  hoveredItem={hoveredRollingstockParam}
                  onItemSelected={dispatchElectricalProfil}
                  onItemHovered={setHoveredRollingstockParam}
                  onItemRemoved={confirmRsParamRemoval}
                  translationFile="rollingstock"
                />
                <AddRollingstockParam
                  displayedLists={rollingstockParams}
                  updateDisplayedLists={updateElectricalProfilesList}
                  allOptionsList={
                    electricalProfilesByMode[selectedTractionMode as keyof ElectricalProfileByMode]
                  }
                  listName="electricalProfiles"
                />
              </div>
              {selectedTractionMode && (
                <div className="selector-container">
                  <SelectorSNCF
                    key="power-restriction-selector"
                    borderClass="selector-pink"
                    title="powerRestrictions"
                    itemsList={[...rollingstockParams.powerRestrictions]}
                    selectedItem={selectedPowerRestriction}
                    hoveredItem={hoveredRollingstockParam}
                    onItemSelected={dispatchPowerRestriction}
                    onItemHovered={setHoveredRollingstockParam}
                    onItemRemoved={confirmRsParamRemoval}
                    translationFile="rollingstock"
                    extraColumn={extraColumnData}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
      {selectedTractionMode && (
        <div className="d-flex rollingstock-editor-curves p-3">
          <div className="rollingstock-editor-spreadsheet">
            <Spreadsheet
              data={curveForSpreadsheet}
              onChange={(e) => {
                updateSpreadsheet(e);
                updateCurrentRs(e);
              }}
              onBlur={orderSpreadsheetValues}
              onKeyDown={(e) => {
                if (e.key === 'Enter') orderSpreadsheetValues();
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
                hoveredElectricalParam={hoveredRollingstockParam}
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
      )}
    </>
  );
}
