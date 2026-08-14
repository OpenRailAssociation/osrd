export type PropagationMode =
  | 'shiftAllWaypoints'
  | 'fromDeparture'
  | 'atThisWaypoint'
  | 'toDestination';

type TimesStopsTableMargin = {
  requestedTheoretical: string;
  computedTheoretical: string;
  real: string;
  difference: string;
};

type TimesStopsTableRowStatus =
  | 'warning-margin'
  | 'warning-schedule'
  | 'success-schedule'
  | 'invalid-path-step'
  | '';

export type TimesStopsTableRow = {
  index: number;
  status: TimesStopsTableRowStatus;
  stationName: string;
  stationCh: string;
  trackName: string;
  requestedArrival: string;
  calculatedArrival: string;
  stopTime: string;
  requestedDeparture: string;
  calculatedDeparture: string;
  signalReceptionClosed: boolean;
  shortSlipDistance: boolean;
  powerRestriction: string;
  margin: TimesStopsTableMargin;
  timeFromAboveWaypoint: string;
  totalArrivalTime: string;
};
