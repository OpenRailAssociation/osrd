import { Matrix } from 'react-spreadsheet';
import { EffortCurveForm } from 'modules/rollingStock/types';
import { emptyStringRegex, onlyDigit } from 'utils/strings';
import { kmhToMs } from 'utils/physics';

/** Remove rows which have at least 1 empty cell */
const filterUnvalidRows = (sheetValues: Matrix<{ value: string }>) =>
  sheetValues.filter(
    ([a, b]) =>
      (a?.value && !emptyStringRegex.test(a.value)) || (b?.value && !emptyStringRegex.test(b.value))
  );

/** For each cell, filter non digit characters */
const removeNonDigitCharacters = (rows: Matrix<{ value: string }>) =>
  rows.map((row) => row.map((cell) => onlyDigit((cell?.value || '').replaceAll(',', '.'))));

const formatToEffortCurve = (rows: Matrix<string>) =>
  rows.reduce<EffortCurveForm>(
    (result, row) => {
      result.speeds.push(row[0] !== '' ? kmhToMs(Number(row[0])) : undefined);
      result.max_efforts.push(row[1] !== '' ? Number(row[1]) * 10 : undefined);
      return result;
    },
    { max_efforts: [], speeds: [] }
  );

/**
 * Given a spreadsheet, return an EffortCurve
 * - remove rows which have at least 1 empty cell
 * - remove non digit characters in each cell
 * - convert rows data to EffortCurve
 */
export default function formatCurve(sheetValues: Matrix<{ value: string }>) {
  const validRows = filterUnvalidRows(sheetValues);
  const numericRows = removeNonDigitCharacters(validRows);
  return formatToEffortCurve(numericRows);
}
