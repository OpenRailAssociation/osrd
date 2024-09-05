import { Source, type LayerProps } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { RootState } from 'reducers';

interface IGN_BD_ORTHO_Props {
  layerOrder?: number;
}

export default function IGN_BD_ORTHO(props: IGN_BD_ORTHO_Props) {
  const { layerOrder } = props;
  const { showIGNBDORTHO } = useSelector((state: RootState) => state.map);

  const IGN_BD_ORTHO_Params: LayerProps = {
    source: 'orthophoto',
    type: 'raster',
    paint: {
      'raster-resampling': 'linear',
      'raster-opacity': 1,
      'raster-hue-rotate': 0,
      'raster-fade-duration': 0,
      'raster-contrast': 0.35,
      'raster-brightness-max': 1,
      'raster-brightness-min': 0.15,
    },
  };

  if (!showIGNBDORTHO) return null;
  return (
    <Source
      id="ignbdortho"
      type="raster"
      tiles={[
        'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      ]}
      tileSize={256}
      attribution="© IGN"
    >
      <OrderedLayer {...IGN_BD_ORTHO_Params} layerOrder={layerOrder} />
    </Source>
  );
}
