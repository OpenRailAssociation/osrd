import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import { dateToHHMMSS } from 'utils/date';
import { Duration } from 'utils/duration';

import {
  getArrivalTimes,
  getSecondaryCode,
  getStopDurationTime,
  getStopType,
} from './formatSimulationReportSheet';

type RouteTableRow = {
  index: number;
  name: string;
  secondaryCode: string;
  arrivesAt?: string;
  passageStop?: string;
  leavesAt?: string;
  stopType?: string;
  tolerances?: string[];
  italic?: boolean;
};

type FormatRouteTableOptions =
  | { mode: 'stdcm'; stdcmData: StdcmSuccessResponse }
  | {
      mode: 'operationalStudies';
      operationalPointsList: OperationalPointWithTimeAndSpeed[];
    };

const formatRouteTable = (options: FormatRouteTableOptions): RouteTableRow[] => {
  const { t } = useTranslation('stdcm');
  const rows: RouteTableRow[] = [];

  // handle operational studies mode
  if (options.mode === 'operationalStudies') {
    options.operationalPointsList.forEach((step, index) => {
      const isFirst = index === 0;
      const isLast = index === options.operationalPointsList.length - 1;
      if (!isFirst && !isLast && step.duration === Duration.zero) return;

      rows.push({
        index: rows.length + 1,
        name: step.name || t('reportSheet.unknown'),
        secondaryCode: step.ch ?? '',
        arrivesAt: isLast ? dateToHHMMSS(step.time, { withoutSeconds: true }) : '',
        leavesAt: isFirst ? dateToHHMMSS(step.time, { withoutSeconds: true }) : '',
        italic: false,
      });
    });
    return rows;
  }

  // handle stdcm mode
  options.stdcmData.simulationPathSteps.forEach((step, index) => {
    const isFirst = index === 0;
    const isLast = index === options.stdcmData.simulationPathSteps.length - 1;

    rows.push({
      index: rows.length + 1,
      name: step.location?.name || '',
      secondaryCode: getSecondaryCode(step),
      arrivesAt: isLast ? getArrivalTimes(step, t) : '',
      leavesAt: isFirst ? getArrivalTimes(step, t) : '',
      passageStop: step.isVia && step.stopFor ? getStopDurationTime(step.stopFor) : '',
      stopType: getStopType(step, t),
      tolerances:
        !step.isVia && step.tolerances && step.arrivalType === 'preciseTime'
          ? [
              `+${step.tolerances.after.total('minute')}`,
              `-${step.tolerances.before.total('minute')}`,
            ]
          : undefined,
      italic: step.isVia || step.arrivalType !== 'preciseTime',
    });
  });
  return rows;
};

export default formatRouteTable;
