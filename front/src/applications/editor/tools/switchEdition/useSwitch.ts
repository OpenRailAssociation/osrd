import { useContext, useMemo } from 'react';

import { first, keyBy } from 'lodash';

import EditorContext from 'applications/editor/context';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type {
  SwitchEditionState,
  SwitchEntity,
} from 'applications/editor/tools/switchEdition/types';
import useSwitchTypes from 'applications/editor/tools/switchEdition/useSwitchTypes';
import {
  getSwitchTypeJSONSchema,
  switchToFlatSwitch,
} from 'applications/editor/tools/switchEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { useInfraID } from 'common/osrdContext';

// TODO : Rename all switch by tracknode when back renaming PR merged
const useSwitch = () => {
  const { state, editorState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SwitchEditionState>;

  // Retrieve base JSON schema:
  const baseSchema = editorState.editorSchema.find((e) => e.objType === 'Switch')?.schema;

  // Retrieve proper data
  const infraID = useInfraID();
  const { data: switchTypes } = useSwitchTypes(infraID);

  const switchTypesDict = useMemo(() => keyBy(switchTypes, 'id'), [switchTypes]);
  const switchTypeOptions = useMemo(
    () =>
      switchTypes.map((type) => ({
        value: type.id,
        label: `${type.id} (${type.ports.length} port${type.ports.length > 1 ? 's' : ''})`,
      })),
    [switchTypes]
  );
  const switchTypeOptionsDict = useMemo(
    () => keyBy(switchTypeOptions, 'value'),
    [switchTypeOptions]
  );
  const switchEntity = state.entity as SwitchEntity;
  const isNew = switchEntity.properties.id === NEW_ENTITY_ID;
  const switchType = useMemo(
    () =>
      switchTypes.find((type) => type.id === switchEntity.properties.switch_type) ||
      first(switchTypes),
    [switchEntity.properties.switch_type, switchTypes]
  );
  const flatSwitchEntity = useMemo(
    () => switchType && switchToFlatSwitch(switchType, switchEntity),
    [switchEntity, switchType]
  );
  const switchTypeJSONSchema = useMemo(
    () => switchType && baseSchema && getSwitchTypeJSONSchema(baseSchema, switchType),
    [baseSchema, switchType]
  );

  return {
    switchEntity,
    flatSwitchEntity,
    switchType,
    switchTypesDict,
    switchTypeOptions,
    switchTypeOptionsDict,
    switchTypeJSONSchema,
    isNew,
  };
};

export default useSwitch;
