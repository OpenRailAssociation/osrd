import { useEffect } from 'react';

import bbox from '@turf/bbox';
import { useMap } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { getActivePerimeter } from 'reducers/osrdconf/stdcmConf/selectors';

export default () => {
  const map = useMap();
  const activePerimeter = useSelector(getActivePerimeter);

  useEffect(() => {
    if (activePerimeter) {
      const area = bbox(activePerimeter) as [number, number, number, number];
      map.current?.fitBounds(area, { padding: 50 });
    }
  }, [map, activePerimeter]);

  return null;
};
