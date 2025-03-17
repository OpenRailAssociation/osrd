import colors from 'common/Map/Consts/colors';
import OpenStreetMapSource from 'common/Map/Sources/OpenStreetMap';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { MapStyle } from 'reducers/map';

import Background from '../Background';
import Hillshade from '../Hillshade';
import OSM from '../OSM';
import PlatformsLayer from '../Platforms';
import Terrain from '../Terrain';
import TracksOSM from '../TracksOSM';

type OSMLayersProps = {
  mapStyle: MapStyle;
  showOSM: boolean;
  hidePlatforms?: boolean;
};

const OSMLayers = ({ mapStyle, showOSM, hidePlatforms }: OSMLayersProps) => (
  <>
    <OpenStreetMapSource />
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

    <Terrain />

    <TracksOSM colors={colors[mapStyle]} layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_OSM.GROUP]} />

    {!showOSM ? null : (
      <>
        <OSM mapStyle={mapStyle} layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
        <Hillshade mapStyle={mapStyle} layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
      </>
    )}
  </>
);

export default OSMLayers;
