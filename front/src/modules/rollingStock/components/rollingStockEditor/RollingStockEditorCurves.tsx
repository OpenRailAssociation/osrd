import {
  RollingStock2Img,
  RollingStockCurve,
} from 'modules/rollingStock/components/RollingStockSelector';
import { listCurvesComfort } from 'modules/rollingStock/components/RollingStockSelector/RollingStockCardDetail';
import { Comfort, RollingStock } from 'common/api/osrdEditoastApi';
import { isEmpty } from 'lodash';
import React, { Dispatch, SetStateAction, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Spreadsheet, { CellBase, Matrix, createEmptyMatrix } from 'react-spreadsheet';
import { emptyStringRegex } from 'utils/strings';
import {
  updateComfortLvl,
  updateElectricalProfile,
  updateTractionMode,
} from 'reducers/rollingstockEditor';
import { useDispatch, useSelector } from 'react-redux';
import {
  getComfortLevel,
  getElectricalProfile,
  getTractionMode,
} from 'reducers/rollingstockEditor/selectors';
import SelectorSNCF from 'common/SelectorSNCF';
import {
  SelectedCurve,
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

  const EMPTY_MATRIX = createEmptyMatrix<CellBase<string>>(8, 2);

  const selectedElectricalProfile = useSelector(getElectricalProfile);
  const selectedTractionMode = useSelector(getTractionMode);
  const selectedComfortLvl = useSelector(getComfortLevel);

  const dispatchComfortLvl = (value: string) => {
    dispatch(updateComfortLvl(value as Comfort));
  };
  const dispatchElectricalProfil = (value: string) => {
    dispatch(updateElectricalProfile(value));
  };
  const dispatchTractionMode = (value: string) => {
    dispatch(updateTractionMode(value));
  };

  const [rollingstockParams, setRollingstockParams] = useState<RollingStockSelectorParams>();

  /* ****  We get a list of all existing comfort levels, modes & profils in 
  the selected rollingstock to fill the selectors lists **** */
  const updateRollingstockParams = useCallback(() => {
    const rsComfortLevels = listCurvesComfort(currentRsEffortCurve);
    const tractionModes = Object.keys(currentRsEffortCurve.modes);
    const rsElectricalProfiles =
      selectedTractionMode !== THERMAL_TRACTION_IDENTIFIER &&
      currentRsEffortCurve.modes[selectedTractionMode]
        ? currentRsEffortCurve.modes[selectedTractionMode].curves.reduce((acc, curve) => {
            const rsElectricalProfile = curve.cond?.electrical_profile_level as string;
            if (curve.cond?.comfort === selectedComfortLvl) {
              acc.push(rsElectricalProfile);
            }
            return acc;
          }, [] as string[])
        : [];

    if (!rsComfortLevels.includes(selectedComfortLvl)) {
      dispatchComfortLvl(rsComfortLevels[0] || STANDARD_COMFORT_LEVEL);
    }
    if (selectedTractionMode === '' || !tractionModes.includes(selectedTractionMode)) {
      dispatchTractionMode(Object.keys(currentRsEffortCurve.modes)[0]);
      dispatchElectricalProfil(rsElectricalProfiles[0]);
    }
    if (
      (selectedElectricalProfile === null ||
        !rsElectricalProfiles.includes(selectedElectricalProfile)) &&
      !isEmpty(rsElectricalProfiles)
    ) {
      dispatchElectricalProfil(rsElectricalProfiles[0]);
    }
    setRollingstockParams({
      comfortlevels: rsComfortLevels,
      tractionModes,
      electricalProfiles: rsElectricalProfiles,
    });
  }, [selectedTractionMode, currentRsEffortCurve, selectedElectricalProfile]);

  // **** We filter all the curves to find the one matching all selected params ****
  const selectCurve = useCallback((): SelectedCurve => {
    if (!currentRsEffortCurve.modes[selectedTractionMode]) {
      return {
        [selectedTractionMode]: {
          ...currentRsEffortCurve.modes[selectedTractionMode],
          curves: [],
        },
      };
    }
    let curveToDisplay = currentRsEffortCurve.modes[selectedTractionMode]?.curves.filter(
      (curve) => curve.cond?.comfort === selectedComfortLvl
    );
    if (selectedTractionMode !== THERMAL_TRACTION_IDENTIFIER) {
      curveToDisplay = curveToDisplay.filter(
        (curve) => curve.cond?.electrical_profile_level === selectedElectricalProfile
      );
    }

    return {
      [selectedTractionMode]: {
        ...currentRsEffortCurve.modes[selectedTractionMode],
        curves: curveToDisplay,
      },
    };
  }, [selectedTractionMode, selectedElectricalProfile, selectedComfortLvl]);

  const [selectedCurve, setSelectedCurve] = useState(selectCurve());

  // **** The curve must be formatted to match the Spreadsheet component type ****
  const defaultCurve = (
    newSelectedCurve: RollingStock['effort_curves']['modes']
  ): Matrix<CellBase<string>> => {
    if (isEmpty(newSelectedCurve[selectedTractionMode].curves)) return EMPTY_MATRIX;

    const speedsList = newSelectedCurve[selectedTractionMode].curves[0].curve?.speeds;
    const effortsList = newSelectedCurve[selectedTractionMode].curves[0].curve?.max_efforts;

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

    return !isEmpty(filledMatrix) && filledMatrix.length > 8
      ? filledMatrix
      : filledMatrix.concat(createEmptyMatrix<CellBase<string>>(8 - filledMatrix.length, 2));
  };

  const [curves, setCurves] = useState<Matrix<CellBase<string>>>(() => defaultCurve(selectedCurve));

  const updateSpreadsheet = (e: Matrix<{ value: string }>) => {
    const emptyRow = [undefined, undefined];
    const sheetValues = e.filter(
      (step) => step[0]?.value !== undefined || step[1]?.value !== undefined
    );

    if (!isEmpty(sheetValues) && sheetValues.length >= 8) {
      sheetValues.push(emptyRow);
      setCurves(sheetValues);
    } else if (!isEmpty(sheetValues) && sheetValues.length < 8) {
      const fillingRows = createEmptyMatrix<CellBase<string>>(8 - sheetValues.length, 2);
      setCurves(sheetValues.concat(fillingRows));
    } else {
      setCurves(defaultCurve(selectedCurve));
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
    if (!isEmpty(parsedCurve.max_efforts) && !isEmpty(parsedCurve.speeds)) {
      // ** TODO: Add update CurrentRsEffortCurve **

      setSelectedCurve((prevState) => ({
        [selectedTractionMode]: {
          ...prevState[selectedTractionMode],
          curves: [
            {
              cond: selectedCurve[selectedTractionMode].curves[0].cond,
              curve: parsedCurve,
            },
          ],
        },
      }));
    } else if (data) {
      setCurrentRsEffortCurve(data.effort_curves);
    }
  };

  useEffect(() => {
    updateRollingstockParams();
  }, [selectedTractionMode, selectedComfortLvl]);

  useEffect(() => {
    const newSelectedCurve = selectCurve();
    setSelectedCurve(newSelectedCurve);
    setCurves(defaultCurve(newSelectedCurve));
  }, [selectedComfortLvl, selectedTractionMode, selectedElectricalProfile]);

  return (
    <>
      {rollingstockParams && (
        <div className="d-flex flex-wrap px-3 pb-3">
          <SelectorSNCF
            key="comfort-level-selector"
            borderClass="selector-blue"
            title="comfortLevel"
            itemsList={rollingstockParams.comfortlevels}
            updateItemInStore={dispatchComfortLvl}
            selectedItem={selectedComfortLvl}
            translationFile="rollingstock"
            translationList="comfortTypes"
          />
          <SelectorSNCF
            key="traction-mode-selector"
            borderClass="selector-pink"
            title="tractionMode"
            itemsList={rollingstockParams.tractionModes}
            updateItemInStore={dispatchTractionMode}
            selectedItem={selectedTractionMode}
            translationFile="rollingstock"
          />
          {!currentRsEffortCurve.modes.thermal && (
            <SelectorSNCF
              key="electrical-profile-selector"
              borderClass="selector-pink"
              title="electricalProfile"
              itemsList={[...rollingstockParams.electricalProfiles]}
              updateItemInStore={dispatchElectricalProfil}
              selectedItem={selectedElectricalProfile}
              translationFile="rollingstock"
            />
          )}
        </div>
      )}
      <div className="d-flex rollingstock-editor-curves p-3">
        <div className="rollingstock-editor-spreadsheet">
          <Spreadsheet
            data={curves}
            onChange={(e) => {
              updateSpreadsheet(e);
              updateCurrentRs(e);
            }}
            columnLabels={[t('speed'), t('effort')]}
          />
        </div>
        <div className="rollingstock-body">
          {!isEmpty(selectedCurve[selectedTractionMode]?.curves) && rollingstockParams && (
            <RollingStockCurve
              curvesComfortList={[selectedComfortLvl]}
              data={selectedCurve}
              isOnEditionMode
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
