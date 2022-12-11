import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { RootState } from 'reducers';

interface IGN_Cadastre_Props {
  layerOrder?: number;
}

export default function IGN_CADASTRE(props: IGN_Cadastre_Props) {
  const { layerOrder } = props;
  const { showIGNCadastre } = useSelector((state: RootState) => state.map);

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

  return showIGNCadastre ? (
    <Source
      id="igncadastre"
      type="raster"
      tiles={[
        'https://wxs.ign.fr/essentiels/geoportail/r/wms?bbox={bbox-epsg-3857}&styles=normal&SERVICE=WMS&VERSION=1.3.0&format=image/jpeg&service=WMS&REQUEST=GetMap&CRS=EPSG:3857&width=256&height=256&layers=CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
      ]}
      tileSize={256}
    >
      <OrderedLayer {...IGN_Cadastre_Params} layerOrder={layerOrder} />
    </Source>
  ) : null;
}
