import { useContext, useMemo } from 'react';

import { first, keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
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
        label: t('Editor.tools.switch-edition.switch_type_w_port_count', {
          count: type.ports.length,
          type: t(`Editor.tools.switch-edition.${type.id}`),
        }),
      })),
    [switchTypes, i18n.language]
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
