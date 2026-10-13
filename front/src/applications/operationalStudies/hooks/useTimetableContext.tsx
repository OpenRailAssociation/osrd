import { createContext, useContext } from 'react';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import type { PanelSelectionMode } from 'modules/simulationResult/components/SpaceTimeChartWrapper/CurveSelectionSidePanel';
import type { TrainId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';

/**
 * TimetableContextType holds timetable-specific data, such as train schedules
 * and helpers to update cached payloads.
 *
 * It does not contain any simulation-related data.
 */
export type TimetableContextType = {
  trainSchedules: Map<number, TrainScheduleResponse>;
  hourlyTimetableDuration?: Duration;
  removeTrainSchedules: (ids: number[]) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  updateTrainScheduleDepartureTime: (
    draggedTrainId: TrainId,
    newDeparture: Date,
    panelSelectionMode?: PanelSelectionMode
  ) => Promise<void>;
};

export const TimetableContext = createContext<TimetableContextType | null>(null);

export const useTimetableContext = () => {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error('useTimetableContext must be used within a TimetableContext provider');
  }
  return context;
};
