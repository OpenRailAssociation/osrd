import type { Geometry } from 'geojson';

import { colors } from 'common/Map/theme';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { LayersSettings, MapStyle } from 'reducers/commonMap/types';

import BufferStops from './BufferStops';
import Detectors from './Detectors';
import Electrifications from './Electrifications';
import NeutralSections from './extensions/SNCF/NeutralSections';
import SNCF_PSL from './extensions/SNCF/PSL';
import OperationalPoints from './OperationalPoints';
import Routes from './Routes';
import Signals from './Signals';
import SpeedLimits from './SpeedLimits';
import Switches from './Switches';
import TracksGeographic from './TracksGeographic';

type InfraObjectLayersProps = {
  infraId: number;
  mapStyle: MapStyle;
  hoveredOperationalPointId?: string;
  layersSettings: LayersSettings;
  highlightedArea?: Geometry;
  highlightedOperationalPoints?: number[];
};

const InfraObjectLayers = ({
  infraId,
  mapStyle,
  hoveredOperationalPointId,
  layersSettings,
  highlightedArea,
  highlightedOperationalPoints,
}: InfraObjectLayersProps) => (
  <>
    <TracksGeographic
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS.GROUP]}
      infraID={infraId}
      highlightedArea={highlightedArea}
    />
    {layersSettings.routes && (
      <Routes
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.ROUTES.GROUP]}
        infraID={infraId}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.operational_points && (
      <OperationalPoints
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
        operationnalPointId={hoveredOperationalPointId}
        infraID={infraId}
        highlightedArea={highlightedArea}
        highlightedOperationalPoints={highlightedOperationalPoints}
      />
    )}
    {layersSettings.electrifications && (
      <Electrifications
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.ELECTRIFICATIONS.GROUP]}
        infraID={infraId}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.neutral_sections && (
      <NeutralSections
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.NEUTRAL_SECTIONS.GROUP]}
        infraID={infraId}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.buffer_stops && (
      <BufferStops
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.BUFFER_STOPS.GROUP]}
        infraID={infraId}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.detectors && (
      <Detectors
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.DETECTORS.GROUP]}
        infraID={infraId}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.switches && (
      <Switches
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.SWITCHES.GROUP]}
        infraID={infraId}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.speed_limits && (
      <SpeedLimits
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
        punctualLayerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS_PUNCTUAL.GROUP]}
        infraID={infraId}
        layersSettings={layersSettings}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.sncf_psl && (
      <SNCF_PSL
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
        punctualLayerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS_PUNCTUAL.GROUP]}
        infraID={infraId}
        layersSettings={layersSettings}
        highlightedArea={highlightedArea}
      />
    )}
    {layersSettings.signals && (
      <Signals
        sourceTable="signals"
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
        infraID={infraId}
        highlightedArea={highlightedArea}
      />
    )}
  </>
);
export default InfraObjectLayers;
