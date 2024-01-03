import { MapProps } from 'react-map-gl/maplibre';
import { MAIN_API } from 'config/config';
import { useMemo } from 'react';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

export const useMapBlankStyle = (): MapProps['mapStyle'] => {
  const baseURL = MAIN_API.proxy_editoast;

  const { data: signalingSystems } =
    osrdEditoastApi.endpoints.getSpritesSignalingSystems.useQuery();

  const props = useMemo(() => {
    const sprite = signalingSystems
      ? [
          { url: 'https://static.osm.osrd.fr/sprites/sprites', id: 'default' },
          ...signalingSystems.map((id) => ({
            url: `${window.location.origin}${baseURL}/sprites/${id}/sprites`,
            id,
          })),
        ]
      : [];
    return {
      version: 8,
      name: 'Blank',
      sources: {},
      sprite,
      glyphs: 'https://static.osm.osrd.fr/fonts/{fontstack}/{range}.pbf',
      layers: [
        {
          id: 'emptyBackground',
          type: 'background',
          layout: {
            visibility: 'visible',
          },
        },
      ],
    } as MapProps['mapStyle'];
  }, [signalingSystems]);

  return props;
};

export default useMapBlankStyle;
