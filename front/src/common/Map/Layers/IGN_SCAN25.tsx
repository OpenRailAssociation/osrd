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
        /**
         * WARNING: When new IGN's authorization system will be available (current 2024), we'll have to get a dedicated token to use this endpoint
         * https://geoservices.ign.fr/actualites/2023-11-20-acces-donnesnonlibres-gpf
         */
        'https://data.geopf.fr/private/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&apikey=ign_scan_ws&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      ]}
      tileSize={256}
      attribution="© IGN"
    >
      <OrderedLayer {...IGN_SCAN25_Params} layerOrder={layerOrder} />
    </Source>
  );
}
