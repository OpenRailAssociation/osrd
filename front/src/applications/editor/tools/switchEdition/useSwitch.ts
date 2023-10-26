import { useContext, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { first, keyBy } from 'lodash';
import { SwitchEntity } from 'types';
import EditorContext from 'applications/editor/context';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { SwitchEditionState, useSwitchTypes } from './types';
import { ExtendedEditorContextType } from '../editorContextTypes';
import { getSwitchTypeJSONSchema, switchToFlatSwitch } from './utils';

// TODO : Rename all switch by tracknode when back renaming PR merged
const useSwitch = () => {
  const { state, editorState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SwitchEditionState>;

  // Retrieve base JSON schema:
  const baseSchema = editorState.editorSchema.find((e) => e.objType === 'Switch')?.schema;

  // Retrieve proper data
  const infraId = useSelector(getInfraID);
  const switchTypes = useSwitchTypes(infraId);

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
