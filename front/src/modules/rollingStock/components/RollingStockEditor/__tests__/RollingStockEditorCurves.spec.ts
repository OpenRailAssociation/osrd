import {
  createEmptyCurve,
  createEmptyCurves,
  orderElectricalProfils,
  sortSelectedModeCurves,
} from 'modules/rollingStock/helpers/utils';

const emptyEffortCurves = createEmptyCurves('1500V', ['STANDARD', 'AC', 'HEATING']);
const newCurveWithAllCond = createEmptyCurve('STANDARD', 'A1', 'C1US');
const newCurveWithOnlyPR = createEmptyCurve('STANDARD', null, 'C1US');
const newCurveWithOnlyEP = createEmptyCurve('STANDARD', 'B');

const electricalProfilesList1500 = ['B', 'C', 'A', null, 'O'];

describe('sortSelectedModeCurves', () => {
  it('should order the curves list and put the newCurve with all conditions at the beginning of the list', () => {
    const result = sortSelectedModeCurves([...emptyEffortCurves.curves, newCurveWithAllCond]);
    const expected = [newCurveWithAllCond, ...emptyEffortCurves.curves];

    expect(result).toEqual(expected);
  });

  it('should put the newCurve with only power restriction given after the curve with all conditions in the list', () => {
    const result = sortSelectedModeCurves([
      ...emptyEffortCurves.curves,
      newCurveWithOnlyPR,
      newCurveWithAllCond,
    ]);
    const expected = [newCurveWithAllCond, newCurveWithOnlyPR, ...emptyEffortCurves.curves];

    expect(result).toEqual(expected);
  });

  it('should order the curves list and put the newCurve with only electrical profile given after the curve with all conditions in the list', () => {
    const result = sortSelectedModeCurves([
      ...emptyEffortCurves.curves,
      newCurveWithOnlyEP,
      newCurveWithAllCond,
    ]);
    const expected = [newCurveWithAllCond, newCurveWithOnlyEP, ...emptyEffortCurves.curves];

    expect(result).toEqual(expected);
  });

  it('should order the curves list and order them based on the number of conditions they have', () => {
    const result = sortSelectedModeCurves([
      ...emptyEffortCurves.curves,
      newCurveWithOnlyEP,
      newCurveWithAllCond,
      newCurveWithOnlyPR,
    ]);
    const expected = [
      newCurveWithAllCond,
      newCurveWithOnlyPR,
      newCurveWithOnlyEP,
      ...emptyEffortCurves.curves,
    ];

    expect(result).toEqual(expected);
  });
});

describe('orderElectricalProfils', () => {
  it('should order the list of electrical profiles', () => {
    const result = orderElectricalProfils(electricalProfilesList1500, '1500V');
    const expected = [null, 'O', 'A', 'B', 'C'];

    expect(result).toEqual(expected);
  });
});
