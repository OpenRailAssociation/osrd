import React, { FC, useContext, useMemo } from 'react';
import { WidgetProps } from '@rjsf/core';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';
import { first } from 'lodash';

import { EditorContext } from '../../context';
import { EditorContextType, ExtendedEditorContextType, OSRDConf } from '../types';
import { CreateEntityOperation, Item, SwitchEntity, SwitchType } from '../../../../types';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import { SwitchEditionState } from './types';
import EditorForm from '../../components/EditorForm';
import { save } from '../../../../reducers/editor';
import {
  FlatSwitchEntity,
  flatSwitchToSwitch,
  getNewSwitch,
  getSwitchTypeJSONSchema,
  isSwitchValid,
  switchToFlatSwitch,
} from './utils';

export const TrackSectionEndpointSelector: FC<WidgetProps> = () => {
  return null;
};

export const SwitchEditionLeftPanel: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { state, setState, editorState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SwitchEditionState>;

  // Retrieve base JSON schema:
  const baseSchema = editorState.editorSchema.find((e) => e.objType === 'Switch')?.schema;

  // Retrieve proper data
  const { switchTypes } = useSelector(({ osrdconf }: { osrdconf: OSRDConf }) => osrdconf);
  const switchEntity = state.entity as SwitchEntity;
  const isNew = !!switchEntity.id;
  const switchType = useMemo(
    () =>
      switchTypes?.find((type) => type.id === switchEntity.properties.switch_type?.id) ||
      (first(switchTypes || []) as SwitchType),
    [switchEntity.properties.switch_type?.id, switchTypes]
  );
  const flatSwitchEntity = useMemo(
    () => switchToFlatSwitch(switchType, switchEntity),
    [switchEntity, switchType]
  );
  const switchTypeJSONSchema = useMemo(
    () => baseSchema && getSwitchTypeJSONSchema(baseSchema, switchType),
    [baseSchema, switchType]
  );

  return (
    <div>
      <legend>Switch Type</legend>
      <Select<SwitchType>
        options={switchTypes || []}
        value={switchType}
        onChange={(value) => {
          if (value) {
            const newEntity = getNewSwitch(value);
            setState({
              ...state,
              entity: newEntity,
              initialEntity: newEntity,
            });
          }
        }}
        isDisabled={!isNew}
      />
      <hr />
      <EditorForm
        data={flatSwitchEntity}
        overrideSchema={switchTypeJSONSchema}
        onSubmit={async (flatSwitch) => {
          const entityToSave = flatSwitchToSwitch(switchType, flatSwitch as FlatSwitchEntity);
          const res = await dispatch(
            save(
              entityToSave.id
                ? {
                    update: [
                      {
                        source: editorState.editorDataIndex[entityToSave.id as string],
                        target: entityToSave,
                      },
                    ],
                  }
                : { create: [entityToSave] }
            )
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const operation = res[0] as any as CreateEntityOperation;
          const { id } = operation.railjson;

          if (id && id !== entityToSave.id) setState({ ...state, entity: { ...entityToSave, id } });
        }}
        onChange={(flatSwitch) => {
          setState({
            ...state,
            entity: flatSwitchToSwitch(switchType, flatSwitch as FlatSwitchEntity),
          });
        }}
      >
        <div className="text-right">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!switchType || !isSwitchValid(switchEntity, switchType)}
          >
            {t('common.save')}
          </button>
        </div>
      </EditorForm>
    </div>
  );
};

export const SwitchEditionLayers: FC = () => {
  const {
    state: { entity },
  } = useContext(EditorContext) as EditorContextType<SwitchEditionState>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  // TODO:
  // Display currently edited switch

  return (
    <>
      {/* Zone display */}
      <EditorZone />

      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={entity.id ? [entity as Item] : undefined}
        selection={
          entity.id
            ? [entity as Item]
            : [
                {
                  ...entity,
                  id: 'NEW SIGNAL',
                } as Item,
              ]
        }
      />
    </>
  );
};
