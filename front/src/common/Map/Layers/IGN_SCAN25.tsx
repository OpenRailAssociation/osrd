import React from 'react';

import { Source, type LayerProps } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { RootState } from 'reducers';

interface IGN_SCAN25_Props {
  layerOrder?: number;
}

export default function IGN_SCAN25(props: IGN_SCAN25_Props) {
  const { layerOrder } = props;
  const { showIGNSCAN25 } = useSelector((state: RootState) => state.map);

  const IGN_SCAN25_Params: LayerProps = {
    source: 'orthophoto',
    type: 'raster',
    paint: {
      'raster-resampling': 'linear',
      'raster-opacity': 0.75,
      'raster-hue-rotate': 0,
      'raster-fade-duration': 0,
    },
  };

  if (!showIGNSCAN25) return null;
  return (
    <Source
      id="ignscan25"
      type="raster"
      tiles={[
        // 'https://wxs.ign.fr/d2lkke4ru7ermncm52c97k51/geoportail/r/wms?bbox={bbox-epsg-3857}&styles=normal&SERVICE=WMS&VERSION=1.3.0&format=image/jpeg&service=WMS&REQUEST=GetMap&CRS=EPSG:3857&width=256&height=256&layers=SCAN25TOUR_PYR-JPEG_WLD_WM',
        'https://wxs.ign.fr/d2lkke4ru7ermncm52c97k51/geoportail/r/wms?bbox={bbox-epsg-3857}&styles=normal&SERVICE=WMS&VERSION=1.3.0&format=image/jpeg&service=WMS&REQUEST=GetMap&CRS=EPSG:3857&width=256&height=256&layers=GEOGRAPHICALGRIDSYSTEMS.MAPS',
      ]}
      tileSize={256}
    >
      <OrderedLayer {...IGN_SCAN25_Params} layerOrder={layerOrder} />
    </Source>
  );
}
