import { useCallback } from 'react';

import { point } from '@turf/helpers';

import { editoastToEditorEntity } from 'applications/editor/data/utils';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import { calculateDistanceAlongTrack } from 'applications/editor/tools/utils';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { PathItemLocation } from 'common/api/osrdEditoastApi';
import { mToMm } from 'utils/physics';

import type { FeatureInfoClick } from '../types';

const useMapTrackSelection = (infraId: number | undefined) => {
  const [getInfraObjectEntity] =
    osrdEditoastApi.endpoints.postInfraByInfraIdObjectsAndObjectType.useLazyQuery();

  const convertFeatureClickToLocation = useCallback(
    async (featureInfoClick: FeatureInfoClick): Promise<PathItemLocation | null> => {
      if (!infraId || featureInfoClick.isOperationalPoint) return null;

      const objectId = featureInfoClick.feature.properties?.id;
      if (!objectId) return null;

      try {
        const result = await getInfraObjectEntity({
          infraId,
          objectType: 'TrackSection',
          body: [objectId],
        }).unwrap();

        if (!result.length) return null;

        const trackEntity = editoastToEditorEntity<TrackSectionEntity>(result[0], 'TrackSection');
        const offset = mToMm(
          calculateDistanceAlongTrack(
            trackEntity,
            point(featureInfoClick.coordinates.slice(0, 2)).geometry
          )
        );

        return {
          type: 'track_offset',
          track: objectId,
          offset: Math.round(offset),
        };
      } catch (error) {
        // TODO: it could be nice to display the error with the rest below the form header
        console.error('Failed to convert feature click to track offset location:', error);
        return null;
      }
    },
    [infraId]
  );

  return { convertFeatureClickToLocation };
};

export default useMapTrackSelection;
