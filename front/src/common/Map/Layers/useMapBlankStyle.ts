import { useEffect, useMemo, useState } from 'react';

import type { MapProps } from 'react-map-gl/maplibre';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { SPRITES_URL, FONTS_URL } from 'common/Map/const';

type Sprite = { url: string; id: string };

const isValidUrl = async (url: string) => {
  const checkValidity = async (extension: string) => {
    try {
      const response = await fetch(`${url}.${extension}`);
      return response.ok;
    } catch (error) {
      console.error(error);
      return false;
    }
  };
  return (await checkValidity('json')) && checkValidity('png');
};

const useMapBlankStyle = (): MapProps['mapStyle'] => {
  const { data: signalingSystems } =
    osrdEditoastApi.endpoints.getSpritesSignalingSystems.useQuery();

  const getSpriteData = async () => {
    if (!signalingSystems) return [];

    const ponctualObjectsSprites: Sprite = {
      url: `${SPRITES_URL}/default/sprites`,
      id: 'default',
    };
    const isDefaultSpriteValid = await isValidUrl(ponctualObjectsSprites.url);

    const sprites: (Sprite | null)[] = await Promise.all([
      isDefaultSpriteValid ? ponctualObjectsSprites : null,
      ...signalingSystems.map(async (id) => {
        const signalingSystemsURL = `${SPRITES_URL}/${id}/sprites`;
        const isValid = await isValidUrl(signalingSystemsURL);
        return isValid ? { url: signalingSystemsURL, id } : null;
      }),
    ]);

    return sprites.filter((sprite) => sprite !== null);
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
      glyphs: `${FONTS_URL}/{fontstack}/{range}.pbf`,
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
