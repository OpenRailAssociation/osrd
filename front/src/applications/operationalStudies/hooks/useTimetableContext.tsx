import {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';

import { keyBy, sortBy } from 'lodash';

import { computeShiftedExceptions } from 'applications/operationalStudies/utils';
import {
  osrdEditoastApi,
  type TrainSchedule,
  type TrainScheduleResponse,
  type PacedTrainException,
} from 'common/api/osrdEditoastApi';
import type { PanelSelectionMode } from 'modules/simulationResult/components/SpaceTimeChartWrapper/CurveSelectionSidePanel';
import { withPacedExceptions } from 'modules/trainSchedule/helpers/pacedTrain';
import { useAppDispatch } from 'store';
import { mapBy } from 'utils/types';

function upsertAndSort(
  prev: TrainScheduleResponse[] | undefined,
  updates: TrainScheduleResponse | TrainScheduleResponse[]
): TrainScheduleResponse[] {
  const arr = Array.isArray(updates) ? updates : [updates];
  return sortBy(Object.values({ ...keyBy(prev, 'id'), ...keyBy(arr, 'id') }), 'start_time');
}

type TimetableContextType = {
  trainSchedules: TrainSchedule[] | undefined;
  trainSchedulesById: Map<number, TrainSchedule>;
  removeTrainSchedules: (ids: number[]) => void;
  upsertTrainSchedules: (newTrainSchedules: TrainScheduleResponse[]) => void;
  setTrainScheduleDepartureTime: (
    id: number,
    departureTime: Date,
    panelSelectionMode?: PanelSelectionMode
  ) => void;
};

const TimetableContext = createContext<TimetableContextType | null>(null);

type TimetableContextProviderProps = {
  timetableId: number;
  onRemoveTrainSchedules: (ids: number[]) => void;
  onUpsertTrainSchedules: (newTrainSchedules: TrainScheduleResponse[]) => void;
  onSetTrainScheduleDepartureTime: (
    id: number,
    departureTime: Date,
    newExceptions: PacedTrainException[] | undefined
  ) => void;
  children: ReactNode;
};

export const TimetableContextProvider = ({
  timetableId,
  onRemoveTrainSchedules,
  onUpsertTrainSchedules,
  onSetTrainScheduleDepartureTime,
  children,
}: TimetableContextProviderProps) => {
  const dispatch = useAppDispatch();

  const [trainSchedules, setTrainSchedules] = useState<TrainScheduleResponse[]>();
  const trainSchedulesById = useMemo(() => mapBy(trainSchedules, 'id'), [trainSchedules]);

  useEffect(() => {
    const pacedTrainsResult = dispatch(
      osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.initiate({
        timetableId,
      })
    );

    const fetchTrainSchedules = async () => {
      const pacedTrains = (await pacedTrainsResult.unwrap()) ?? [];

      setTrainSchedules(sortBy(pacedTrains, 'start_time'));
    };

    fetchTrainSchedules();

    return () => {
      pacedTrainsResult.unsubscribe();
    };
  }, [timetableId]);

  const removeTrainSchedules = useCallback(
    (ids: number[]) => {
      setTrainSchedules((prev) => {
        const prevTrainSchedulesById = mapBy(prev, 'id');
        ids.forEach((trainScheduleId) => {
          prevTrainSchedulesById.delete(trainScheduleId);
        });
        return Array.from(prevTrainSchedulesById.values());
      });

      onRemoveTrainSchedules(ids);
    },
    [onRemoveTrainSchedules]
  );

  const upsertTrainSchedules = useCallback(
    (newTrainSchedules: TrainScheduleResponse[]) => {
      setTrainSchedules((prev) => upsertAndSort(prev, newTrainSchedules));
      onUpsertTrainSchedules(newTrainSchedules);
    },
    [onUpsertTrainSchedules]
  );

  const setTrainScheduleDepartureTime = useCallback(
    (trainScheduleId: number, newDeparture: Date, panelSelectionMode?: PanelSelectionMode) => {
      const trainSchedule = trainSchedules?.find((train) => train.id === trainScheduleId);
      const shiftedExceptions = trainSchedule
        ? computeShiftedExceptions(trainSchedule, newDeparture, panelSelectionMode)
        : undefined;

      setTrainSchedules((prev) => {
        const prevTrainSchedule = prev?.find((train) => train.id === trainScheduleId);
        if (!prevTrainSchedule) {
          return prev;
        }
        const updatedTrainSchedule = withPacedExceptions(
          { ...prevTrainSchedule, start_time: newDeparture.getTime() },
          shiftedExceptions
        );
        return upsertAndSort(prev, updatedTrainSchedule);
      });

      onSetTrainScheduleDepartureTime(trainScheduleId, newDeparture, shiftedExceptions);
    },
    [trainSchedules]
  );

  const context = useMemo(
    (): TimetableContextType => ({
      trainSchedules,
      trainSchedulesById,
      removeTrainSchedules,
      upsertTrainSchedules,
      setTrainScheduleDepartureTime,
    }),
    [
      trainSchedules,
      trainSchedulesById,
      removeTrainSchedules,
      upsertTrainSchedules,
      setTrainScheduleDepartureTime,
    ]
  );

  return <TimetableContext.Provider value={context}>{children}</TimetableContext.Provider>;
};

export const useTimetableContext = () => {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error('useTimetableContext must be used within a TimetableContextProvider');
  }
  return context;
};
