import { Chart, TrainsWithArrivalAndDepartureTimes } from 'reducers/osrdsimulation/types';

export type DispatchUpdateChart = (chart: Chart) => void;
export type DispatchUpdateMustRedraw = (newMustRedraw: boolean) => void;
export type DispatchUpdateSelectedTrainId = (selectedTrainId: number) => void;
export type DispatchUpdateTimePositionValues = (newTimePositionValues: Date) => void;
export type DispatchUpdateDepartureArrivalTimes = (
  newDepartureArrivalTimes: TrainsWithArrivalAndDepartureTimes[]
) => void;
