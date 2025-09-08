import { v4 as uuidV4 } from 'uuid';

import type { CichDictValue } from 'applications/operationalStudies/types';
import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';
import { time2sec } from 'utils/timeManipulation';

export const cleanTimeFormat = (time: string): string => time.replace(/\.0$/, ''); // Remove the '.0' if it's at the end of the time string

export const buildSteps = (
  ocpTTs: Element[],
  cichDict: Record<string, CichDictValue>,
  startDate: Date
): Required<Pick<TrainSchedule, 'path' | 'schedule'>> => {
  let dayOffset = 0;

  let previousDepartureSeconds: number | null = null;

  const steps = ocpTTs
    .map((ocpTT) => {
      const ocpRef = ocpTT.getAttribute('ocpRef');
      const times = ocpTT.getElementsByTagName('times')[0];
      const isLastOcp = ocpTT === ocpTTs.at(-1);
      const ocpType = ocpTT.getAttribute('ocpType');
      let departureTime = times?.getAttribute('departure') || '';
      let arrivalTime = ocpType === 'pass' ? departureTime : times?.getAttribute('arrival') || '';
      arrivalTime = cleanTimeFormat(arrivalTime);
      departureTime = cleanTimeFormat(departureTime);

      if (!ocpRef) {
        console.error('ocpRef is null or undefined');
        return null;
      }

      const operationalPoint = cichDict[ocpRef];

      const currentDepartureSeconds = time2sec(departureTime);

      const stepDate = new Date(startDate);
      stepDate.setDate(stepDate.getDate() + dayOffset);

      const formattedDate = stepDate.toISOString().split('T')[0];

      const arrivalDate = new Date(`${formattedDate}T${arrivalTime}`);
      const departureDate = new Date(`${formattedDate}T${departureTime}`);

      if (previousDepartureSeconds && currentDepartureSeconds < previousDepartureSeconds) {
        dayOffset += 1;

        arrivalDate.setDate(arrivalDate.getDate() + 1);
        departureDate.setDate(departureDate.getDate() + 1);
      }

      previousDepartureSeconds = currentDepartureSeconds;

      //! We add 87 to the CI code to create the UIC. It is France specific and will break if used in other countries.
      const uic = Number(`
        87${operationalPoint.ciCode}`); // Add 87 to the CI code to create the UIC
      const { chCode } = operationalPoint;

      let stopFor: number | undefined;

      if (ocpType === 'stop') {
        if (arrivalTime && departureTime) {
          stopFor = Math.round((departureDate.getTime() - arrivalDate.getTime()) / 1000);
        } else {
          stopFor = 0;
        }
      } else if (ocpType === 'pass') {
        if (isLastOcp) {
          stopFor = 0;
        }
      }

      return {
        uic,
        chCode,
        name: ocpRef,
        arrivalDate,
        departureDate,
        stopFor,
      };
    })
    .filter((step) => step !== null);

  const path: TrainSchedule['path'] = [];
  const schedule: TrainSchedule['schedule'] = [];
  const departureTime = steps[0].departureDate;
  for (const step of steps) {
    const id = uuidV4();
    if (!Number.isNaN(step.uic)) {
      path.push({
        id,
        uic: step.uic,
        secondary_code: step.chCode,
      });
    } else {
      path.push({
        id,
        trigram: step.name,
        secondary_code: step.chCode,
      });
    }
    if (path.length > 1) {
      schedule.push({
        at: id,
        arrival: Duration.subtractDate(step.arrivalDate, departureTime).toISOString(),
        stop_for: step.stopFor !== undefined ? `PT${step.stopFor}S` : null,
      });
    }
  }

  return { path, schedule };
};
