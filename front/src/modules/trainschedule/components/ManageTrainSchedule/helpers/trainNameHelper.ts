import rollingstockOpenData2OSRD from 'modules/trainschedule/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';

import type { RollingstockOpenData2OSRDKeys } from '../../ImportTrainSchedule/types';

const trainNameWithNum = (name: string, actualTrainCount: number, total: number): string => {
  if (total === 1) {
    return name;
  }
  // Test if numeric & integer in a good way
  if (/^\d+$/.test(name)) {
    return (parseInt(name, 10) + (actualTrainCount - 1)).toString();
  }
  return `${name} ${actualTrainCount}`;
};

const normalizeString = (rollingStock: string): string =>
  rollingStock.toUpperCase().replace(/[_\W]/g, '');

export const findValidTrainNameKey = (
  rollingStock: string
): RollingstockOpenData2OSRDKeys | undefined => {
  const normalizedRollingStock = normalizeString(rollingStock);

  return Object.keys(rollingstockOpenData2OSRD).find((key) => {
    const rollingStockKey = normalizeString(key);
    const rollingStockValue = normalizeString(
      rollingstockOpenData2OSRD[key as keyof typeof rollingstockOpenData2OSRD]
    );

    return (
      normalizedRollingStock.includes(rollingStockKey) ||
      normalizedRollingStock.includes(rollingStockValue)
    );
  }) as RollingstockOpenData2OSRDKeys | undefined;
};

export default trainNameWithNum;
