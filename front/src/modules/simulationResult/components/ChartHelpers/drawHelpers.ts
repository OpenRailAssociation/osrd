import type {
  ElectricalConditionSegment,
  PowerRestrictionSegment,
  DrawingKeys,
} from 'applications/operationalStudies/consts';

/** Returns the start, middle and end values of the heights or the positions
 * (depending on the axis and rotation) of a given segment. */
const getAxisValues = (
  segment: ElectricalConditionSegment | PowerRestrictionSegment,
  keyValues: DrawingKeys,
  keyIndex: number
) => ({
  start: segment[`${keyValues[keyIndex]}_start`],
  middle: segment[`${keyValues[keyIndex]}_middle`],
  end: segment[`${keyValues[keyIndex]}_end`],
});
export default getAxisValues;
