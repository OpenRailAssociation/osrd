import colors from 'common/Map/Consts/colors';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

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
  mapStyle: 'normal' | 'dark' | 'blueprint' | 'minimal';
  hoveredOperationalPointId?: string;
};

const InfraObjectLayers = ({
  infraId,
  mapStyle,
  hoveredOperationalPointId,
}: InfraObjectLayersProps) => (
  <>
    <TracksGeographic
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_GEOGRAPHIC.GROUP]}
      infraID={infraId}
    />

    <Routes
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.ROUTES.GROUP]}
      infraID={infraId}
    />

    <OperationalPoints
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
      operationnalPointId={hoveredOperationalPointId}
      infraID={infraId}
    />

    <Electrifications
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.ELECTRIFICATIONS.GROUP]}
      infraID={infraId}
    />

    <NeutralSections
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.DEAD_SECTIONS.GROUP]}
      infraID={infraId}
    />

    <BufferStops
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.BUFFER_STOPS.GROUP]}
      infraID={infraId}
    />

    <Detectors
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.DETECTORS.GROUP]}
      infraID={infraId}
    />

    <Switches
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.SWITCHES.GROUP]}
      infraID={infraId}
    />

    <SpeedLimits
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
      infraID={infraId}
    />

    <SNCF_PSL
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
      infraID={infraId}
    />

    <Signals
      sourceTable="signals"
      colors={colors[mapStyle]}
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
      infraID={infraId}
    />
  </>
);

export default InfraObjectLayers;
