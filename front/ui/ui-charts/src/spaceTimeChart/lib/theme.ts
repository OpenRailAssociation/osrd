import { type SpaceTimeChartTheme } from './types';

export function validateTheme({
  breakpoints,
  timeRanges,
  timeCaptionsStyles,
  timeCaptionsPriorities,
  timeGraduationsStyles,
  timeGraduationsPriorities,
}: SpaceTimeChartTheme): void {
  const PREFIX = 'SpaceTimeChartTheme is invalid:';

  const breakpointsCount = breakpoints.length;
  const timeRangesCount = timeRanges.length;
  const timeCaptionsValues = new Set(timeCaptionsPriorities.flatMap((arr) => arr));
  const timeGraduationsValues = new Set(timeGraduationsPriorities.flatMap((arr) => arr));

  // Time captions:
  if (timeCaptionsPriorities.length !== breakpointsCount)
    throw new Error(
      `${PREFIX}: timeCaptionsPriorities should have as much elements as breakpoints.`
    );
  if (timeCaptionsPriorities.some((arr) => arr.length !== timeRangesCount))
    throw new Error(
      `${PREFIX}: each array in timeCaptionsPriorities should have as much elements as timeRanges.`
    );
  if (Array.from(timeCaptionsValues).some((v) => v !== 0 && !timeCaptionsStyles[v]))
    throw new Error(
      `${PREFIX}: all values (except 0s) from timeCaptionsPriorities should have a matching style in timeCaptionsStyles.`
    );

  // Time graduations:
  if (timeGraduationsPriorities.length !== breakpointsCount)
    throw new Error(
      `${PREFIX}: timeGraduationsPriorities should have as much elements as breakpoints.`
    );
  if (timeGraduationsPriorities.some((arr) => arr.length !== timeRangesCount))
    throw new Error(
      `${PREFIX}: each array in timeGraduationsPriorities should have as much elements as timeRanges.`
    );
  if (Array.from(timeGraduationsValues).some((v) => v !== 0 && !timeGraduationsStyles[v]))
    throw new Error(
      `${PREFIX}: all values (except 0s) from timeGraduationsPriorities should have a matching style in timeGraduationsStyles.`
    );
  if (!timeGraduationsStyles[1])
    throw new Error(`${PREFIX}: there should be a timeGraduationsStyles for value 1.`);
}
