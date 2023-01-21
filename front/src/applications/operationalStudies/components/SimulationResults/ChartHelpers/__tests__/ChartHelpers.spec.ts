import { mergeDatasArea } from '../../SimulationResults/ChartHelpers/ChartHelpers';

describe('mergeDatasArea', () => {
  test('avoid crash', () => {
    expect(mergeDatasArea()).toEqual([]);
  });
});
