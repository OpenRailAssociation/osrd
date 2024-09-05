import { type ComponentType, useContext, useEffect, useRef, useState } from 'react';

import along from '@turf/along';
import length from '@turf/length';
import { uniqueId } from 'lodash';
import { useTranslation } from 'react-i18next';

import EditorForm from 'applications/editor/components/EditorForm';
import EntityError from 'applications/editor/components/EntityError';
import type { EditoastType } from 'applications/editor/consts';
import EditorContext from 'applications/editor/context';
import { getEntity } from 'applications/editor/data/api';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type {
  BufferStopEntity,
  DetectorEntity,
  SignalingSystemForm,
  PointEditionState,
  SignalEntity,
} from 'applications/editor/tools/pointEdition/types';
import { formatSignalingSystem } from 'applications/editor/tools/pointEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import { useInfraID } from 'common/osrdContext';
import { save } from 'reducers/editor/thunkActions';
import { useAppDispatch } from 'store';

import CustomFlagSignalCheckbox from './CustomFlagSignalCheckbox';
import CustomPosition from './CustomPosition';
import RoutesList from './RoutesList';
import type { TrackSectionEntity } from '../../trackEdition/types';

type EditorPoint = BufferStopEntity | DetectorEntity | SignalEntity;

interface PointEditionLeftPanelProps {
  type: EditoastType;
}

/**
 * Generic component for point edition left panel:
 */
const PointEditionLeftPanel = <Entity extends EditorEntity>({
  type,
}: PointEditionLeftPanelProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const { state, setState, isFormSubmited, setIsFormSubmited } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<PointEditionState<Entity>>;
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const [formKey, setFormKey] = useState(state.initialEntity.properties.id);

  const isWayPoint = type === 'BufferStop' || type === 'Detector';
  const isNew = state.entity.properties.id === NEW_ENTITY_ID;

  const [trackState, setTrackState] = useState<
    | { type: 'idle'; id?: undefined; track?: undefined }
    | { type: 'isLoading'; id: string; track?: undefined }
    | { type: 'ready'; id: string; track: TrackSectionEntity }
  >({ type: 'idle' });

  // Hack to be able to launch the submit event from the rjsf form by using
  // the toolbar button instead of the form one.
  // See https://github.com/rjsf-team/react-jsonschema-form/issues/500
  useEffect(() => {
    if (isFormSubmited && setIsFormSubmited && submitBtnRef.current) {
      submitBtnRef.current.click();
      setIsFormSubmited(false);
    }
  }, [isFormSubmited]);

  useEffect(() => {
    const firstLoading = trackState.type === 'idle';
    const trackId = state.entity.properties.track as string | undefined;

    if (trackId && trackState.id !== trackId) {
      setTrackState({ type: 'isLoading', id: trackId });
      getEntity<TrackSectionEntity>(infraID as number, trackId, 'TrackSection', dispatch).then(
        (track) => {
          setTrackState({ type: 'ready', id: trackId, track });

          if (!firstLoading) {
            const { position } = state.entity.properties;
            const turfPosition =
              (position * length(track, { units: 'meters' })) / track.properties.length;
            const point = along(track, turfPosition, { units: 'meters' });

            setState({ ...state, entity: { ...state.entity, geometry: point.geometry } });
          }
        }
      );
    }
  }, [infraID, setState, state, state.entity.properties.track, trackState.id, trackState.type]);

  /**
   * When the ref of the initialEntity changed,
   * we remount the form (to reset its state, mainly for errors)
   */
  useEffect(() => {
    setFormKey(uniqueId());
  }, [state.initialEntity]);

  return (
    <>
      {isWayPoint && !isNew && (
        <>
          <h3>{t('Editor.tools.point-edition.linked-routes')}</h3>
          <RoutesList type={type} id={state.entity.properties.id} />
          <div className="border-bottom" />
        </>
      )}
      <EditorForm
        key={formKey}
        data={state.entity as Entity}
        overrideUiSchema={{
          logical_signals: {
            items: {
              signaling_system: {
                'ui:widget': 'hidden',
              },
              default_parameters: {
                jaune_cli: {
                  'ui:description': ' ',
                  'ui:widget': CustomFlagSignalCheckbox,
                },
              },
              conditional_parameters: {
                items: {
                  parameters: {
                    jaune_cli: {
                      'ui:description': ' ',
                      'ui:widget': CustomFlagSignalCheckbox,
                    },
                  },
                },
              },
              settings: {
                'ui:description': ' ',
                Nf: {
                  'ui:description': ' ',
                  'ui:widget': CustomFlagSignalCheckbox,
                },
                distant: {
                  'ui:description': ' ',
                  'ui:widget': CustomFlagSignalCheckbox,
                },
                is_430: {
                  'ui:description': ' ',
                  'ui:widget': CustomFlagSignalCheckbox,
                },
              },
            },
          },
          position: {
            'ui:widget': CustomPosition,
          },
        }}
        onSubmit={async (savedEntity) => {
          const res = await dispatch(
            save(
              infraID,
              state.entity.properties.id !== NEW_ENTITY_ID
                ? {
                    update: [
                      {
                        source: state.initialEntity,
                        target: savedEntity,
                      },
                    ],
                  }
                : { create: [savedEntity] }
            )
          );
          const { railjson } = res[0];
          const { id } = railjson;
          if (id && id !== savedEntity.properties.id) {
            const saveEntity = {
              ...state.entity,
              id,
              properties: {
                ...state.entity.properties,
                ...railjson,
              },
            };
            setState({
              ...state,
              initialEntity: saveEntity,
              entity: saveEntity,
            });
          }
        }}
        onChange={(entity: Entity | EditorPoint) => {
          const additionalUpdate: Partial<EditorPoint> = {};
          const additionalPropertiesUpdate: Partial<SignalEntity['properties']> = {};
          const newPosition = entity.properties?.position;
          const oldPosition = state.entity.properties?.position;
          const trackId = entity.properties?.track;
          if (
            typeof trackId === 'string' &&
            trackId === trackState.id &&
            trackState.type === 'ready' &&
            typeof newPosition === 'number' &&
            typeof oldPosition === 'number' &&
            newPosition !== oldPosition
          ) {
            const turfPosition =
              (newPosition * length(trackState.track, { units: 'meters' })) /
              trackState.track.properties.length;
            const point = along(trackState.track, turfPosition, { units: 'meters' });
            additionalUpdate.geometry = point.geometry;
          }
          if (entity.objType === 'Signal' && entity.properties.logical_signals) {
            additionalPropertiesUpdate.logical_signals = (
              entity.properties.logical_signals as SignalingSystemForm[]
            ).map((logicalSignal) => formatSignalingSystem(logicalSignal));
          }

          setState({
            ...state,
            entity: {
              ...(entity as Entity),
              ...additionalUpdate,
              properties: { ...(entity as Entity).properties, ...additionalPropertiesUpdate },
            },
          });
        }}
      >
        <div>
          {/* We don't want to see the button but just be able to click on it */}
          <button type="submit" ref={submitBtnRef} style={{ display: 'none' }}>
            {t('common.save')}
          </button>
        </div>
      </EditorForm>

      {!isNew && <EntityError className="mt-1" entity={state.entity} />}
    </>
  );
};

const getPointEditionLeftPanel =
  (type: EditoastType): ComponentType =>
  () => <PointEditionLeftPanel type={type} />;

export default getPointEditionLeftPanel;
