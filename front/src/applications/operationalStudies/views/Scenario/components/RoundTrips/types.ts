import type { TrainCategory } from 'common/api/osrdEditoastApi';
import type { Duration } from 'utils/duration';

export type PairingItem = {
  id: number;
  name: string;
  category?: TrainCategory | null;
  interval: Duration | null;
  origin: string;
  stops: string[];
  destination: string;
  startTime: Date;
  requestedArrivalTime: Date | null;
} & (
  | {
      status: 'roundTrips';
      pairedItemId: number;
      isValidPair: boolean;
    }
  | {
      status: 'todo' | 'oneWays';
    }
);

export type PairDataToolTip = Pick<
  PairingItem,
  'name' | 'origin' | 'startTime' | 'destination' | 'requestedArrivalTime'
>;

export type RoundTripsColumnPair = { pair: [PairingItem, PairingItem]; isValid: boolean };

export type PairingCandidates = {
  suggestions: PairingItem[];
  others: PairingItem[];
};
