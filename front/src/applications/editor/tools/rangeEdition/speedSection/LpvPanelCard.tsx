import React from 'react';
import { TFunction } from 'i18next';
import { LPVPanel } from 'types';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { FaTrash } from 'react-icons/fa';
import { isNil } from 'lodash';
import { RiDragMoveLine } from 'react-icons/ri';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { LPV_PANEL_TYPES, LpvPanelInformation } from '../types';

const LpvPanelCard = ({
  panel,
  panelInfo,
  t,
  removePanel,
  selectPanel,
  updatePanel,
}: {
  panel: LPVPanel;
  panelInfo: LpvPanelInformation;
  t: TFunction;
  removePanel?: (panelInfo: Exclude<LpvPanelInformation, { panelType: LPV_PANEL_TYPES.Z }>) => void;
  selectPanel: (panelInfo: LpvPanelInformation) => void;
  updatePanel: (panelInfo: LpvPanelInformation, panel: LPVPanel) => void;
}) => {
  const { panelType } = panelInfo;
  const roundedPosition = Math.round(panel.position);
  return (
    <>
      {panelType === LPV_PANEL_TYPES.Z && (
        <h4 className="mt-4">
          {t('Editor.tools.speed-edition.panel-category', {
            panelType,
          }).toString()}
        </h4>
      )}
      <div className="my-4 py-2 px-2" style={{ backgroundColor: 'white' }}>
        <InputSNCF
          type="number"
          id="lpv-angle-geo"
          label={t('Editor.tools.speed-edition.panel-angle-geo')}
          value={!isNil(panel.angle_geo) ? panel.angle_geo : 0}
          onChange={(e) =>
            updatePanel(panelInfo, {
              ...panel,
              angle_geo: Number(e.target.value),
            })
          }
          sm
        />
        <div className="my-2">
          <InputSNCF
            type="number"
            id="lpv-angle-sch"
            label={t('Editor.tools.speed-edition.panel-angle-sch')}
            value={!isNil(panel.angle_sch) ? panel.angle_sch : 0}
            onChange={(e) =>
              updatePanel(panelInfo, {
                ...panel,
                angle_sch: Number(e.target.value),
              })
            }
            sm
          />
        </div>
        <div className="my-2">
          <InputSNCF
            type="text"
            id="track-id"
            label={t('Editor.tools.speed-edition.panel-track-id')}
            value={!isNil(panel.track) ? panel.track : 0}
            onChange={(e) =>
              updatePanel(panelInfo, {
                ...panel,
                track: String(e.target.value),
              })
            }
            sm
          />
        </div>
        <div className="my-2">
          <InputSNCF
            type="number"
            id="lpv-position-from-the-beginning"
            label={t('Editor.tools.speed-edition.panel-position')}
            value={roundedPosition}
            onChange={(e) => {
              const newPosition = Number(e.target.value);
              const updatedPosition = newPosition >= 0 ? newPosition : 0;
              updatePanel(panelInfo, {
                ...panel,
                position: updatedPosition,
              });
            }}
            sm
          />
        </div>
        {panelType === LPV_PANEL_TYPES.ANNOUNCEMENT && (
          <>
            <div className="my-2">
              <InputSNCF
                type="number"
                id="lpv-value"
                label={t('Editor.tools.speed-edition.panel-value')}
                value={panel.value ? panel.value : ''}
                onChange={(e) =>
                  updatePanel(panelInfo, {
                    ...panel,
                    value: e.target.value,
                  })
                }
                sm
              />
            </div>
            <div className="my-2">
              <SelectImprovedSNCF
                sm
                title={t('Editor.tools.speed-edition.panel-type')}
                options={['TIV_B', 'TIV_D']}
                selectedValue={panel.type}
                onChange={() =>
                  updatePanel(panelInfo, {
                    ...panel,
                    type: panel.type === 'TIV_B' ? 'TIV_D' : 'TIV_B',
                  })
                }
              />
            </div>
          </>
        )}
        <div className="my-2">
          <SelectImprovedSNCF
            title={t('Editor.tools.speed-edition.panel-side')}
            sm
            options={['LEFT', 'RIGHT', 'CENTER']}
            onChange={(selectedValue) => updatePanel(panelInfo, { ...panel, side: selectedValue })}
            selectedValue={panel.side}
          />
        </div>
        <div className="mt-2">
          <span>{t('Editor.tools.speed-edition.panel-select').toString()}</span>
          <button
            type="button"
            className="btn btn-sm px-2 ml-2"
            onClick={() => selectPanel(panelInfo)}
          >
            <RiDragMoveLine />
          </button>
        </div>
        {panelType !== LPV_PANEL_TYPES.Z && removePanel && (
          <div className="mt-2">
            <span>{t('Editor.tools.speed-edition.panel-remove').toString()}</span>
            <button
              type="button"
              className="btn btn-danger btn-sm px-2 ml-2"
              onClick={() => removePanel(panelInfo)}
            >
              <FaTrash />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default LpvPanelCard;
