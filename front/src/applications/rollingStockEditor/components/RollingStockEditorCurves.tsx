import RollingStock2Img from 'common/RollingStockSelector/RollingStock2Img';
import { listCurvesComfort } from 'common/RollingStockSelector/RollingStockCardDetail';
import RollingStockCurve from 'common/RollingStockSelector/RollingStockCurves';
import { RollingStock } from 'common/api/osrdEditoastApi';
import { isEmpty } from 'lodash';
import React, { Dispatch, SetStateAction, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Spreadsheet, { CellBase, Matrix, createEmptyMatrix } from 'react-spreadsheet';
import { emptyStringRegex } from 'utils/strings';

type Curve = {
  max_efforts: number[];
  speeds: number[];
};

export default function RollingStockEditorCurves(props: {
  data?: RollingStock;
  currentRsEffortCurve: RollingStock['effort_curves'];
  setCurrentRsEffortCurve: Dispatch<SetStateAction<RollingStock['effort_curves']>>;
}) {
  const { data, currentRsEffortCurve, setCurrentRsEffortCurve } = props;

  const { t } = useTranslation('rollingstock');
  const selectedMode = currentRsEffortCurve ? Object.keys(currentRsEffortCurve.modes)[0] : ''; // 1er mode par défaut.
  const EMPTY_MATRIX = createEmptyMatrix<CellBase<string>>(8, 2);

  // TODO: recup les listes avec filtres pour multi courbes

  const defaultCurve = (
    currentEffortCurve: RollingStock['effort_curves']
  ): Matrix<CellBase<string>> => {
    const speedsList = currentEffortCurve.modes[`${selectedMode}`].curves[0].curve?.speeds;
    const effortsList = currentEffortCurve.modes[`${selectedMode}`].curves[0].curve?.max_efforts;

    const filledMatrix: (
      | {
          value: string;
        }
      | undefined
    )[][] =
      speedsList !== undefined && effortsList !== undefined
        ? effortsList.map((effort, index) => [
            { value: (speedsList[index] * 3.6).toString() },
            { value: (effort / 10).toString() },
          ])
        : [];

    if (isEmpty(filledMatrix)) return EMPTY_MATRIX;

    return !isEmpty(filledMatrix) && filledMatrix.length > 8
      ? filledMatrix
      : filledMatrix.concat(createEmptyMatrix<CellBase<string>>(8 - filledMatrix.length, 2));
  };

  const [curves, setCurves] = useState<Matrix<CellBase<string>>>(
    defaultCurve(currentRsEffortCurve)
  );

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
      setCurves(defaultCurve(currentRsEffortCurve));
    }
  };

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

    // --- Partie pour mettre à jour le state avec les données de la nouvelle courbe ---
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
      setCurrentRsEffortCurve((prevState) => ({
        default_mode: prevState.default_mode,
        modes: {
          [`${selectedMode}`]: {
            ...prevState.modes[`${selectedMode}`],
            curves: [
              {
                cond: prevState.modes[`${selectedMode}`].curves[0].cond,
                curve: parsedCurve,
              },
            ],
          },
        },
      }));
    } else if (data) {
      setCurrentRsEffortCurve(data.effort_curves);
    }
  };

  return (
    <div className="d-flex rollingstock-editor-curves pt-3">
      <div className="rollingstock-editor-spreadsheet pl-1">
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
        {currentRsEffortCurve && (
          <RollingStockCurve
            curvesComfortList={listCurvesComfort(currentRsEffortCurve)}
            data={currentRsEffortCurve.modes}
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
  );
}
