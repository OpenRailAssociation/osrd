import React, { useMemo, useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { groupBy, sum, isString, isArray, uniq } from 'lodash';
import { useTranslation } from 'react-i18next';
import { GiElectric, GiUnplugged } from 'react-icons/gi';
import { MdSpeed } from 'react-icons/md';
import { TbRectangleVerticalFilled } from 'react-icons/tb';

import { EDITOAST_TO_LAYER_DICT } from 'applications/editor/consts';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import bufferStopIcon from 'assets/pictures/layersicons/bufferstop.svg';
import detectorsIcon from 'assets/pictures/layersicons/detectors.svg';
import trackSectionsIcon from 'assets/pictures/layersicons/layer_adv.svg';
import levelCrossingIcon from 'assets/pictures/layersicons/layer_level_crossing.svg';
import signalsIcon from 'assets/pictures/layersicons/layer_signal.svg';
import pslsIcon from 'assets/pictures/layersicons/layer_tivs.svg';
import OPsSVGFile from 'assets/pictures/layersicons/ops.svg';
import switchesIcon from 'assets/pictures/layersicons/switches.svg';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Modal } from 'common/BootstrapSNCF/ModalSNCF';
import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF';
import MapSettingsBackgroundSwitches from 'common/Map/Settings/MapSettingsBackgroundSwitches';
import { Icon2SVG } from 'common/Map/Settings/MapSettingsLayers';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';
import { useInfraID } from 'common/osrdContext';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { LayersSettings } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';

import { getLayerSettingNameFromEditorLayer } from '../utils';

const LAYERS: { layer: keyof LayersSettings; icon: string | React.JSX.Element }[] = [
  { layer: 'tvds', icon: trackSectionsIcon },
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
  {
    layer: 'level_crossings',
    icon: <Icon2SVG file={levelCrossingIcon} style={{ width: '20px' }} className="mx-2" />,
  },
  { layer: 'speed_limits', icon: <MdSpeed style={{ width: '20px' }} className="mx-2" /> },
];

type EditorLayersModalProps = {
  selection?: EditorEntity[];
  frozenLayers?: LayersSettings;
  onChange: (newLayersSettings: LayersSettings) => void;
};

const EditorLayersModal = ({ selection, frozenLayers, onChange }: EditorLayersModalProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const infraID = useInfraID();
  const mapSettings = useMapSettings();
  const { layersSettings } = mapSettings;
  const { updateLayersSettings } = useMapSettingsActions();

  const [selectedLayers, setSelectedLayers] = useState<LayersSettings>(layersSettings);

  const { data: speedLimitTagsByInfraId } =
    osrdEditoastApi.endpoints.getInfraByInfraIdSpeedLimitTags.useQuery(
      infraID ? { infraId: infraID } : skipToken
    );
  const allSpeedLimitTags = uniq(speedLimitTagsByInfraId);
  const allSpeedLimitTagsOrdered = useMemo(() => allSpeedLimitTags.sort(), [allSpeedLimitTags]);

  const DEFAULT_SPEED_LIMIT_TAG = useMemo(() => t('mapSettings.noSpeedLimitByTag'), [t]);

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
        LAYERS.filter(({ layer }) => !layersSettings[layer]).map(
          ({ layer }) => selectionCounts.get(layer) || 0
        )
      ),
    [selectedLayers, selectionCounts]
  );

  const speedLimitOptions = useMemo(
    () => uniq([DEFAULT_SPEED_LIMIT_TAG, ...allSpeedLimitTagsOrdered]),
    [allSpeedLimitTagsOrdered]
  );

  return (
    <Modal title={t('Editor.nav.toggle-layers')}>
      <div className="container-fluid mb-3">
        <div>
          <h4>{t('Editor.nav.osrd-layers')}</h4>
        </div>
        <div className="row">
          {LAYERS.map(({ layer, icon }) => {
            if (layer === 'speedlimittag') return null;
            return (
              <div className="col-lg-6" key={layer}>
                <div className="d-flex align-items-center mt-2">
                  <SwitchSNCF
                    type="switch"
                    onChange={() => {
                      const newLayersSettings = {
                        ...layersSettings,
                        [layer]: !layersSettings[layer],
                      };
                      setSelectedLayers(newLayersSettings);
                      dispatch(updateLayersSettings(newLayersSettings));
                      onChange(newLayersSettings);
                    }}
                    name={`editor-layer-${layer}`}
                    id={`editor-layer-${layer}`}
                    checked={selectedLayers[layer]}
                    disabled={frozenLayers?.[layer]}
                  />
                  {isString(icon) ? (
                    <img className="layer-modal-img mx-2" src={icon} alt="" />
                  ) : (
                    <div>{icon}</div>
                  )}
                  <div className="d-flex flex-column">
                    <div>{t(`Editor.layers.${layer}`)}</div>
                    {selectedLayers[layer] && !!selectionCounts.get(layer) && (
                      <div className="small text-muted font-italic">
                        {t('Editor.layers-modal.layer-selected-items', {
                          count: selectionCounts.get(layer),
                        })}
                      </div>
                    )}
                    {frozenLayers?.[layer] && (
                      <div className="small text-muted font-italic">
                        {t('Editor.layers-modal.frozen-layer')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <hr />
        <div>
          <h4>{t('Editor.nav.speed-limits')}</h4>
          <select
            id="speedLimitTag"
            className="form-control"
            value={layersSettings.speedlimittag || DEFAULT_SPEED_LIMIT_TAG}
            disabled={!isArray(allSpeedLimitTags) || !layersSettings.speed_limits}
            onChange={(e) => {
              const newTag = e.target.value !== DEFAULT_SPEED_LIMIT_TAG ? e.target.value : null;
              dispatch(
                updateLayersSettings({ ...mapSettings.layersSettings, speedlimittag: newTag })
              );
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
        <div>
          <h4>{t('Editor.nav.map-layers')}</h4>
        </div>
        <MapSettingsMapStyle />
        <MapSettingsBackgroundSwitches />
      </div>

      <div className="text-right">
        {!!unselectCount && (
          <div className="text-primary my-2">
            {t('Editor.layers-modal.selection-warning', { count: unselectCount })}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EditorLayersModal;
