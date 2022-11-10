import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { RootState } from 'reducers';

interface OrthoPhotoProps {
  layerOrder?: number;
}

export default function OrthoPhoto(props: OrthoPhotoProps) {
  const { layerOrder } = props;
  const { showOrthoPhoto } = useSelector((state: RootState) => state.map);

  const orthoPhotoParams: LayerProps = {
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

  return showOrthoPhoto ? (
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
  ) : null;
}
