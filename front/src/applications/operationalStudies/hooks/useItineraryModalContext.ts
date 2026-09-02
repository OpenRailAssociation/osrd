import { createContext, useContext } from 'react';

import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';

/**
 * Data of the train schedule that will be edited by the ItineraryModal.
 *
 * If it's an occurrence, also carries the parent paced train the occurrence is
 * derived from, and its occurrence ID.
 */
export type TrainScheduleToEditData = {
  trainSchedule: TrainScheduleWithDetails;
  parentPacedTrain?: TrainScheduleWithDetails;
  occurrenceId?: OccurrenceId;
};

/**
 * Context that allows components to open or close the itinerary modal on a specific
 * train schedule or occurrence to edit, or a blank one to create a new train.
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
