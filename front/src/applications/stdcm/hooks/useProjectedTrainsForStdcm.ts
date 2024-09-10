import { useEffect, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';

import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { StdcmV2SuccessResponse } from 'applications/stdcm/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfSelectors } from 'common/osrdContext';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChart/useLazyProjectTrains';

import formatStdcmTrainIntoSpaceTimeData from '../utils/formatStdcmIntoSpaceTimeData';

const useProjectedTrainsForStdcm = (stdcmResponse?: StdcmV2SuccessResponse) => {
  const infraId = useInfraID();
  const { getTimetableID } = useOsrdConfSelectors();
  const timetableId = useSelector(getTimetableID);

  const [spaceTimeData, setSpaceTimeData] = useState<TrainSpaceTimeData[]>([]);
  const [trainIdsToProject, setTrainIdsToProject] = useState<number[]>([]);

  const { data: timetable } = osrdEditoastApi.endpoints.getTimetableById.useQuery(
    { id: timetableId! },
    {
      skip: !timetableId,
    }
  );

  const trainIds = timetable?.train_ids;
  const { currentData: trainSchedules } = osrdEditoastApi.endpoints.postTrainSchedule.useQuery(
    {
      body: {
        ids: trainIds!,
      },
    },
    {
      skip: !trainIds || !trainIds.length,
    }
  );

  const stdcmProjectedTrain = useMemo(
    () => (stdcmResponse ? formatStdcmTrainIntoSpaceTimeData(stdcmResponse) : undefined),
    [stdcmResponse]
  );

  const { projectedTrainsById: projectedTimetableTrainsById } = useLazyProjectTrains({
    infraId,
    trainIdsToProject,
    path: stdcmResponse?.path,
    trainSchedules,
    setTrainIdsToProject,
  });

  useEffect(() => {
    const projectedTimetableTrains = Array.from(projectedTimetableTrainsById.values());
    const newSpaceTimeData = projectedTimetableTrains.filter(
      (projectedTrain) => projectedTrain.space_time_curves.length > 0
    );

    if (stdcmProjectedTrain) {
      newSpaceTimeData.push(stdcmProjectedTrain);
    }

    setSpaceTimeData(newSpaceTimeData);
  }, [stdcmProjectedTrain, projectedTimetableTrainsById]);

  if (!infraId || !stdcmResponse) return null;

  return spaceTimeData;
};

export default useProjectedTrainsForStdcm;
