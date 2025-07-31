import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

import IGN_BD_ORTHO from './IGN_BD_ORTHO';
import IGN_CADASTRE from './IGN_CADASTRE';
import IGN_SCAN25 from './IGN_SCAN25';

const IGNLayers = ({
  showIGNBDORTHO,
  showIGNSCAN25,
  showIGNCadastre,
}: {
  showIGNBDORTHO: boolean;
  showIGNSCAN25: boolean;
  showIGNCadastre: boolean;
}) => (
  <>
    <IGN_BD_ORTHO
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
      showIGNBDORTHO={showIGNBDORTHO}
    />
    <IGN_SCAN25
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
      showIGNSCAN25={showIGNSCAN25}
    />
    <IGN_CADASTRE
      layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
      showIGNCadastre={showIGNCadastre}
    />
  </>
);

export default IGNLayers;
