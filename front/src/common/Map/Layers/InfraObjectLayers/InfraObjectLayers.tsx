import type { Geometry } from 'geojson';

import { colors } from 'common/Map/theme';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { LayersSettings, MapStyle } from 'reducers/commonMap/types';

import BufferStops from './BufferStops';
import Detectors from './Detectors';
import Electrifications from './Electrifications';
import NeutralSections from './extensions/SNCF/NeutralSections';
import SNCF_PSL from './extensions/SNCF/PSL';
import LevelCrossingsLayer from './LevelCrossing';
import OperationalPoints from './OperationalPoints';
import Routes from './Routes';
import Signals from './Signals';
import SpeedLimits from './SpeedLimits';
import Switches from './Switches';
import TracksGeographic from './TracksGeographic';

type InfraObjectLayersProps = {
  mapStyle: MapStyle;
  hoveredOperationalPointId?: string;
  layersSettings: LayersSettings;
  highlightedArea?: Geometry;
};

const InfraObjectLayers = ({
  mapStyle,
  hoveredOperationalPointId,
  layersSettings,
  highlightedArea,
}: InfraObjectLayersProps) => (
  <>
    <TracksGeographic
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS.GROUP]}
      highlightedArea={highlightedArea}
    />
    {layersSettings.routes && (
      <Routes
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.ROUTES.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.operational_points && (
      <OperationalPoints
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
        operationnalPointId={hoveredOperationalPointId}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.electrifications && (
      <Electrifications
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.ELECTRIFICATIONS.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.neutral_sections && (
      <NeutralSections
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.NEUTRAL_SECTIONS.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.buffer_stops && (
      <BufferStops
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.BUFFER_STOPS.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.detectors && (
      <Detectors
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.DETECTORS.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.switches && (
      <Switches
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.SWITCHES.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.speed_limits && (
      <SpeedLimits
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
        punctualLayerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS_PUNCTUAL.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.sncf_psl && (
      <SNCF_PSL
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
        punctualLayerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS_PUNCTUAL.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.signals && (
      <Signals
        sourceTable="signals"
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.level_crossings && (
      <LevelCrossingsLayer
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.LEVEL_CROSSINGS.GROUP]}
        highlightedArea={highlightedArea}
      />
    )}
  </>
);
export default InfraObjectLayers;
