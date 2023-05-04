import React, { useContext } from 'react';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { cloneDeep, flatMap } from 'lodash';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { LPVPanel, SpeedSectionEntity } from 'types';
import { useTranslation } from 'react-i18next';
import { ExtendedEditorContextType } from '../../types';
import { SpeedSectionEditionState } from '../types';
import EditorContext from 'applications/editor/context';
import { LPV_PANEL_TYPES } from '../types';

// const LPVDetails = ({ lpv_panel }: { lpv_panel: LPVPanel }) => {
//   return (
//     <div className="my-4">
//       <div>{t('Editor.obj-types.LPVPanel')}</div>
//       <div className="mb-2">{lpv_panel.type}</div>
//       <label htmlFor="lpv-position">Position</label>
//       <input id="lpv-position" value={lpv_panel.position} />
//       <div className="mb-2">Track id : {lpv_panel.track}</div>
//       <div className="mb-2">Side : {lpv_panel.side}</div>
//       <SelectImprovedSNCF
//         sm
//         options={['LEFT', 'RIGHT']}
//         onChange={(e) => {}}
//         selectedValue={lpv_panel.side}
//       />
//       <button type="button" className="btn btn-danger btn-sm px-2">
//         <FaTrash />
//       </button>
//     </div>
//   );
// };

// const LPVList = ({ entity }: { entity: SpeedSectionEntity }) => {
//   const LPVs = entity.properties.extensions?.lpv_sncf;

//   const panels = flatMap(LPVs);

//   return (
//     <>
//       <div>LPV Panels</div>
//       <button type="button" className="btn btn-primary btn-sm px-2">
//         <FaPlus />
//       </button>
//       {LPVs && panels.map((panel) => <LPVDetails lpv_panel={panel} />)}
//     </>
//   );
// };

// const EditLPVSection = ({ entity }: { entity: SpeedSectionEntity }) => <LPVList entity={entity} />;
const EditLPVSection = () => {
  const { t } = useTranslation();
  const {
    setState,
    state: { entity, initialEntity },
  } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;

  const LPVs = entity.properties.extensions?.lpv_sncf;

  const panels = flatMap(LPVs);

  return (
    <div>
      <h3>Liste des panneaux de la section</h3>
      <button type="button" className="btn btn-primary btn-sm px-2">
        <FaPlus />
      </button>
      {LPVs &&
        panels.map((panel) => (
          <div className="my-4">
            <div>{t('Editor.obj-types.LPVPanel')}</div>
            <div className="mb-2">Type : {panel.type}</div>
            {/* <label htmlFor="lpv-position">Position</label>
            <input id="lpv-position" value={panel.position} /> */}
            <div className="mb-2">Track id : {panel.track}</div>
            <div className="mb-2">Side : {panel.side}</div>
            <SelectImprovedSNCF
              title="Position"
              sm
              options={['LEFT', 'RIGHT']}
              onChange={(e) => {
                const newEntity = cloneDeep(entity);
                const newSide =
                  newEntity.properties.extensions?.lpv_sncf[panel.type as LPV_PANEL_TYPES];
                const newRange = (newEntity.properties.track_ranges || [])[i];
                newRange.applicable_directions = e.target.value as ApplicableDirection;
                setState({ entity: newEntity, hoveredItem: null });
              }}
              selectedValue={panel.side}
            />
            <button type="button" className="btn btn-danger btn-sm px-2">
              <FaTrash />
            </button>
          </div>
        ))}
    </div>
  );
};

export default EditLPVSection;
