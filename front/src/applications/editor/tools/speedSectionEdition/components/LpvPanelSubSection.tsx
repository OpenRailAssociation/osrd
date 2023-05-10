import React from 'react';
import { LPVPanel } from 'types';
import { TFunction } from 'i18next';
import { FaPlus } from 'react-icons/fa';
import { LPV_PANEL_TYPES, LpvPanelInformation } from '../types';
import LpvPanelCard from './LpvPanelCard';

const LpvPanelSubSection = ({
  panelType,
  panels,
  addPanel,
  removePanel,
  selectPanel,
  t,
  updatePanel,
}: {
  panelType: LPV_PANEL_TYPES.ANNOUNCEMENT | LPV_PANEL_TYPES.R;
  panels: LPVPanel[];
  addPanel: (panelType: LPV_PANEL_TYPES.ANNOUNCEMENT | LPV_PANEL_TYPES.R) => void;
  updatePanel: (panelInfo: LpvPanelInformation, panel: LPVPanel) => void;
  removePanel?: (panelInfo: Exclude<LpvPanelInformation, { panelType: LPV_PANEL_TYPES.Z }>) => void;
  selectPanel: (panelInfo: LpvPanelInformation) => void;
  t: TFunction;
}) => (
  <div>
    <div>
      <h4>{t('Editor.tools.speed-edition.panel-category', { panelType }).toString()}</h4>
    </div>
    <button
      type="button"
      className="btn btn-primary btn-sm px-2 d-flex align-items-center"
      onClick={() => addPanel(panelType)}
    >
      <FaPlus />
      <span className="ml-1">
        {t('Editor.tools.speed-edition.add-panel', { panelType }).toString()}
      </span>
    </button>
    {panels.map((panel, panelIndex) => (
      <LpvPanelCard
        key={`${panelType}-${panelIndex}`}
        panel={panel}
        panelInfo={{ panelType, panelIndex }}
        removePanel={removePanel}
        selectPanel={selectPanel}
        t={t}
        updatePanel={updatePanel}
      />
    ))}
  </div>
);

export default LpvPanelSubSection;
