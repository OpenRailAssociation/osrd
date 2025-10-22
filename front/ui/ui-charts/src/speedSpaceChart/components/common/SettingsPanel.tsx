import React from 'react';

import { Checkbox, CheckboxesTree } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';

import type { Store } from '../../types';
import {
  DETAILS_BOX_SELECTION,
  type ETCS_BRAKING_SELECTION,
  ETCS_CURVE_SELECTION,
  LAYERS_SELECTION,
} from '../const';
import type { SpeedSpaceChartProps } from '../SpeedSpaceChart';
import { getActiveEtcsBrakingTypes, isLayerActive } from '../utils';

const SETTINGS_PANEL_BASE_HEIGHT = 442;

type SettingsPanelProps = {
  color: string;
  store: Store;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
  setIsMouseHoveringSettingsPanel: React.Dispatch<React.SetStateAction<boolean>>;
  adjustHeightOnLayerChange: (
    layerName: 'electricalProfiles' | 'powerRestrictions' | 'speedLimitTags',
    isCurrentlyActive: boolean
  ) => void;
  translations?: SpeedSpaceChartProps['translations'];
  testIdPrefix?: string;
  displayEtcs?: boolean;
};

const SettingsPanel = ({
  color,
  store,
  setStore,
  setIsMouseHoveringSettingsPanel,
  adjustHeightOnLayerChange,
  translations,
  testIdPrefix,
  displayEtcs,
}: SettingsPanelProps) => {
  const closeSettingsPanel = () => {
    setIsMouseHoveringSettingsPanel(false);
    setStore((prev) => ({
      ...prev,
      isSettingsPanelOpened: false,
    }));
  };

  const stopsAndTransitions: keyof typeof ETCS_BRAKING_SELECTION = 'stopsAndTransitions';
  const otherEtcsBrakingTypes: (keyof typeof ETCS_BRAKING_SELECTION)[] = ['spacing', 'routing'];
  const updateEtcsBrakingType = (
    etcsBrakingType: keyof typeof ETCS_BRAKING_SELECTION,
    newValue?: boolean
  ) => {
    setStore((prev) => ({
      ...prev,
      etcsLayersDisplay: {
        ...prev.etcsLayersDisplay,
        etcsBrakingTypes: {
          ...prev.etcsLayersDisplay.etcsBrakingTypes,
          [etcsBrakingType]:
            newValue !== undefined
              ? newValue
              : !prev.etcsLayersDisplay.etcsBrakingTypes[etcsBrakingType],
        },
      },
    }));
  };

  return (
    <div
      id="settings-panel"
      style={{
        background: `rgba(${color.substring(4, color.length - 1)}, 0.4)`,
        height: `${SETTINGS_PANEL_BASE_HEIGHT}px`,
      }}
      className="font-sans"
      onMouseEnter={() => setIsMouseHoveringSettingsPanel(true)}
      onMouseLeave={() => setIsMouseHoveringSettingsPanel(false)}
    >
      <div className="settings-panel-section">
        <div className="settings-panel-section-title">
          <span>{translations?.layersDisplay.context || 'Context'}</span>
        </div>
        {LAYERS_SELECTION.map((selection) => (
          <Checkbox
            key={selection}
            data-testid={testIdPrefix ? `${testIdPrefix}-layer-${selection}` : undefined}
            label={translations?.layersDisplay[selection] || selection}
            checked={store.layersDisplay[selection]}
            disabled={!isLayerActive(store, selection)}
            onChange={() => {
              setStore((prev) => ({
                ...prev,
                layersDisplay: {
                  ...prev.layersDisplay,
                  [selection]: !prev.layersDisplay[selection],
                },
              }));

              if (
                selection === 'electricalProfiles' ||
                selection === 'powerRestrictions' ||
                selection === 'speedLimitTags'
              ) {
                adjustHeightOnLayerChange(selection, store.layersDisplay[selection]);
              }
            }}
          />
        ))}
      </div>
      {displayEtcs && (
        <div className="settings-panel-section">
          <div className="settings-panel-section-title">
            <span>{translations?.etcsLayersDisplay.title || 'ETCS'}</span>
          </div>
          <CheckboxesTree
            id={'etcs-braking-types'}
            items={[
              {
                id: 0,
                props: {
                  label:
                    translations?.etcsLayersDisplay.etcsBrakingTypes[stopsAndTransitions] ||
                    stopsAndTransitions,
                  checked: store.etcsLayersDisplay.etcsBrakingTypes[stopsAndTransitions],
                  onChange: () => {
                    updateEtcsBrakingType(stopsAndTransitions);
                  },
                },
              },
              {
                id: 1,
                props: {
                  label: translations?.etcsLayersDisplay.etcsBrakingTypes.signals,
                  checked: otherEtcsBrakingTypes.every(
                    (key) => store.etcsLayersDisplay.etcsBrakingTypes[key]
                  ),
                  isIndeterminate:
                    otherEtcsBrakingTypes.some(
                      (key) => store.etcsLayersDisplay.etcsBrakingTypes[key]
                    ) &&
                    !otherEtcsBrakingTypes.every(
                      (key) => store.etcsLayersDisplay.etcsBrakingTypes[key]
                    ),
                  onChange: () => {
                    const newValue = !otherEtcsBrakingTypes.every(
                      (key) => store.etcsLayersDisplay.etcsBrakingTypes[key]
                    );
                    otherEtcsBrakingTypes.map((etcsBrakingType) =>
                      updateEtcsBrakingType(etcsBrakingType, newValue)
                    );
                  },
                },
                items: otherEtcsBrakingTypes.map((etcsBrakingType, index) => ({
                  id: index + 2,
                  props: {
                    label:
                      translations?.etcsLayersDisplay.etcsBrakingTypes[etcsBrakingType] ||
                      etcsBrakingType,
                    checked: store.etcsLayersDisplay.etcsBrakingTypes[etcsBrakingType],
                    onChange: () => {
                      updateEtcsBrakingType(etcsBrakingType);
                    },
                  },
                })),
              },
            ]}
          />
          {getActiveEtcsBrakingTypes(store.etcsLayersDisplay).length > 0 && (
            <div className="bottom-panel">
              {(Object.keys(ETCS_CURVE_SELECTION) as (keyof typeof ETCS_CURVE_SELECTION)[]).map(
                (selection) => (
                  <Checkbox
                    key={selection}
                    label={
                      translations?.etcsLayersDisplay.etcsBrakingCurveTypes[selection] || selection
                    }
                    checked={store.etcsLayersDisplay.etcsBrakingCurveTypes[selection]}
                    onChange={() => {
                      setStore((prev) => ({
                        ...prev,
                        etcsLayersDisplay: {
                          ...prev.etcsLayersDisplay,
                          etcsBrakingCurveTypes: {
                            ...prev.etcsLayersDisplay.etcsBrakingCurveTypes,
                            [selection]: !prev.etcsLayersDisplay.etcsBrakingCurveTypes[selection],
                          },
                        },
                      }));
                    }}
                  />
                )
              )}
            </div>
          )}
        </div>
      )}
      <div className="settings-panel-section">
        <div className="settings-panel-section-title">
          <span>{translations?.detailsBoxDisplay.reticleInfos || 'Reticle infos'}</span>
        </div>
        {DETAILS_BOX_SELECTION.filter((detail_box) => detail_box !== 'etcs' || displayEtcs).map(
          (selection) => (
            <Checkbox
              key={selection}
              label={translations?.detailsBoxDisplay[selection] || selection}
              checked={store.detailsBoxDisplay[selection]}
              disabled={
                // TODO: enable when etcs details are fixed
                selection === 'etcs'
              }
              onChange={() => {
                setStore((prev) => ({
                  ...prev,
                  detailsBoxDisplay: {
                    ...prev.detailsBoxDisplay,
                    [selection]: !prev.detailsBoxDisplay[selection],
                  },
                }));
              }}
            />
          )
        )}
      </div>
      <button
        id="close-settings-panel"
        data-testid={testIdPrefix ? `${testIdPrefix}-close` : undefined}
        onClick={() => closeSettingsPanel()}
      >
        <span>
          <X />
        </span>
      </button>
    </div>
  );
};

export default SettingsPanel;
