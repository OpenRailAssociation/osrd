import { useEffect, useState, useMemo } from 'react';

import { formatDatetimeForSpaceTimeChart } from 'applications/operationalStudies/helpers/upsertNewProjectedTrains';
import type {
  ProjectPathTrainResult,
  PathProperties,
  PathfindingResultSuccess,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

const useProjectedOccupancyBlocks = (
  infraId: number | undefined,
  occupancyblocks: ProjectPathTrainResult[],
  path: PathfindingResultSuccess | undefined
) => {
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useMutation();

  const [projectedZones, setProjectedZones] = useState<PathProperties['zones']>();
  useEffect(() => {
    const fetchProjectedZones = async ({ track_section_ranges }: PathfindingResultSuccess) => {
      const { zones } = await postPathProperties({
        infraId: infraId!,
        props: ['zones'],
        pathPropertiesInput: {
          track_section_ranges,
        },
      }).unwrap();
      setProjectedZones(zones);
    };

    setProjectedZones(undefined);
    if (path) {
      fetchProjectedZones(path);
    }
  }, [path]);

  const occupancyblockReqsByZone = useMemo(() => {
    const reqs = occupancyblocks.flatMap((occupancyblock) => occupancyblock.signal_updates);
    return new Map(reqs.map((req) => [req.aspect_label, req]));
  }, [occupancyblocks]);

  const occupancyblockZone = useMemo(() => {
    if (!projectedZones) {
      return [];
    }

    const color = occupancyblocks.flatMap((occupancyblock) =>
      occupancyblock.signal_updates.map((signal) => signal.color)
    );

    const boundaries = [0, ...projectedZones.boundaries, path!.length];
    return projectedZones.values.flatMap((zone, index) => {
      const req = occupancyblockReqsByZone.get(zone);
      if (!req) {
        return [];
      }

      return [
        {
          timeStart: +new Date(formatDatetimeForSpaceTimeChart(req.time_start.toString())),
          timeEnd: +new Date(formatDatetimeForSpaceTimeChart(req.time_end.toString())),
          spaceStart: boundaries[index],
          spaceEnd: boundaries[index + 1],
          color,
        },
      ];
    });
  }, [occupancyblockReqsByZone, projectedZones]);

  return occupancyblockZone;
};

export default useProjectedOccupancyBlocks;
