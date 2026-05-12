import { useRef, useCallback } from 'react';

import { uniq } from 'lodash';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrackSection } from 'common/api/osrdEditoastApi';

export default function useCachedTrackSections(infraId: number) {
  const trackIdsRef = useRef<Set<string>>(new Set());
  const trackSectionsRef = useRef<Record<string, TrackSection>>({});
  const [loadInfraObject, { isLoading }] =
    osrdEditoastApi.endpoints.postInfraByInfraIdObjectsAndObjectType.useLazyQuery();

  const getTrackSectionsByIds = useCallback(
    async (requestedTrackIds: string[]) => {
      const uniqueNewIds = uniq(requestedTrackIds.filter((id) => !trackIdsRef.current.has(id)));
      if (uniqueNewIds.length !== 0) {
        try {
          const fetchedSections = await loadInfraObject({
            infraId,
            objectType: 'TrackSection',
            body: uniqueNewIds,
          }).unwrap();

          uniqueNewIds.forEach((id) => trackIdsRef.current.add(id));
          fetchedSections.forEach((rawSection) => {
            const trackSection = rawSection.railjson as TrackSection;
            trackSectionsRef.current[trackSection.id] = trackSection;
          });
        } catch (error) {
          console.error('Failed to fetch track sections:', error);
        }
      }

      return { ...trackSectionsRef.current };
    },
    [infraId]
  );

  return { getTrackSectionsByIds, isLoading };
}
