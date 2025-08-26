import { useCallback, useMemo, useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { isString, uniq } from 'lodash';
import { useTranslation } from 'react-i18next';
import { GiElectric, GiUnplugged } from 'react-icons/gi';
import { MdSpeed } from 'react-icons/md';
import { TbRectangleVerticalFilled } from 'react-icons/tb';

import bufferStopIcon from 'assets/pictures/layersicons/bufferstop.svg';
import detectorsIcon from 'assets/pictures/layersicons/detectors.svg';
import signalsIcon from 'assets/pictures/layersicons/layer_signal.svg';
import pslsIcon from 'assets/pictures/layersicons/layer_tivs.svg';
import OPsSVGFile from 'assets/pictures/layersicons/ops.svg';
import switchesIcon from 'assets/pictures/layersicons/switches.svg';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Modal } from 'common/BootstrapSNCF/ModalSNCF';
import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import MapSettingsBackgroundSwitches from 'common/Map/Settings/MapSettingsBackgroundSwitches';
import { Icon2SVG } from 'common/Map/Settings/MapSettingsLayers';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';
import { useInfraID } from 'common/osrdContext';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { LayersSettings } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';

const LAYERS = [
  { layer: 'signals', icon: signalsIcon },
  { layer: 'buffer_stops', icon: bufferStopIcon },
  { layer: 'detectors', icon: detectorsIcon },
  { layer: 'switches', icon: switchesIcon },
  { layer: 'sncf_psl', icon: pslsIcon },
  { layer: 'electrifications', icon: <GiElectric className="mx-2" style={{ width: '20px' }} /> },
  { layer: 'neutral_sections', icon: <GiUnplugged className="mx-2" style={{ width: '20px' }} /> },
  {
    layer: 'platforms',
    icon: <TbRectangleVerticalFilled className="mx-2" style={{ width: '20px' }} />,
  },
  {
    layer: 'operational_points',
    icon: <Icon2SVG file={OPsSVGFile} style={{ width: '20px' }} className="mx-2" />,
  },
  { layer: 'speed_limits', icon: <MdSpeed style={{ width: '20px' }} className="mx-2" /> },
];

type LayersModalProps = {
  compactModal: boolean;
  closePortalModal?: () => void;
};

const LayersModal = ({ compactModal, closePortalModal }: LayersModalProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const mapSettings = useMapSettings();
  const { layersSettings, mapStyle } = mapSettings;
  const [selectedLayers, setSelectedLayers] = useState<LayersSettings>(layersSettings);
  const { updateLayersSettings } = useMapSettingsActions();

  const infraID = useInfraID();

  const { data: speedLimitTagsByInfraId } =
    osrdEditoastApi.endpoints.getInfraByInfraIdSpeedLimitTags.useQuery(
      infraID ? { infraId: infraID } : skipToken
    );
  const DEFAULT_SPEED_LIMIT_TAG = useMemo(() => t('Editor.layers-modal.noSpeedLimitByTag'), [t]);

  const speedLimitOptions = useMemo(() => {
    const allSpeedLimitTags = uniq(speedLimitTagsByInfraId).sort();
    return [t('Editor.layers-modal.noSpeedLimitByTag'), ...allSpeedLimitTags];
  }, [t, speedLimitTagsByInfraId]);

  const toggleLayer = useCallback(
    (layer: keyof LayersSettings) => {
      const isEnabled = !selectedLayers[layer];

      const updatedLayers = {
        ...selectedLayers,
        [layer]: isEnabled,
      };

      setSelectedLayers(updatedLayers);
      dispatch(updateLayersSettings(updatedLayers));
    },
    [selectedLayers, dispatch, updateLayersSettings]
  );

  return (
    <Modal title={t('Editor.nav.toggle-layers')} closePortalModal={closePortalModal}>
      <div className="container-fluid mb-3">
        <div>
          <h4>{t('Editor.nav.osrd-layers')}</h4>
        </div>
        <div className="row">
          {LAYERS.map(({ layer, icon }) => (
            <div className="col-lg-6" key={`${layer}`}>
              <div className="d-flex align-items-center mt-2">
                <SwitchSNCF
                  type="switch"
                  checked={!!selectedLayers[layer as keyof LayersSettings]}
                  onChange={() => toggleLayer(layer as keyof LayersSettings)}
                  name={`editor-layer-${layer}`}
                  id={`editor-layer-${layer}`}
                />
                {isString(icon) ? (
                  <img className="layer-modal-img mx-2" src={icon} alt="" />
                ) : (
                  <div>{icon}</div>
                )}
                <div className="d-flex flex-column">
                  <div>{t(`Editor.layers.${layer}`)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <hr />
        <div>
          <h4>{t('Editor.nav.speed-limits')}</h4>
          <select
            id="speedLimitTag"
            className="form-control"
            disabled={!selectedLayers.speed_limits}
            value={selectedLayers.speedlimittag || DEFAULT_SPEED_LIMIT_TAG}
            onChange={(e) => {
              const newTag = e.target.value !== DEFAULT_SPEED_LIMIT_TAG ? e.target.value : null;
              const newLayers = { ...selectedLayers, speedlimittag: newTag };
              dispatch(updateLayersSettings(newLayers));
              setSelectedLayers(newLayers);
            }}
          >
            {speedLimitOptions.map((tag) => (
              <option value={tag} key={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <hr />
        {!compactModal && (
          <>
            <MapSettingsMapStyle mapStyle={mapStyle} />
            <MapSettingsBackgroundSwitches mapSettings={mapSettings} />
          </>
        )}
      </div>
    </Modal>
  );
};

export default LayersModal;
