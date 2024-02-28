import { useContext, useMemo } from 'react';
import { first, keyBy } from 'lodash';

import type { TrackNodeEntity } from 'types';

import EditorContext from 'applications/editor/context';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { useTrackNodeTypes } from 'applications/editor/tools/trackNodeEdition/types';
import type { TrackNodeEditionState } from 'applications/editor/tools/trackNodeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/tools/editorContextTypes';
import {
  getTrackNodeTypeJSONSchema,
  trackNodeToFlatTrackNode,
} from 'applications/editor/tools/trackNodeEdition/utils';

import { useInfraID } from 'common/osrdContext';

const useTrackNode = () => {
  const { state, editorState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<TrackNodeEditionState>;

  // Retrieve base JSON schema:
  const baseSchema = editorState.editorSchema.find((e) => e.objType === 'TrackNode')?.schema;

  // Retrieve proper data
  const infraID = useInfraID();
  const trackNodeTypes = useTrackNodeTypes(infraID);

  const trackNodeTypesDict = useMemo(() => keyBy(trackNodeTypes, 'id'), [trackNodeTypes]);
  const trackNodeTypeOptions = useMemo(
    () =>
    trackNodeTypes.map((type) => ({
        value: type.id,
        label: `${type.id} (${type.ports.length} port${type.ports.length > 1 ? 's' : ''})`,
      })),
    [trackNodeTypes]
  );
  const trackNodeTypeOptionsDict = useMemo(
    () => keyBy(trackNodeTypeOptions, 'value'),
    [trackNodeTypeOptions]
  );
  const trackNodeEntity = state.entity as TrackNodeEntity;
  const isNew = trackNodeEntity.properties.id === NEW_ENTITY_ID;
  const trackNodeType = useMemo(
    () =>
    trackNodeTypes.find((type) => type.id === trackNodeEntity.properties.track_node_type) ||
      first(trackNodeTypes),
    [trackNodeEntity.properties.track_node_type, trackNodeTypes]
  );
  const flatTrackNodeEntity = useMemo(
    () => trackNodeType && trackNodeToFlatTrackNode(trackNodeType, trackNodeEntity),
    [trackNodeEntity, trackNodeType]
  );
  const trackNodeTypeJSONSchema = useMemo(
    () => trackNodeType && baseSchema && getTrackNodeTypeJSONSchema(baseSchema, trackNodeType),
    [baseSchema, trackNodeType]
  );

  return {
    trackNodeEntity,
    flatTrackNodeEntity,
    trackNodeType,
    trackNodeTypesDict,
    trackNodeTypeOptions,
    trackNodeTypeOptionsDict,
    trackNodeTypeJSONSchema,
    isNew,
  };
};

export default useTrackNode;
