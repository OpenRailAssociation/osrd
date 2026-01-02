import { useContext } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';

import EntityError from 'applications/editor/components/EntityError';
import EditorContext from 'applications/editor/context';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import ElectrificationMetadataForm from 'applications/editor/tools/rangeEdition/electrification/ElectrificationMetadataForm';
import type {
  RangeEditionState,
  ElectrificationEntity,
} from 'applications/editor/tools/rangeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';

import TrackRangesList from '../components/TrackRangeList';

const ElectrificationEditionLeftPanel = () => {
  const { t } = useTranslation();
  const {
    state: { entity },
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<ElectrificationEntity>
  >;

  const isNew = entity.properties.id === NEW_ENTITY_ID;
  const infraID = useInfraID();

  const { data: voltages } = osrdEditoastApi.endpoints.getInfraByInfraIdVoltages.useQuery(
    infraID
      ? {
          infraId: infraID,
        }
      : skipToken
  );

  return (
    <div>
      <legend className="mb-4">{t(`Editor.obj-types.Electrification`)}</legend>
      {voltages && <ElectrificationMetadataForm voltages={voltages} />}
      <hr />
      <TrackRangesList />
      {!isNew && <EntityError className="mt-1" entity={entity} />}
    </div>
  );
};

export default ElectrificationEditionLeftPanel;
