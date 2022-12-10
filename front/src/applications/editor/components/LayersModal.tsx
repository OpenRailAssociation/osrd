import React, { FC, useContext, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { groupBy, mapKeys, mapValues, sum } from 'lodash';

import bufferStopIcon from 'assets/pictures/layersicons/bufferstop.svg';
import switchesIcon from 'assets/pictures/layersicons/switches.svg';
import detectorsIcon from 'assets/pictures/layersicons/detectors.svg';
import trackSectionsIcon from 'assets/pictures/layersicons/layer_adv.svg';
import signalsIcon from 'assets/pictures/layersicons/layer_signal.svg';

import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import MapSettingsBackgroundSwitches from 'common/Map/Settings/MapSettingsBackgroundSwitches';
import EditorContext from '../context';
import Modal from './Modal';
import { LayerType, ModalProps, OBJTYPE_TO_LAYER_DICT } from '../tools/types';
import { selectLayers } from '../../../reducers/editor';
import { EditorEntity } from '../../../types';

const LAYERS: { id: LayerType; icon: string }[] = [
  { id: 'track_sections', icon: trackSectionsIcon },
  { id: 'signals', icon: signalsIcon },
  { id: 'buffer_stops', icon: bufferStopIcon },
  { id: 'detectors', icon: detectorsIcon },
  { id: 'switches', icon: switchesIcon },
];

const LayersModal: FC<
  ModalProps<
    {
      initialLayers: Set<LayerType>;
      selection?: EditorEntity[];
      frozenLayers?: Set<LayerType>;
    },
    { newLayers: Set<LayerType> }
  >
> = ({ arguments: { initialLayers, selection, frozenLayers }, cancel, submit }) => {
  const dispatch = useDispatch();
  const { t } = useContext(EditorContext);
  const [selectedLayers, setSelectedLayers] = useState<Set<LayerType>>(initialLayers);
  const selectionCounts = useMemo(
    () =>
      selection
        ? mapKeys(
            mapValues(groupBy(selection, 'objType'), (values) => values.length),
            (_values, key) => OBJTYPE_TO_LAYER_DICT[key]
          )
        : {},
    [selection]
  );
  const unselectCount = useMemo(
    () =>
      sum(
        LAYERS.filter((layer) => !selectedLayers.has(layer.id)).map(
          (layer) => selectionCounts[layer.id] || 0
        )
      ),
    [selectedLayers, selectionCounts]
  );

  return (
    <Modal onClose={cancel} title={t('Editor.nav.toggle-layers')}>
      <div className="container-fluid mb-3">
        <div className="row">
          {LAYERS.map(({ id, icon }) => (
            <div className="col-lg-6" key={id}>
              <div className="d-flex align-items-center mt-2">
                <SwitchSNCF
                  type="switch"
                  onChange={() =>
                    setSelectedLayers((set) => {
                      const newSet = new Set(set);
                      if (newSet.has(id)) newSet.delete(id);
                      else newSet.add(id);
                      return newSet;
                    })
                  }
                  name={`editor-layer-${id}`}
                  id={`editor-layer-${id}`}
                  checked={selectedLayers.has(id)}
                  disabled={frozenLayers && frozenLayers.has(id)}
                />
                <img className="mx-2" src={icon} alt="" height="20" />
                <div className="d-flex flex-column">
                  <div>{t(`Editor.layers.${id}`)}</div>
                  {!!selectionCounts[id] && (
                    <div className="small text-muted font-italic">
                      {t('Editor.layers-modal.layer-selected-items', {
                        count: selectionCounts[id],
                      })}
                    </div>
                  )}
                  {frozenLayers && frozenLayers.has(id) && (
                    <div className="small text-muted font-italic">
                      {t('Editor.layers-modal.frozen-layer')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <hr />
        <MapSettingsBackgroundSwitches />
      </div>

      <div className="text-right">
        {!!unselectCount && (
          <div className="text-primary my-2">
            {t('Editor.layers-modal.selection-warning', { count: unselectCount })}
          </div>
        )}
        <button type="button" className="btn btn-danger mr-2" onClick={cancel}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            dispatch(selectLayers(selectedLayers));
            submit({ newLayers: selectedLayers });
          }}
        >
          {t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default LayersModal;
