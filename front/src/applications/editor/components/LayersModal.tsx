import React, { FC, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { groupBy, mapKeys, mapValues, sum, isString, isArray, uniq } from 'lodash';
import { useTranslation } from 'react-i18next';
import { MdSpeed } from 'react-icons/md';
import { TbRectangleVerticalFilled } from 'react-icons/tb';

import bufferStopIcon from 'assets/pictures/layersicons/bufferstop.svg';
import switchesIcon from 'assets/pictures/layersicons/switches.svg';
import detectorsIcon from 'assets/pictures/layersicons/detectors.svg';
import trackSectionsIcon from 'assets/pictures/layersicons/layer_adv.svg';
import signalsIcon from 'assets/pictures/layersicons/layer_signal.svg';
import pslsIcon from 'assets/pictures/layersicons/layer_tivs.svg';

import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import { Modal } from 'common/BootstrapSNCF/ModalSNCF';
import MapSettingsBackgroundSwitches from 'common/Map/Settings/MapSettingsBackgroundSwitches';
import { GiElectric } from 'react-icons/gi';
import { LayerType, EDITOAST_TO_LAYER_DICT, EditoastType } from 'applications/editor/tools/types';
import { selectLayers } from 'reducers/editor';
import { EditorEntity } from 'types';
import { getMap } from 'reducers/map/selectors';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { updateLayersSettings } from 'reducers/map';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';

export const LAYERS: Array<{ layers: LayerType[]; icon: string | JSX.Element }> = [
  { layers: ['track_sections'], icon: trackSectionsIcon },
  { layers: ['signals'], icon: signalsIcon },
  { layers: ['buffer_stops'], icon: bufferStopIcon },
  { layers: ['detectors'], icon: detectorsIcon },
  { layers: ['switches'], icon: switchesIcon },
  { layers: ['speed_sections'], icon: <MdSpeed style={{ width: '20px' }} className="mx-2" /> },
  { layers: ['psl', 'psl_signs'], icon: pslsIcon },
  { layers: ['catenaries'], icon: <GiElectric style={{ width: '20px' }} className="mx-2" /> },
  {
    layers: ['platforms'],
    icon: <TbRectangleVerticalFilled style={{ width: '20px' }} className="mx-2" />,
  },
];

const NO_SPEED_LIMIT_TAG = 'undefined';

interface LayersModalProps {
  initialLayers: Set<LayerType>;
  selection?: EditorEntity[];
  frozenLayers?: Set<LayerType>;
  onChange: (args: { newLayers: Set<LayerType> }) => void;
}
const LayersModal: FC<LayersModalProps> = ({
  initialLayers,
  selection,
  frozenLayers,
  onChange,
}) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { layersSettings } = useSelector(getMap);
  const [selectedLayers, setSelectedLayers] = useState<Set<LayerType>>(initialLayers);
  const infraID = useSelector(getInfraID);
  const { data: speedLimitTags } = osrdEditoastApi.endpoints.getInfraByIdSpeedLimitTags.useQuery({
    id: infraID as number,
  });
  const selectionCounts = useMemo(
    () =>
      selection
        ? mapKeys(
            // TODO: ATM we don't know if a selected speed section should be considered as SpeedSection or PSL,
            // which are two different layers.
            mapValues(groupBy(selection, 'objType'), (values) => values.length),
            (_values, key) => EDITOAST_TO_LAYER_DICT[key as EditoastType]
          )
        : {},
    [selection]
  );

  /**
   * When selection changed, we check that all needed layers are enabled.
   * This is mainly used for the error modal
   */
  useEffect(() => {
    // compute the set of layer needed by the selection
    const layersMustBeEnabled = (selection || []).reduce((acc, curr) => {
      const layerTypes = EDITOAST_TO_LAYER_DICT[curr.objType as EditoastType] || [];
      layerTypes.forEach((layerType) => {
        if (layerType && !acc.has(layerType)) acc.add(layerType);
      });
      return acc;
    }, new Set<LayerType>());

    // enable all the layers
    setSelectedLayers((set) => {
      const newSet = new Set(set);
      layersMustBeEnabled.forEach((id) => {
        if (!newSet.has(id)) newSet.add(id);
      });
      return newSet;
    });
  }, [selection]);

  const unselectCount = useMemo(
    () =>
      sum(
        LAYERS.filter((layer) => layer.layers.some((id) => !selectedLayers.has(id))).flatMap(
          (layer) => layer.layers.map((id) => selectionCounts[id] || 0)
        )
      ),
    [selectedLayers, selectionCounts]
  );

  const speedLimitOptions = useMemo(
    () => uniq([NO_SPEED_LIMIT_TAG, ...(speedLimitTags || [])]),
    [speedLimitTags]
  );

  return (
    <Modal title={t('Editor.nav.toggle-layers')}>
      <div className="container-fluid mb-3">
        <div>
          <h4>{t('Editor.nav.osrd-layers')}</h4>
        </div>
        <div className="row">
          {LAYERS.map(({ layers, icon }) => {
            const layerKey = layers.join('-');
            const count = sum(layers.map((id) => selectionCounts[id] || 0));
            const disabled = frozenLayers && layers.some((id) => frozenLayers.has(id));
            const checked = layers.every((id) => selectedLayers.has(id));
            return (
              <div className="col-lg-6" key={`${layerKey}-${count}-${disabled}`}>
                <div className="d-flex align-items-center mt-2">
                  <SwitchSNCF
                    type="switch"
                    onChange={() => {
                      const newSelectedLayersList = layers.reduce((result, layer) => {
                        if (result.has(layer)) result.delete(layer);
                        else result.add(layer);
                        return result;
                      }, new Set(selectedLayers));
                      setSelectedLayers(newSelectedLayersList);
                      dispatch(selectLayers(newSelectedLayersList));
                      onChange({ newLayers: newSelectedLayersList });
                    }}
                    name={`editor-layer-${layerKey}`}
                    id={`editor-layer-${layerKey}`}
                    checked={checked}
                    disabled={disabled}
                  />
                  {isString(icon) ? (
                    <img className="mx-2" src={icon} alt="" height="20" />
                  ) : (
                    <div>{icon}</div>
                  )}
                  <div className="d-flex flex-column">
                    <div>{t(`Editor.layers.${layerKey}`)}</div>
                    {!!count && checked && (
                      <div className="small text-muted font-italic">
                        {t('Editor.layers-modal.layer-selected-items', {
                          count,
                        })}
                      </div>
                    )}
                    {disabled && (
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
            value={layersSettings.speedlimittag}
            disabled={!isArray(speedLimitTags) || !selectedLayers.has('speed_sections')}
            onChange={(e) => {
              dispatch(
                updateLayersSettings({
                  ...layersSettings,
                  speedlimittag: e.target.value === NO_SPEED_LIMIT_TAG ? undefined : e.target.value,
                })
              );
            }}
          >
            {speedLimitOptions.map((tag) => (
              <option value={tag} key={tag}>
                {tag === NO_SPEED_LIMIT_TAG ? t('Editor.layers-modal.no-speed-limit-tag') : tag}
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

export default LayersModal;
