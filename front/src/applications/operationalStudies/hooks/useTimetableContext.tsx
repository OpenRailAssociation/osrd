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

import {
  osrdEditoastApi,
  type TrainSchedule,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { PanelSelectionMode } from 'modules/simulationResult/components/SpaceTimeChartWrapper/CurveSelectionSidePanel';
import type { TrainId } from 'reducers/osrdconf/types';
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
};

const TimetableContext = createContext<TimetableContextType | null>(null);

type TimetableContextProviderProps = {
  timetableId: number;
  onRemoveTrainSchedules: (ids: number[]) => void;
  onUpsertTrainSchedules: (newTrainSchedules: TrainScheduleResponse[]) => void;
  updateTrainsDepartureTime: (
    trainId: TrainId,
    departureTime: Date,
    panelSelectionMode?: PanelSelectionMode
  ) => Promise<TrainScheduleResponse>;
  children: ReactNode;
};

export const TimetableContextProvider = ({
  timetableId,
  onRemoveTrainSchedules,
  onUpsertTrainSchedules,
  updateTrainsDepartureTime,
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

  const updateTrainsDepartureTimeWithUpsert = useCallback(
    async (trainId: TrainId, departureTime: Date, panelSelectionMode?: PanelSelectionMode) => {
      const newTrainSchedule = await updateTrainsDepartureTime(
        trainId,
        departureTime,
        panelSelectionMode
      );
      setTrainSchedules((prev) => upsertAndSort(prev, [newTrainSchedule]));
    },
    [updateTrainsDepartureTime]
  );

  const context: TimetableContextType = useMemo(
    () => ({
      trainSchedules,
      trainSchedulesById,
      removeTrainSchedules,
      upsertTrainSchedules: updateTrainsDepartureTimeWithUpsert,
      updateTrainsDepartureTime,
    }),
    [
      trainSchedules,
      trainSchedulesById,
      removeTrainSchedules,
      upsertTrainSchedules,
      updateTrainsDepartureTimeWithUpsert,
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
