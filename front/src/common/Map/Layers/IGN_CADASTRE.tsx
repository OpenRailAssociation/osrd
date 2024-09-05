import { Source, type LayerProps } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { RootState } from 'reducers';

interface IGN_Cadastre_Props {
  layerOrder?: number;
}

const IGN_Cadastre_Params: LayerProps = {
  source: 'orthophoto',
  type: 'raster',
  paint: {
    'raster-resampling': 'linear',
    'raster-opacity': 0.75,
    'raster-hue-rotate': 0,
    'raster-fade-duration': 0,
  },
};

export default function IGN_CADASTRE(props: IGN_Cadastre_Props) {
  const { layerOrder } = props;
  const { showIGNCadastre } = useSelector((state: RootState) => state.map);

  if (!showIGNCadastre) return null;
  return (
    <Source
      id="igncadastre"
      type="raster"
      tiles={[
        'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      ]}
      tileSize={256}
      attribution="© IGN"
    >
      <OrderedLayer {...IGN_Cadastre_Params} layerOrder={layerOrder} />
    </Source>
  );
}
