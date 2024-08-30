import React, { useContext, useEffect, useRef, useMemo, useState } from 'react';

import type { JSONSchema7 } from 'json-schema';
import { isNil, omit, uniqueId } from 'lodash';
import { useTranslation } from 'react-i18next';

import EditorForm from 'applications/editor/components/EditorForm';
import EntityError from 'applications/editor/components/EntityError';
import { FormLineStringLength } from 'applications/editor/components/LinearMetadata';
import EditorContext from 'applications/editor/context';
import {
  NEW_ENTITY_ID,
  getJsonSchemaForLayer,
  getLayerForObjectType,
} from 'applications/editor/data/utils';
import type {
  TrackEditionState,
  TrackSectionEntity,
} from 'applications/editor/tools/trackEdition/types';
import { injectGeometry, removeInvalidRanges } from 'applications/editor/tools/trackEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { useInfraID } from 'common/osrdContext';
import { save } from 'reducers/editor/thunkActions';
import { useAppDispatch } from 'store';

import AttachedRangesItemsList from './AttachedRangesItemsList';

const TrackEditionLeftPanel = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const { state, setState, isFormSubmited, setIsFormSubmited, editorState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<TrackEditionState>;
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const [formKey, setFormKey] = useState(state.initialTrack.properties.id);
  const { track, initialTrack } = state;
  const isNew = track.properties.id === NEW_ENTITY_ID;

  // Hack to be able to launch the submit event from the rjsf form by using
  // the toolbar button instead of the form one.
  // See https://github.com/rjsf-team/react-jsonschema-form/issues/500
  useEffect(() => {
    if (isFormSubmited && setIsFormSubmited && submitBtnRef.current) {
      submitBtnRef.current.click();
      setIsFormSubmited(false);
    }
  }, [isFormSubmited]);

  const schema = useMemo(() => {
    let jsonschema = getJsonSchemaForLayer(
      editorState.editorSchema,
      getLayerForObjectType(editorState.editorSchema, track.objType) || ''
    );
    if (isNil(jsonschema)) return jsonschema;

    // Remove the source from schema if there is no source in the object
    // To avoid to display it on the form
    if (isNil(track.properties.extensions?.source)) {
      jsonschema = omit(jsonschema, ['$defs.TrackSectionExtensions.properties.source']);
    }
    // Put the length field at top
    return {
      ...jsonschema,
      properties: {
        length: jsonschema.properties?.length,
        ...omit(jsonschema.properties, ['length']),
      },
    } as JSONSchema7;
  }, [editorState.editorSchema, track.objType, track.properties.extensions?.source]);

  /**
   * When the ref of the initialEntity changed,
   * we remount the form (to reset its state, mainly for errors)
   */
  useEffect(() => {
    setFormKey(uniqueId());
  }, [state.initialTrack]);

  return (
    <>
      <EditorForm
        key={formKey}
        data={track}
        overrideSchema={schema}
        overrideUiSchema={{
          length: {
            'ui:widget': FormLineStringLength,
            'ui:classNames': 'border-bottom pb-3',
          },
          extensions: {
            source: {
              id: {
                'ui:readonly': true,
              },
              name: {
                'ui:readonly': true,
              },
            },
          },
        }}
        onSubmit={async (savedEntity) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res: any = await dispatch(
            save(
              infraID,
              track.properties.id !== NEW_ENTITY_ID
                ? {
                    update: [
                      {
                        source: state.initialTrack,
                        target: injectGeometry(savedEntity),
                      },
                    ],
                  }
                : { create: [injectGeometry(savedEntity)] }
            )
          );
          const { railjson } = res[0];
          const savedTrack = {
            objType: 'TrackSection',
            type: 'Feature',
            properties: railjson,
            geometry: railjson.geo,
          } as TrackSectionEntity;

          setState({
            ...state,
            initialTrack: savedTrack,
            track: savedTrack,
          });
        }}
        onChange={(newTrack) => {
          let checkedTrack = { ...newTrack };
          if (initialTrack.properties.length !== newTrack.properties.length) {
            const { loading_gauge_limits, slopes, curves, length: newLength } = newTrack.properties;
            const validLoadingGaugeLimits = removeInvalidRanges(loading_gauge_limits, newLength);
            const validCurves = removeInvalidRanges(curves, newLength);
            const validSlopes = removeInvalidRanges(slopes, newLength);
            checkedTrack = {
              ...checkedTrack,
              properties: {
                ...checkedTrack.properties,
                loading_gauge_limits: validLoadingGaugeLimits,
                slopes: validSlopes,
                curves: validCurves,
              },
            };
          }
          setState({
            ...state,
            track: checkedTrack as TrackSectionEntity,
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
      <div className="border-bottom" />
      {!isNew && (
        <>
          {!isNew && <EntityError className="border-bottom mb-1" entity={track} />}
          <h3>{t('Editor.tools.track-edition.attached-speed-sections')}</h3>
          <AttachedRangesItemsList id={track.properties.id} itemType="SpeedSection" />
          <div className="border-bottom" />
          <h3>{t('Editor.tools.track-edition.attached-electrifications')}</h3>
          <AttachedRangesItemsList id={track.properties.id} itemType="Electrification" />
        </>
      )}
    </>
  );
};

export default TrackEditionLeftPanel;
