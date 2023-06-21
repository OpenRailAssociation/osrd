import RollingStock2Img from 'common/RollingStockSelector/RollingStock2Img';
import { listCurvesComfort } from 'common/RollingStockSelector/RollingStockCardDetail';
import RollingStockCurve from 'common/RollingStockSelector/RollingStockCurves';
import { RollingStock } from 'common/api/osrdEditoastApi';
import { isEmpty } from 'lodash';
import React, { useEffect, useState } from 'react';
import Spreadsheet, { CellBase, Matrix, createEmptyMatrix } from 'react-spreadsheet';

export default function RollingStockEditorCurves(props: { data: RollingStock }) {
  const { data } = props;
  const [currentRs, setCurrentRs] = useState(data.effort_curves.modes);
  const selectedMode = Object.keys(data.effort_curves.modes)[0];
  const EMPTY_MATRIX = createEmptyMatrix<CellBase<string>>(5, 2);
  const [curves, setCurves] = useState<Matrix<CellBase<string>>>(EMPTY_MATRIX);

  type Curve = {
    max_efforts: number[];
    speeds: number[];
  };

  const updateSpreadsheet = (e: Matrix<{ value: string }>) => {
    const emptyRow = [undefined, undefined];
    const sheetValues = e.filter(
      (step) => step[0]?.value !== undefined || step[1]?.value !== undefined
    );
    if (!isEmpty(sheetValues)) {
      sheetValues.push(emptyRow);
      setCurves(sheetValues);
    } else {
      setCurves(EMPTY_MATRIX);
    }
  };

  const parseCurve = (e: Matrix<{ value: string }>) => {
    const sheetValues = e
      .filter(
        (step) =>
          step[0]?.value !== (undefined && /^\s+$/) && step[1]?.value !== (undefined && /^\s+$/)
      )
      .map((row) => row.map((rowValue) => rowValue?.value.replaceAll(',', '.')));

    // --- Partie pour mettre à jour le state avec les données de la nouvelle courbe ---
    if (!isEmpty(sheetValues)) {
      const newCurve: Curve = { max_efforts: [], speeds: [] };
      sheetValues.forEach((step) => {
        newCurve.speeds.push(Number(step[0] as string) / 3.6);
        newCurve.max_efforts.push(Number(step[1] as string) * 10);
      });

      setCurrentRs((prevState) => ({
        [`${selectedMode}`]: {
          ...prevState[`${selectedMode}`],
          curves: [
            {
              cond: prevState[`${selectedMode}`].curves[0].cond,
              curve: newCurve,
            },
          ],
        },
      }));
    } else {
      setCurrentRs(data.effort_curves.modes);
    }
  };

  useEffect(() => {
    setCurrentRs(data.effort_curves.modes);
  }, [data]);

  return (
    <div className="d-flex rollingstock-editor-curves">
      <div className="rollingstock-editor-spreadsheet pt-4 pl-3">
        <Spreadsheet
          data={curves}
          onChange={(e) => {
            updateSpreadsheet(e);
            parseCurve(e);
          }}
          columnLabels={['Vitesse (Km/h)', 'Effort (daN)']}
        />
      </div>
      <div className="rollingstock-body">
        <RollingStockCurve
          curvesComfortList={listCurvesComfort(data.effort_curves)}
          data={currentRs}
        />
        <div className="rollingstock-detail-container-img">
          <div className="rollingstock-detail-img">
            <RollingStock2Img rollingStock={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
