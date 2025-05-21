import type { CichDictValue, Step } from 'applications/operationalStudies/types';
import { time2sec } from 'utils/timeManipulation';

export const cleanTimeFormat = (time: string): string => time.replace(/\.0$/, ''); // Remove the '.0' if it's at the end of the time string

export const buildSteps = (
  ocpTTs: Element[],
  cichDict: Record<string, CichDictValue>,
  startDate: string
): Step[] => {
  let dayOffset = 0;

  let previousDepartureSeconds: number | null = null;

  return ocpTTs
    .map((ocpTT): Step | null => {
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

      const currentArrivalSeconds = time2sec(arrivalTime);

      if (previousDepartureSeconds !== null && currentArrivalSeconds < previousDepartureSeconds) {
        dayOffset += 1;
      }

      previousDepartureSeconds = time2sec(departureTime);

      const stepDate = new Date(startDate);
      stepDate.setDate(stepDate.getDate() + dayOffset);

      const formattedDate = stepDate.toISOString().split('T')[0];

      //! We add 87 to the CI code to create the UIC. It is France specific and will break if used in other countries.
      const uic = Number(`
        87${operationalPoint.ciCode}`); // Add 87 to the CI code to create the UIC
      const { chCode } = operationalPoint;
      const formattedArrivalTime = `${formattedDate} ${arrivalTime}`;
      const formattedDepartureTime = `${formattedDate} ${departureTime}`;

      let stopFor: number | undefined;

      const arrivalDate = new Date(`${formattedDate}T${arrivalTime}`);
      const departureDate = new Date(`${formattedDate}T${departureTime}`);
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
        arrivalTime: formattedArrivalTime,
        departureTime: formattedDepartureTime,
        duration: stopFor,
      };
    })
    .filter((step) => step !== null);
};
