import OpenStreetMapSource from 'common/Map/Sources/OpenStreetMap';
import TerrainSource from 'common/Map/Sources/Terrain';
import { colors } from 'common/Map/theme';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { MapStyle } from 'reducers/commonMap/types';

import Background from './Background';
import Hillshade from '../Hillshade';
import OSM from './OSM';
import PlatformsLayer from './Platforms';
import TracksOSM from './TracksOSM';

type OSMLayersProps = {
  mapStyle: MapStyle;
  showOSM: boolean;
  showOSM3dBuildings: boolean;
  showOSMtracksections: boolean;
  hidePlatforms: boolean;
};

const OSMLayers = ({
  mapStyle,
  showOSM,
  showOSM3dBuildings,
  showOSMtracksections,
  hidePlatforms,
}: OSMLayersProps) => (
  <>
    <OpenStreetMapSource />
    <TerrainSource />

    <Background
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
    />

    {!hidePlatforms && (
      <PlatformsLayer
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]}
      />
    )}

    <TracksOSM
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_OSM.GROUP]}
      showOSMtracksections={showOSMtracksections}
    />

    {!showOSM ? null : (
      <>
        <OSM
          mapStyle={mapStyle}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
          showOSM3dBuildings={showOSM3dBuildings}
        />
        <Hillshade mapStyle={mapStyle} layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
      </>
    )}
  </>
);

export default OSMLayers;
