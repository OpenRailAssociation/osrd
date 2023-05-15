import React, { FC, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { groupBy, mapKeys, mapValues, sum, isString, isArray, uniq } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BsFillExclamationOctagonFill } from 'react-icons/bs';
import { MdSpeed } from 'react-icons/md';

import bufferStopIcon from 'assets/pictures/layersicons/bufferstop.svg';
import switchesIcon from 'assets/pictures/layersicons/switches.svg';
import detectorsIcon from 'assets/pictures/layersicons/detectors.svg';
import trackSectionsIcon from 'assets/pictures/layersicons/layer_adv.svg';
import signalsIcon from 'assets/pictures/layersicons/layer_signal.svg';
import lpvsIcon from 'assets/pictures/layersicons/layer_tivs.svg';

import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import { useModal, Modal } from 'common/BootstrapSNCF/ModalSNCF';
import MapSettingsBackgroundSwitches from 'common/Map/Settings/MapSettingsBackgroundSwitches';
import { GiElectric } from 'react-icons/gi';
import { LayerType, EDITOAST_TO_LAYER_DICT, EditoastType } from '../tools/types';
import { selectLayers } from '../../../reducers/editor';
import { EditorEntity } from '../../../types';
import { getMap } from '../../../reducers/map/selectors';
import { getInfraID } from '../../../reducers/osrdconf/selectors';
import { osrdEditoastApi } from '../../../common/api/osrdEditoastApi';
import { updateLayersSettings } from '../../../reducers/map';

const LAYERS: Array<{ layers: LayerType[]; icon: string | JSX.Element }> = [
  { layers: ['track_sections'], icon: trackSectionsIcon },
  { layers: ['signals'], icon: signalsIcon },
  { layers: ['buffer_stops'], icon: bufferStopIcon },
  { layers: ['detectors'], icon: detectorsIcon },
  { layers: ['switches'], icon: switchesIcon },
  { layers: ['speed_sections'], icon: <MdSpeed style={{ width: '20px' }} className="mx-2" /> },
  { layers: ['lpv', 'lpv_panels'], icon: lpvsIcon },
  { layers: ['catenaries'], icon: <GiElectric style={{ width: '20px' }} className="mx-2" /> },
  {
    layers: ['errors'],
    icon: <BsFillExclamationOctagonFill style={{ width: '20px' }} className="mx-2 text-danger" />,
  },
];

const NO_SPEED_LIMIT_TAG = 'undefined';

interface LayersModalProps {
  initialLayers: Set<LayerType>;
  selection?: EditorEntity[];
  frozenLayers?: Set<LayerType>;
  onSubmit: (args: { newLayers: Set<LayerType> }) => void;
}
const LayersModal: FC<LayersModalProps> = ({
  initialLayers,
  selection,
  frozenLayers,
  onSubmit,
}) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const { layersSettings } = useSelector(getMap);
  const [selectedLayers, setSelectedLayers] = useState<Set<LayerType>>(initialLayers);
  const [speedLimitTag, setSpeedLimitTag] = useState<string | undefined>(
    layersSettings.speedlimittag as string | undefined
  );
  const infraID = useSelector(getInfraID);
  const { data: speedLimitTags } = osrdEditoastApi.endpoints.getInfraByIdSpeedLimitTags.useQuery({
    id: infraID as number,
  });
  const selectionCounts = useMemo(
    () =>
      selection
        ? mapKeys(
            // TODO: ATM we don't know if a selected speed section should be considered as SpeedSection or LPV,
            // which are two different layers.
            mapValues(groupBy(selection, 'objType'), (values) => values.length),
            (_values, key) => EDITOAST_TO_LAYER_DICT[key as EditoastType]
          )
        : {},
    [selection]
  );
  const unselectCount = useMemo(
    () =>
      sum(
        LAYERS.filter((layer) => layer.layers.some((id) => !selectedLayers.has(id))).flatMap(
          (layer) => layer.layers.map((id) => selectionCounts[id] || 0)
        )
      ),
    [selectedLayers, selectionCounts]
  );

  const memoOptions = useMemo(
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
            return (
              <div className="col-lg-6" key={layerKey}>
                <div className="d-flex align-items-center mt-2">
                  <SwitchSNCF
                    type="switch"
                    onChange={() =>
                      setSelectedLayers((set) => {
                        const newSet = new Set(set);
                        layers.forEach((id) => {
                          if (newSet.has(id)) newSet.delete(id);
                          else newSet.add(id);
                        });
                        return newSet;
                      })
                    }
                    name={`editor-layer-${layerKey}`}
                    id={`editor-layer-${layerKey}`}
                    checked={layers.every((id) => selectedLayers.has(id))}
                    disabled={disabled}
                  />
                  {isString(icon) ? (
                    <img className="mx-2" src={icon} alt="" height="20" />
                  ) : (
                    <div>{icon}</div>
                  )}
                  <div className="d-flex flex-column">
                    <div>{t(`Editor.layers.${layerKey}`)}</div>
                    {!!count && (
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
            id="filterLevel"
            className="form-control"
            value={speedLimitTag || NO_SPEED_LIMIT_TAG}
            disabled={!isArray(speedLimitTags) || !selectedLayers.has('speed_sections')}
            onChange={(e) => setSpeedLimitTag(e.target.value)}
          >
            {memoOptions.map((tag) => (
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
        <MapSettingsBackgroundSwitches />
      </div>

      <div className="text-right">
        {!!unselectCount && (
          <div className="text-primary my-2">
            {t('Editor.layers-modal.selection-warning', { count: unselectCount })}
          </div>
        )}
        <button type="button" className="btn btn-danger mr-2" onClick={closeModal}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            dispatch(selectLayers(selectedLayers));
            dispatch(
              updateLayersSettings({
                ...layersSettings,
                speedlimittag: speedLimitTag,
              })
            );
            onSubmit({ newLayers: selectedLayers });
            closeModal();
          }}
        >
          {t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default LayersModal;
