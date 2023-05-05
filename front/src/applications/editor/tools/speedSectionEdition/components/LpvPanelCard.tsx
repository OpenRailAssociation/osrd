import React from 'react';
import { TFunction } from 'i18next';
import { LPVPanel } from 'types';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { FaTrash } from 'react-icons/fa';
import { LPV_PANEL_TYPES, LpvPanelInformation } from '../types';

const LpvPanelCard = ({
  panel,
  panelInfo,
  t,
  removePanel,
  updatePanel,
}: {
  panel: LPVPanel;
  panelInfo: LpvPanelInformation;
  t: TFunction;
  removePanel?: (panelInfo: Exclude<LpvPanelInformation, { panelType: LPV_PANEL_TYPES.Z }>) => void;
  updatePanel: (panelInfo: LpvPanelInformation, panel: LPVPanel) => void;
}) => {
  const { panelType } = panelInfo;
  return (
    <div className="my-4 py-4 px-2" style={{ backgroundColor: 'white' }}>
      <div className="">Track id : {panel.track}</div>
      <div className="">Position from the beginning of the track : {panel.position}</div>
      {panelType === LPV_PANEL_TYPES.ANNOUNCEMENT && (
        <>
          <div className="">Type: {panel.type}</div>
          <div className="">Value: {panel.value}</div>
        </>
      )}
      <SelectImprovedSNCF
        inline
        title="Side"
        sm
        options={['LEFT', 'RIGHT']}
        onChange={() =>
          updatePanel(panelInfo, { ...panel, side: panel.side === 'LEFT' ? 'RIGHT' : 'LEFT' })
        }
        selectedValue={panel.side}
      />
      {panelType !== LPV_PANEL_TYPES.Z && removePanel && (
        <button
          type="button"
          className="btn btn-danger btn-sm px-2"
          onClick={() => removePanel(panelInfo)}
        >
          <FaTrash />
        </button>
      )}
    </div>
  );
};

export default LpvPanelCard;
