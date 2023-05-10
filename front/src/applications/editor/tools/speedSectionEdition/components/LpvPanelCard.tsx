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
  return (
    <>
      {panelType === LPV_PANEL_TYPES.Z && (
        <h4 className="mt-4">{`${t('Editor.tools.speed-edition.panel-category', {
          panelType,
        })}`}</h4>
      )}
      <div className="my-4 py-2 px-2" style={{ backgroundColor: 'white' }}>
        {/* <div className="my-2"> */}
        <InputSNCF
          type="text"
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
        {/* </div> */}
        <div className="my-2">
          <InputSNCF
            type="text"
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
          {panelType !== LPV_PANEL_TYPES.Z ? (
            <InputSNCF
              type="text"
              id="lpv-position"
              label={t('Editor.tools.speed-edition.panel-position')}
              value={!isNil(panel.position) ? panel.position : 0}
              onChange={(e) =>
                updatePanel(panelInfo, {
                  ...panel,
                  position: Number(e.target.value),
                })
              }
              sm
            />
          ) : (
            <InputSNCF
              type="text"
              id="lpv-position-from-the-beginning"
              label={t('Editor.tools.speed-edition.panel-position')}
              value={panel.position}
              onChange={(e) =>
                updatePanel(panelInfo, {
                  ...panel,
                  position: Number(e.target.value),
                })
              }
              sm
            />
          )}
        </div>
        {panelType === LPV_PANEL_TYPES.ANNOUNCEMENT && (
          <>
            <div className="my-2">
              <InputSNCF
                type="text"
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
            options={['LEFT', 'RIGHT']}
            onChange={() =>
              updatePanel(panelInfo, { ...panel, side: panel.side === 'LEFT' ? 'RIGHT' : 'LEFT' })
            }
            selectedValue={panel.side}
          />
        </div>
        <div>
          <span>{`${t('Editor.tools.speed-edition.panel-select')}`}</span>
          <button
            type="button"
            className="btn btn-sm px-2 ml-2"
            onClick={() => selectPanel(panelInfo)}
          >
            <RiDragMoveLine />
          </button>
        </div>
        {panelType !== LPV_PANEL_TYPES.Z && removePanel && (
          <div className="  mt-2">
            <span>{`${t('Editor.tools.speed-edition.panel-remove')}`}</span>
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
