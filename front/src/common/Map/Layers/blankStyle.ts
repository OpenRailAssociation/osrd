import { MapProps } from 'react-map-gl/maplibre';
import { MAIN_API } from 'config/config';
import { useEffect, useMemo, useState } from 'react';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

type Sprite = { url: string; id: string };

const isValidUrl = async (url: string) => {
  const checkValidity = async (extension: string) => {
    try {
      const response = await fetch(`${url}.${extension}`);
      return response.ok;
    } catch (error) {
      return false;
    }
  };
  return (await checkValidity('json')) && checkValidity('png');
};

export const useMapBlankStyle = (): MapProps['mapStyle'] => {
  const baseURL = MAIN_API.proxy_editoast;

  const { data: signalingSystems } =
    osrdEditoastApi.endpoints.getSpritesSignalingSystems.useQuery();

  const getSpriteData = async () => {
    if (!signalingSystems) return [];

    const ponctualObjectsSprites: Sprite = {
      url: 'https://static.osm.osrd.fr/sprites/sprites',
      id: 'default',
    };
    const isDefaultSpriteValid = await isValidUrl(ponctualObjectsSprites.url);

    const sprites: (Sprite | null)[] = await Promise.all([
      isDefaultSpriteValid ? ponctualObjectsSprites : null,
      ...signalingSystems.map(async (id) => {
        const signalingSystemsURL = `${window.location.origin}${baseURL}/sprites/${id}/sprites`;
        const isValid = await isValidUrl(signalingSystemsURL);
        return isValid ? { url: signalingSystemsURL, id } : null;
      }),
    ]);

    return sprites.filter((sprite) => sprite !== null) as Sprite[];
  };

  const [validSprites, setValidSprites] = useState<Sprite[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (signalingSystems) {
        const spriteData = await getSpriteData();
        setValidSprites(spriteData);
      }
    };
    fetchData();
  }, [signalingSystems]);

  const props = useMemo(() => {
    const sprite = validSprites;
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
  }, [validSprites]);

  return props;
};

export default useMapBlankStyle;
