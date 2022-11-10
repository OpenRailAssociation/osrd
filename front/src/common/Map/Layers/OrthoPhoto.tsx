import React from 'react';
import { Source, LayerProps } from 'react-map-gl';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface OrthoPhotoProps {
  layerOrder?: number;
}

export default function OrthoPhoto(props: OrthoPhotoProps) {
  const { layerOrder } = props;

  const orthoPhotoParams: LayerProps = {
    source: 'orthophoto',
    type: 'raster',
    paint: {},
  };

  return (
    <Source
      id="orthophoto"
      type="raster"
      tiles={[
        'https://wxs.ign.fr/essentiels/geoportail/r/wms?bbox={bbox-epsg-3857}&styles=normal&SERVICE=WMS&VERSION=1.3.0&format=image/jpeg&service=WMS&REQUEST=GetMap&CRS=EPSG:3857&width=256&height=256&layers=ORTHOIMAGERY.ORTHOPHOTOS',
      ]}
      tileSize={256}
    >
      <OrderedLayer {...orthoPhotoParams} layerOrder={layerOrder} />
    </Source>
  );
}
