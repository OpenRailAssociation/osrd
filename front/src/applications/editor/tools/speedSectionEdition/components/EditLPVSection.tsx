import { flatMap } from 'lodash';
import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { LPVPanel, SpeedSectionEntity } from 'types';

const LPVDetails = ({ lpv_panel }: { lpv_panel: LPVPanel }) => (
  <div className="my-4">
    <div className="mb-2">{lpv_panel.type}</div>
    <label htmlFor="lpv-position">Position</label>
    <input id="lpv-position" value={lpv_panel.position} />
    <div className="mb-2">Track id : {lpv_panel.track}</div>
    <div className="mb-2">Side : {lpv_panel.side}</div>
    <button type="button" className="btn btn-danger btn-sm px-2">
      <FaTrash />
    </button>
  </div>
);

const LPVList = ({ entity }: { entity: SpeedSectionEntity }) => {
  const LPVs = entity.properties.extensions?.lpv_sncf;

  const panels = flatMap(LPVs);

  return (
    <>
      <div>LPV Panels</div>
      <button type="button" className="btn btn-primary btn-sm px-2">
        <FaPlus />
      </button>
      {LPVs && panels.map((panel) => <LPVDetails lpv_panel={panel} />)}
    </>
  );
};

const EditLPVSection = ({ entity }: { entity: SpeedSectionEntity }) => <LPVList entity={entity} />;

export default EditLPVSection;
