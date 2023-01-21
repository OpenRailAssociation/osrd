import { mergeDatasArea } from '../ChartHelpers';

describe('mergeDatasArea', () => {
  test('avoid crash', () => {
    expect(mergeDatasArea()).toEqual([]);
  });
});
