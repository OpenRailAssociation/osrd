import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { DataSheetGrid, keyColumn, intColumn, floatColumn } from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import { useTranslation } from 'react-i18next';

import type {
  ConditionalEffortCurveForm,
  DataSheetCurve,
  EffortCurveForms,
} from 'modules/rollingStock/types';
import { replaceElementAtIndex } from 'utils/array';
import { msToKmh } from 'utils/physics';

import formatCurve from './formatSpreadSheetCurve';

type CurveSpreadsheetProps = {
  selectedCurve: ConditionalEffortCurveForm;
  selectedCurveIndex: number;
  selectedTractionModeCurves: ConditionalEffortCurveForm[];
  effortCurves: EffortCurveForms;
  setEffortCurves: Dispatch<SetStateAction<EffortCurveForms | null>>;
  selectedTractionMode: string;
  isDefaultCurve: boolean;
};

const CurveSpreadsheet = ({
  selectedCurve,
  selectedCurveIndex,
  selectedTractionModeCurves,
  effortCurves,
  setEffortCurves,
  selectedTractionMode,
  isDefaultCurve,
}: CurveSpreadsheetProps) => {
  const { t } = useTranslation('rollingstock');
  const columns = useMemo(
    () => [
      { ...keyColumn('speed', intColumn), title: t('speed') },
      { ...keyColumn('effort', floatColumn), title: t('effort') },
    ],
    [t]
  );

  const [needsSort, setNeedsSort] = useState<boolean>(false);

  const handleBlur = useCallback(() => {
    setNeedsSort(true);
  }, []);

  const updateRollingStockCurve = (newCurve: DataSheetCurve[]) => {
    // Format the new curve
    const formattedCurve = formatCurve(newCurve);

    // Create the updated selected curve
    const updatedSelectedCurve = {
      ...selectedCurve,
      curve: formattedCurve,
    };

    // Replace the updated curve in the selected traction mode curves
    const updatedCurves = replaceElementAtIndex(
      selectedTractionModeCurves,
      selectedCurveIndex,
      updatedSelectedCurve
    );

    // Update the effort curves
    const updatedEffortCurve = {
      ...effortCurves,
      [selectedTractionMode]: {
        ...effortCurves[selectedTractionMode],
        curves: updatedCurves,
        ...(isDefaultCurve ? { default_curve: formattedCurve } : {}),
      },
    };

    setEffortCurves(updatedEffortCurve);
  };

  const spreadsheetCurve = useMemo(() => {
    const { speeds, max_efforts } = selectedCurve.curve;

    const filledDataSheet: DataSheetCurve[] = max_efforts.map((effort, index) => ({
      speed: speeds[index] !== null ? Math.round(msToKmh(speeds[index]!)) : null,
      // Effort needs to be displayed in kN
      effort: effort !== null ? effort / 1000 : null,
    }));

    // Add an empty line for input only if last line is not already empty
    if (
      filledDataSheet.length === 0 ||
      filledDataSheet[filledDataSheet.length - 1].speed !== null ||
      filledDataSheet[filledDataSheet.length - 1].effort !== null
    ) {
      filledDataSheet.push({ speed: null, effort: null });
    }

    return filledDataSheet;
  }, [selectedCurve]);

  useEffect(() => {
    if (needsSort) {
      const sortedSpreadsheetValues = spreadsheetCurve
        .filter((item) => item.speed !== null || item.effort !== null)
        .sort((a, b) => {
          if (a.speed === null && b.speed === null) return Number(a.effort) - Number(b.effort);
          if (a.speed === null) return -1;
          if (b.speed === null) return 1;
          return Number(a.speed) - Number(b.speed);
        });

      updateRollingStockCurve(sortedSpreadsheetValues);
      setNeedsSort(false);
    }
  }, [needsSort]);

  return (
    <div className="rollingstock-editor-spreadsheet">
      <DataSheetGrid
        value={spreadsheetCurve}
        columns={columns}
        onChange={(e) => updateRollingStockCurve(e as DataSheetCurve[])}
        rowHeight={30}
        addRowsComponent={false}
        onBlur={handleBlur}
        onSelectionChange={handleBlur}
        height={332}
      />
    </div>
  );
};

export default CurveSpreadsheet;
