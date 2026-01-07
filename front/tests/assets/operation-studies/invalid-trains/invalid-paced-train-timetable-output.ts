import { requestedDestination, requestedPoint } from '../../../utils/manchette';
import type { StationData } from '../../../utils/types';

export const invalidPacedTrainTimetableOutput: StationData[] = [
  {
    stationName: 'North_East_station',
    stationCh: 'BV',
    trackName: '',
    requestedArrival: '11:45:43',
    requestedDeparture: '',
    stopTime: '',
    signalReceptionClosed: false,
    shortSlipDistance: false,
    margin: { theoretical: '0 %', theoreticalS: '', actual: '', difference: '' },
    calculatedArrival: '',
    calculatedDeparture: '',
  },
  {
    stationName: requestedPoint('1'),
    stationCh: '',
    trackName: 'V1',
    requestedArrival: '',
    requestedDeparture: '',
    stopTime: '300',
    signalReceptionClosed: true,
    shortSlipDistance: false,
    margin: { theoretical: '', theoreticalS: '', actual: '', difference: '' },
    calculatedArrival: '',
    calculatedDeparture: '',
  },
  {
    stationName: requestedDestination,
    stationCh: '',
    trackName: 'A',
    requestedArrival: '',
    requestedDeparture: '',
    stopTime: '0',
    signalReceptionClosed: false,
    shortSlipDistance: false,
    margin: { theoretical: '', theoreticalS: '', actual: '', difference: '' },
    calculatedArrival: '',
    calculatedDeparture: '',
  },
];
