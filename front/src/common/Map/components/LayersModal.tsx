import { useCallback, useMemo, useState } from 'react';

import { groupBy, isString, sum } from 'lodash';
import { useTranslation } from 'react-i18next';
import { GiElectric, GiUnplugged } from 'react-icons/gi';
import { MdSpeed } from 'react-icons/md';
import { TbRectangleVerticalFilled } from 'react-icons/tb';

import { EDITOAST_TO_LAYER_DICT } from 'applications/editor/consts';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import { getLayerSettingNameFromEditorLayer } from 'applications/editor/utils';
import bufferStopIcon from 'assets/pictures/layersicons/bufferstop.svg';
import detectorsIcon from 'assets/pictures/layersicons/detectors.svg';
import trackSectionsIcon from 'assets/pictures/layersicons/layer_adv.svg';
import levelCrossingIcon from 'assets/pictures/layersicons/layer_level_crossing.svg';
import signalsIcon from 'assets/pictures/layersicons/layer_signal.svg';
import pslsIcon from 'assets/pictures/layersicons/layer_tivs.svg';
import OPsSVGFile from 'assets/pictures/layersicons/ops.svg';
import switchesIcon from 'assets/pictures/layersicons/switches.svg';
import { Modal } from 'common/BootstrapSNCF/ModalSNCF';
import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import MapSettingsBackgroundSwitches from 'common/Map/Settings/MapSettingsBackgroundSwitches';
import { Icon2SVG } from 'common/Map/Settings/MapSettingsLayers';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';
import useSpeedLimitTags from 'common/SpeedLimitTagSelector/useSpeedLimitTags';
import type { LayersSettings } from 'reducers/commonMap/types';

import { useMapContext } from '../useMapContext';

const LAYERS: { layer: keyof LayersSettings; icon: string | React.JSX.Element }[] = [
  { layer: 'track_sections', icon: trackSectionsIcon },
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
  { layer: 'level_crossings', icon: levelCrossingIcon },
];

type LayersModalProps = {
  compactModal: boolean;
  selection?: EditorEntity[];
  disabledLayers?: LayersSettings;
  closePortalModal?: () => void;
  onChange?: (newLayersSettings: LayersSettings) => void;
  showTrackSectionToggle?: boolean;
};

const LayersModal = ({
  compactModal,
  selection,
  disabledLayers,
  showTrackSectionToggle = false,
  closePortalModal,
  onChange,
}: LayersModalProps) => {
  const { t } = useTranslation();

  const { infraId, layersSettings, updateMapSettings } = useMapContext();
  const [selectedLayers, setSelectedLayers] = useState<LayersSettings>(layersSettings);

  const speedLimitTags = useSpeedLimitTags(infraId);
  const DEFAULT_SPEED_LIMIT_TAG = useMemo(() => t('mapSettings.noSpeedLimitByTag'), [t]);

  const speedLimitOptions = useMemo(
    () => [DEFAULT_SPEED_LIMIT_TAG, ...speedLimitTags],
    [t, speedLimitTags]
  );

  const layers = useMemo(
    () =>
      showTrackSectionToggle ? LAYERS : LAYERS.filter((layer) => layer.layer !== 'track_sections'),
    [showTrackSectionToggle]
  );

  // Editor - selection counts
  const selectionCounts = useMemo(() => {
    const countsByObjType = new Map<keyof LayersSettings, number>();
    if (!selection) return countsByObjType;

    const selectionByObjType = groupBy(selection, 'objType');
    Object.values(selectionByObjType).forEach((selectedObjects) => {
      const objType = selectedObjects[0].objType;
      if (objType !== 'SwitchType' && objType !== 'LevelCrossing') {
        const layerSettingName = getLayerSettingNameFromEditorLayer(
          EDITOAST_TO_LAYER_DICT[objType][0]
        );
        if (layerSettingName) countsByObjType.set(layerSettingName, selectedObjects.length);
      }
    });
    return countsByObjType;
  }, [selection]);

  const unselectCount = useMemo(
    () =>
      sum(
        LAYERS.filter(({ layer }) => !selectedLayers[layer]).map(
          ({ layer }) => selectionCounts.get(layer) || 0
        )
      ),
    [selectedLayers, selectionCounts]
  );

  const toggleLayer = useCallback(
    (layer: keyof LayersSettings) => {
      const updatedLayers = {
        ...selectedLayers,
        [layer]: !selectedLayers[layer],
      };

      setSelectedLayers(updatedLayers);
      updateMapSettings({ layersSettings: updatedLayers });
      onChange?.(updatedLayers);
    },
    [selectedLayers, updateMapSettings]
  );

  return (
    <Modal title={t('map.layers-modal.toggle-layers')} closePortalModal={closePortalModal}>
      <div className="container-fluid mb-3">
        <div>
          <h4>{t('map.layers-modal.data-layers')}</h4>
        </div>
        <div className="row">
          {layers.map(({ layer, icon }) => (
            <div className="col-lg-6" key={`${layer}`}>
              <div className="d-flex align-items-center mt-2">
                <SwitchSNCF
                  id={`map-layer-${layer}`}
                  type="switch"
                  name={`map-layer-${layer}`}
                  checked={!!selectedLayers[layer]}
                  disabled={layer !== 'speedlimittag' && disabledLayers?.[layer]}
                  onChange={() => toggleLayer(layer)}
                />
                {isString(icon) ? (
                  <img className="layer-modal-img mx-2" src={icon} alt="" />
                ) : (
                  <div>{icon}</div>
                )}
                <div className="d-flex flex-column">
                  <div>{t(`mapSettings.layers.${layer}`)}</div>
                  {selectedLayers[layer] && !!selectionCounts.get(layer) && (
                    <div className="small text-muted font-italic">
                      {t('map.layers-modal.layer-selected-items', {
                        count: selectionCounts.get(layer),
                      })}
                    </div>
                  )}
                  {disabledLayers?.[layer] && (
                    <div className="small text-muted font-italic">
                      {t('map.layers-modal.disabled-layer')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <hr />
        <div>
          <h4>{t('map.layers-modal.speed-limits')}</h4>
          <select
            id="speedLimitTag"
            className="form-control"
            disabled={!selectedLayers.speed_limits}
            value={selectedLayers.speedlimittag || DEFAULT_SPEED_LIMIT_TAG}
            onChange={(e) => {
              const newTag = e.target.value !== DEFAULT_SPEED_LIMIT_TAG ? e.target.value : null;
              const newLayers = { ...selectedLayers, speedlimittag: newTag };
              updateMapSettings({ layersSettings: newLayers });
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
            <MapSettingsMapStyle />
            <MapSettingsBackgroundSwitches />
          </>
        )}
        <div className="text-right">
          {!!unselectCount && (
            <div className="text-primary my-2">
              {t('map.layers-modal.selection-warning', { count: unselectCount })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default LayersModal;
