import { useCallback } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import { useAppDispatch } from 'store';

/**
 * Returns a function centering the map viewport of the current context on the given infra.
 */
export default function useFitViewportToInfra() {
  const dispatch = useAppDispatch();
  const { updateViewport } = useMapSettingsActions();
  const { viewport } = useMapSettings();
  const [getInfraBbox] = osrdEditoastApi.endpoints.getInfraByInfraIdBbox.useLazyQuery();

  return useCallback(
    async (infraId: number) => {
      const { data: infraBbox } = await getInfraBbox({ infraId });
      if (!infraBbox) return;

      const { min_lat, min_lon, max_lat, max_lon } = infraBbox;
      const newViewport = computeBBoxViewport([min_lon, min_lat, max_lon, max_lat], viewport, {
        padding: 64,
      });
      dispatch(updateViewport(newViewport));
    },
    [getInfraBbox, viewport, dispatch, updateViewport]
  );
}
