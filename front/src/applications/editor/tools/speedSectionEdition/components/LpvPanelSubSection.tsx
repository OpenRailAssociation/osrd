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
  t,
  updatePanel,
}: {
  panelType: LPV_PANEL_TYPES.ANNOUNCEMENT | LPV_PANEL_TYPES.R;
  panels: LPVPanel[];
  addPanel: (panelType: LPV_PANEL_TYPES.ANNOUNCEMENT | LPV_PANEL_TYPES.R) => void;
  updatePanel: (panelInfo: LpvPanelInformation, panel: LPVPanel) => void;
  removePanel?: (panelInfo: Exclude<LpvPanelInformation, { panelType: LPV_PANEL_TYPES.Z }>) => void;
  t: TFunction;
}) => {
  return (
    <div>
      <h4>{panelType}</h4>
      <button
        type="button"
        className="btn btn-primary btn-sm px-2"
        onClick={() => addPanel(panelType)}
      >
        <FaPlus /> ajouter un paneau de type {panelType}
      </button>
      {panels.map((panel, panelIndex) => (
        <LpvPanelCard
          key={`${panelType}-${panelIndex}`}
          panel={panel}
          panelInfo={{ panelType, panelIndex }}
          removePanel={removePanel}
          t={t}
          updatePanel={updatePanel}
        />
      ))}
    </div>
  );
};

export default LpvPanelSubSection;
