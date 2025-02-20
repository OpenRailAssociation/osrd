import { useEffect, useMemo } from 'react';

import { useSelector } from 'react-redux';

import { getEntities } from 'applications/editor/data/api';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type { StdcmPathProperties, StdcmResponse } from 'applications/stdcm/types';
import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type PostInfraByInfraIdPathPropertiesApiArg,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import { formatSuggestedOperationalPoints } from 'modules/pathfinding/utils';
import useSpeedSpaceChart from 'modules/simulationResult/components/SpeedSpaceChart/useSpeedSpaceChart';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { TrainScheduleId } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { formatTrainScheduleIdToEditoastTrainId } from 'utils/trainId';

import { STDCM_TRAIN_ID } from '../consts';

const useStdcmResults = (
  stdcmResponse: StdcmResponse | undefined,
  stdcmTrainResult: TrainScheduleResult | undefined,
  setPathProperties: (pathProperties?: StdcmPathProperties) => void
) => {
  const infraId = useInfraID();
  const selectedTrainId = useSelector(getSelectedTrainId);
  const editoastSelectedTrainId = selectedTrainId
    ? formatTrainScheduleIdToEditoastTrainId(selectedTrainId as TrainScheduleId)
    : undefined;
  const dispatch = useAppDispatch();

  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  const { data: otherSelectedTrainSchedule } =
    osrdEditoastApi.endpoints.getTrainScheduleById.useQuery(
      { id: editoastSelectedTrainId! },
      { skip: !selectedTrainId || editoastSelectedTrainId === STDCM_TRAIN_ID }
    );

  const selectedTrainSchedule = useMemo(
    () =>
      editoastSelectedTrainId !== STDCM_TRAIN_ID && otherSelectedTrainSchedule
        ? otherSelectedTrainSchedule
        : stdcmTrainResult,
    [editoastSelectedTrainId, stdcmTrainResult, otherSelectedTrainSchedule]
  );

  const { simulation, departure_time: departureTime } =
    stdcmResponse?.status === 'success'
      ? stdcmResponse
      : { simulation: undefined, departure_time: undefined };

  const speedSpaceChartData = useSpeedSpaceChart(
    stdcmTrainResult,
    stdcmResponse?.path,
    simulation,
    departureTime
  );

  useEffect(() => {
    const getPathProperties = async (_infraId: number, path: PathfindingResultSuccess) => {
      const pathPropertiesParams: PostInfraByInfraIdPathPropertiesApiArg = {
        infraId: _infraId,
        props: ['geometry', 'operational_points', 'zones'],
        pathPropertiesInput: {
          track_section_ranges: path.track_section_ranges,
        },
      };
      const { geometry, operational_points, zones } =
        await postPathProperties(pathPropertiesParams).unwrap();
      if (!geometry || !operational_points || !zones || !infraId) return;

      const trackIds = operational_points.map((op) => op.part.track);
      const trackSections = await getEntities<TrackSectionEntity>(
        infraId,
        trackIds,
        'TrackSection',
        dispatch
      );
      const operationalPointsWithMetadata = operational_points.map((op) => {
        const associatedTrackSection = trackSections[op.part.track];
        const sncf = associatedTrackSection?.properties?.extensions?.sncf;

        const metadata =
          sncf && Object.values(sncf).every((value) => value !== undefined)
            ? {
                lineCode: sncf.line_code!,
                lineName: sncf.line_name!,
                trackName: sncf.track_name!,
                trackNumber: sncf.track_number!,
              }
            : undefined;

        return {
          ...op,
          metadata,
        };
      });

      const operationalPointsWithUniqueIds = operational_points.map((op, index) => ({
        ...op,
        id: `${op.id}-${op.position}-${index}`,
      }));

      const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
        operationalPointsWithMetadata, // Pass the operational points with metadata
        geometry,
        path.length
      );

      setPathProperties({
        manchetteOperationalPoints: operationalPointsWithUniqueIds,
        geometry,
        suggestedOperationalPoints,
        zones,
      });
    };

    if (infraId && stdcmResponse && stdcmResponse?.path) {
      getPathProperties(infraId, stdcmResponse.path);
    }
  }, [stdcmResponse]);

  if (!infraId || !stdcmResponse || !selectedTrainSchedule) return null;

  return {
    stdcmResponse,
    speedSpaceChartData,
  };
};

export default useStdcmResults;
