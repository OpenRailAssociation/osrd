import type { ElectrificationVoltage } from 'applications/operationalStudies/types';
import type { PathProperties, RangedValue } from 'common/api/osrdEditoastApi';

const isElectrification = (
  value: ElectrificationVoltage
): value is { type: 'electrification'; voltage: string } => value.type === 'electrification';

const isNeutralSection = (
  value: ElectrificationVoltage
): value is {
  lower_pantograph: boolean;
  type: 'neutral_section';
} => value.type === 'neutral_section';

const isNonElectrified = (value: ElectrificationVoltage): value is { type: 'non_electrified' } =>
  value.type === 'non_electrified';

/**
 * Given electrifications on path, return the list of voltages on the path ranges
 *
 * Filter the neutral sections and group the ranges
 */
const getPathVoltages = (
  electrifications?: NonNullable<PathProperties['electrifications']>,
  pathLength?: number
): RangedValue[] => {
  if (!electrifications || !pathLength) return [];

  const boundaries = [...electrifications.boundaries, pathLength];
  const ranges: RangedValue[] = [];
  let start = 0;
  let currentVoltage: string = '';

  electrifications.values.forEach((electrification, index) => {
    if (isNonElectrified(electrification)) {
      if (currentVoltage) {
        // non electrified range, we add the previous range which has a voltage
        ranges.push({ begin: start, end: boundaries[index - 1], value: currentVoltage });
        currentVoltage = '';
        start = boundaries[index - 1] || 0;
      }
    } else if (isElectrification(electrification)) {
      if (!currentVoltage) {
        // electrified range, we add the previous range without electrification
        if (index > 0) ranges.push({ begin: start, end: boundaries[index - 1], value: '' });
        start = boundaries[index - 1] || 0;
      } else if (electrification.voltage !== currentVoltage) {
        // electrified range, we add the previous range which has a different voltage
        ranges.push({ begin: start, end: boundaries[index], value: currentVoltage });
        start = boundaries[index];
      }
      currentVoltage = electrification.voltage;
    } else if (isNeutralSection(electrification)) {
      const nextElectrification = electrifications.values[index + 1];
      if (
        currentVoltage &&
        (!nextElectrification ||
          !isElectrification(nextElectrification) ||
          nextElectrification.voltage !== currentVoltage)
      ) {
        // neutral range, we add the previous range with electrification if:
        // - there is no next range
        // - the next range is an electrification and the voltage is not the same than on the previous one
        ranges.push({ begin: start, end: boundaries[index - 1], value: currentVoltage });
        currentVoltage = '';
        start = boundaries[index - 1];
      }
    }

    if (index === electrifications.values.length - 1) {
      // we add the last range
      ranges.push({ begin: start, end: pathLength, value: currentVoltage });
    }
  });

  return ranges;
};

export default getPathVoltages;
