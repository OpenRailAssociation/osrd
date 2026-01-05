import rollingstockOpenData2OSRD from '../rollingstock_opendata2osrd.json';
import type { RollingstockOpenData2OSRDKeys } from '../types';

const normalizeString = (rollingStock: string): string =>
  rollingStock.toUpperCase().replace(/[_\W]/g, '');

const findValidTrainNameKey = (rollingStock: string): RollingstockOpenData2OSRDKeys | undefined => {
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

export default findValidTrainNameKey;
