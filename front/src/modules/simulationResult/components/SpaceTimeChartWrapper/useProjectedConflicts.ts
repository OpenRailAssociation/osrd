import { useEffect, useState, useMemo } from 'react';

import type {
  Conflict,
  ConflictRequirement,
  PathProperties,
  PathfindingResultSuccess,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

const useProjectedConflicts = (
  infraId: number,
  conflicts: Conflict[],
  path: PathfindingResultSuccess | undefined
) => {
  const [postPathProperties] =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useLazyQuery();

  const [projectedZones, setProjectedZones] = useState<PathProperties['zones']>();
  useEffect(() => {
    const fetchProjectedZones = async ({
      path: { track_section_ranges },
    }: PathfindingResultSuccess) => {
      const { zones } = await postPathProperties({
        infraId,
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
    const reqsMap = new Map<string, ConflictRequirement[]>();
    // With paced trains, one zone can appear multiple times so we need to handle that.
    reqs.forEach((req) => {
      if (!reqsMap.has(req.zone)) {
        reqsMap.set(req.zone, []);
      }
      reqsMap.get(req.zone)!.push(req);
    });
    return reqsMap;
  }, [conflicts]);

  const conflictZones = useMemo(() => {
    if (!projectedZones || !path) {
      return [];
    }

    const boundaries = [0, ...projectedZones.boundaries, path.length];
    return projectedZones.values.flatMap((zone, index) => {
      const reqs = conflictReqsByZone.get(zone);
      if (!reqs || reqs.length === 0) {
        return [];
      }

      return reqs.map((req) => ({
        timeStart: +new Date(req.start_time),
        timeEnd: +new Date(req.end_time),
        spaceStart: boundaries[index],
        spaceEnd: boundaries[index + 1],
      }));
    });
  }, [conflictReqsByZone, projectedZones, path]);

  return conflictZones;
};

export default useProjectedConflicts;
