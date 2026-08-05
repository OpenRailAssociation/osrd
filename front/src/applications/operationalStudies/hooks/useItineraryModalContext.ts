import { createContext, useContext } from 'react';

import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';

export type TrainScheduleToEditData = {
  trainScheduleId: number;
  originalTrainSchedule: TrainScheduleWithDetails;
  occurrenceId?: OccurrenceId;
};

/**
 * ItineraryModalContextType holds data relevant to open or close the itinerary modal
 * on the right train schedule or occurrence to edit.
 */
export type ItineraryModalContextType = {
  openItineraryModalToCreate: () => void;
  openItineraryModalToEdit: (editData: TrainScheduleToEditData) => void;
  closeItineraryModal: () => void;
  isItineraryModalOpen: boolean;
  trainScheduleToEditData?: TrainScheduleToEditData;
};

export const ItineraryModalContext = createContext<ItineraryModalContextType | null>(null);

export const useItineraryModalContext = () => {
  const context = useContext(ItineraryModalContext);
  if (!context) {
    throw new Error(
      'useItineraryModalContext must be used within a ItineraryModalContext provider'
    );
  }
  return context;
};
