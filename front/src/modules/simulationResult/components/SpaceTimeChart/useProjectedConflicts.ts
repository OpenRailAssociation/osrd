import { useEffect, useState, useMemo } from 'react';

import { formatDatetimeForSpaceTimeChart } from 'applications/operationalStudies/helpers/upsertNewProjectedTrains';
import type {
  Conflict,
  PathProperties,
  PathfindingResultSuccess,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

const useProjectedConflicts = (
  infraId: number | undefined,
  conflicts: Conflict[],
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

  const conflictReqsByZone = useMemo(() => {
    const reqs = conflicts.flatMap((conflict) => conflict.requirements);
    return new Map(reqs.map((req) => [req.zone, req]));
  }, [conflicts]);

  const conflictZones = useMemo(() => {
    if (!projectedZones) {
      return [];
    }

    const boundaries = [0, ...projectedZones.boundaries, path!.length];
    return projectedZones.values.flatMap((zone, index) => {
      const req = conflictReqsByZone.get(zone);
      if (!req) {
        return [];
      }

      return [
        {
          timeStart: +new Date(formatDatetimeForSpaceTimeChart(req.start_time)),
          timeEnd: +new Date(formatDatetimeForSpaceTimeChart(req.end_time)),
          spaceStart: boundaries[index],
          spaceEnd: boundaries[index + 1],
        },
      ];
    });
  }, [conflictReqsByZone, projectedZones]);

  return conflictZones;
};

export default useProjectedConflicts;
