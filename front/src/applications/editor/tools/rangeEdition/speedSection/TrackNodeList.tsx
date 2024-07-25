import React from 'react';

import cx from 'classnames';
import { t } from 'i18next';
import { FaTimes } from 'react-icons/fa';

import type { PartialOrReducer } from 'applications/editor/types';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { useInfraID } from 'common/osrdContext';
import Tipped from 'common/Tipped';

import useTrackNodeTypes from '../../trackNodeEdition/useTrackNodeTypes';
import type {
  AvailableTrackNodePositions,
  RangeEditionState,
  SpeedSectionEntity,
  TrackNodeSelection,
} from '../types';

type TrackNodeListProps = {
  selectedTrackNodes: TrackNodeSelection;
  unselectTrackNode: (swId: string) => () => void;
  setTrackNodeSelection: (
    stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>
  ) => void;
  availableTrackNodesPositions: AvailableTrackNodePositions;
};

const TrackNodeList: React.FC<TrackNodeListProps> = ({
  selectedTrackNodes,
  unselectTrackNode,
  setTrackNodeSelection,
  /** possible positions based on the routes found */
  availableTrackNodesPositions,
}) => {
  const infraID = useInfraID();
  const { data: trackNodeTypes } = useTrackNodeTypes(infraID);

  /** TrackNode positions ordered by type for the current infra */
  const trackNodePositionsByType = trackNodeTypes.reduce<AvailableTrackNodePositions>(
    (acc, trackNodeType) => ({
      ...acc,
      [trackNodeType.id]: ['Any', ...Object.keys(trackNodeType.groups).sort()],
    }),
    {}
  );

  return (
    <div className="mt-3 track-node-list">
      {Object.keys(selectedTrackNodes).map((swId, index) => {
        const { position, type } = selectedTrackNodes[swId];
        return (
          <div className="d-flex mb-3" key={index}>
            <div className="d-flex">
              <button
                type="button"
                className="align-self-end btn btn-primary btn-sm px-2 mr-2"
                aria-label={t('common.delete')}
                title={t('common.delete')}
                onClick={unselectTrackNode(swId)}
              >
                <FaTimes />
              </button>
              <span className="align-self-end">{`${t('Editor.obj-types.TrackNode')} ${swId}`}</span>
            </div>
            <div className="d-flex ml-4">

              {trackNodePositionsByType[type]?.map((optPosition, posIndex) => {
                const isPositionNull = optPosition === 'Any';
                const isButtonIncompatible =
                  Object.keys(selectedTrackNodes).length > 1 &&
                  !!Object.keys(availableTrackNodesPositions).length &&
                  !isPositionNull &&
                  !(availableTrackNodesPositions[swId] || []).includes(optPosition);
                const isButtonChecked =
                  (position === null && isPositionNull) || position === optPosition;

                return (
                  <div
                    key={`${swId}-${optPosition}`}
                    className={cx('d-flex', 'flex-column', {
                      'pl-2 ml-2 border-left': posIndex !== 0,
                    })}
                  >
                    <label className="small" htmlFor={`${swId}-${optPosition}`}>
                      {optPosition}
                    </label>
                    <Tipped disableTooltip={!isButtonIncompatible}>
                      <CheckboxRadioSNCF
                        containerClassName={cx({
                          'incompatible-configuration-track-node': isButtonIncompatible,
                        })}
                        type="radio"
                        label=""
                        id={`${swId}-${optPosition}`}
                        name={swId}
                        onChange={() => {
                          setTrackNodeSelection((prev) => ({
                            ...prev,
                            selectedTrackNodes: {
                              ...selectedTrackNodes,
                              [swId]: {
                                ...prev.selectedTrackNodes[swId],
                                position: isPositionNull ? null : optPosition,
                              },
                            },
                          }));
                        }}
                        checked={isButtonChecked}
                      />
                      <div className="incompatible-tooltip">
                        {t('Editor.tools.speed-edition.incompatible-track-node')}
                      </div>
                    </Tipped>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrackNodeList;
