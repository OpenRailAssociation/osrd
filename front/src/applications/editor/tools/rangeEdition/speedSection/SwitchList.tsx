import React from 'react';

import cx from 'classnames';
import { t } from 'i18next';
import { FaTimes } from 'react-icons/fa';

import type { PartialOrReducer } from 'applications/editor/types';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { useInfraID } from 'common/osrdContext';
import Tipped from 'common/Tipped';

import { useSwitchTypes } from '../../switchEdition/types';
import type {
  AvailableSwitchPositions,
  RangeEditionState,
  SpeedSectionEntity,
  SwitchSelection,
} from '../types';

type SwitchListProps = {
  selectedSwitches: SwitchSelection;
  unselectSwitch: (swId: string) => () => void;
  setSwitchSelection: (
    stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>
  ) => void;
  availableSwitchesPositions: AvailableSwitchPositions;
};

const SwitchList: React.FC<SwitchListProps> = ({
  selectedSwitches,
  unselectSwitch,
  setSwitchSelection,
  /** possible positions based on the routes found */
  availableSwitchesPositions,
}) => {
  const infraID = useInfraID();
  const switchTypes = useSwitchTypes(infraID);

  /** Switch positions ordered by type for the current infra */
  const switchPositionsByType = switchTypes.reduce<AvailableSwitchPositions>(
    (acc, switchType) => ({
      ...acc,
      [switchType.id]: ['Any', ...Object.keys(switchType.groups).sort()],
    }),
    {}
  );

  return (
    <div className="mt-3 switch-list">
      {Object.keys(selectedSwitches).map((swId, index) => {
        const { position, type } = selectedSwitches[swId];
        return (
          <div className="d-flex mb-3" key={index}>
            <div className="d-flex">
              <button
                type="button"
                className="align-self-end btn btn-primary btn-sm px-2 mr-2"
                aria-label={t('common.delete')}
                title={t('common.delete')}
                onClick={unselectSwitch(swId)}
              >
                <FaTimes />
              </button>
              <span className="align-self-end">{`${t('Editor.obj-types.Switch')} ${swId}`}</span>
            </div>
            <div className="d-flex ml-4">
              {switchPositionsByType[type].map((optPosition, posIndex) => {
                const isPositionNull = optPosition === 'Any';
                const isButtonIncompatible =
                  Object.keys(selectedSwitches).length > 1 &&
                  !!Object.keys(availableSwitchesPositions).length &&
                  !isPositionNull &&
                  !(availableSwitchesPositions[swId] || []).includes(optPosition);
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
                          'incompatible-configuration-switch': isButtonIncompatible,
                        })}
                        type="radio"
                        label=""
                        id={`${swId}-${optPosition}`}
                        name={swId}
                        onChange={() => {
                          setSwitchSelection((prev) => ({
                            ...prev,
                            selectedSwitches: {
                              ...selectedSwitches,
                              [swId]: {
                                ...prev.selectedSwitches[swId],
                                position: isPositionNull ? null : optPosition,
                              },
                            },
                          }));
                        }}
                        checked={isButtonChecked}
                      />
                      <div className="incompatible-tooltip">
                        {t('Editor.tools.speed-edition.incompatible-switch')}
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

export default SwitchList;
