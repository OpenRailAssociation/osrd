import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { StdcmStopTypes, StdcmSuccessResponse } from 'applications/stdcm/types';
import { dateToHHMMSS } from 'utils/date';
import { Duration } from 'utils/duration';

import { getArrivalTimes, getSecondaryCode } from './formatSimulationReportSheet';

type RouteTableRow = {
  name: string;
  secondaryCode: string;
  arrivesAt?: string;
  passageStop?: Duration;
  leavesAt?: string;
  stopType?: StdcmStopTypes;
  tolerances?: { before: Duration; after: Duration };
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
      name: step.location?.name || '',
      secondaryCode: getSecondaryCode(step),
      arrivesAt: isLast ? getArrivalTimes(step, t) : '',
      leavesAt: isFirst ? getArrivalTimes(step, t) : '',
      passageStop: step.isVia ? step.stopFor : undefined,
      stopType: step.isVia ? step.stopType : undefined,
      tolerances:
        !step.isVia && step.tolerances && step.arrivalType === 'preciseTime'
          ? step.tolerances
          : undefined,
      italic: step.isVia || step.arrivalType !== 'preciseTime',
    });
  });
  return rows;
};

export default formatRouteTable;
