import { SerializedError } from '@reduxjs/toolkit';
import cx from 'classnames';
import { isNil, toInteger } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from 'common/api/baseGeneratedApis';
import type { ObjectType } from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdActions } from 'common/osrdContext';

import type { EditorSliceActions } from 'reducers/editor';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import MapButtons from 'common/Map/Buttons/MapButtons';
import { LoaderState } from 'common/Loaders';
import MapSearch from 'common/Map/Search/MapSearch';
import Tipped from 'common/Tipped';
import { useAppDispatch } from 'store';
import { getIsLoading } from 'reducers/main/mainSelector';
import { getEditorState, getInfraLockStatus } from 'reducers/editor/selectors';
import { loadDataModel, updateTotalsIssue } from 'reducers/editor/thunkActions';
import { updateViewport, type Viewport } from 'reducers/map';
import { setFailure } from 'reducers/main';
import { extractMessageFromError } from 'utils/error';

import { getEntity, getMixedEntities } from 'applications/editor/data/api';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { useSwitchTypes } from 'applications/editor/tools/switchEdition/types';
import EditorContext from 'applications/editor/context';
import InfraErrorCorrector from 'applications/editor/components/InfraErrors/InfraErrorCorrector';
import InfraErrorMapControl from 'applications/editor/components/InfraErrors/InfraErrorMapControl';
import Map from 'applications/editor/Map';
import type { CommonToolState } from 'applications/editor/tools/types';
import type { switchProps } from 'applications/editor/tools/switchProps';
import { centerMapOnObject, selectEntities } from 'applications/editor/tools/utils';
import TOOLS from 'applications/editor/tools/constsTools';
import TOOL_NAMES from 'applications/editor/tools/constsToolNames';

import type { EditoastType } from './consts';
import type { EditorContextType, ExtendedEditorContextType, FullTool, Reducer } from './types';
import type { EditorEntity } from './typesEditorEntity';

const Editor = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { openModal, closeModal } = useModal();
  const { updateInfraID, selectLayers } = useOsrdActions() as EditorSliceActions;
  const mapRef = useRef<MapRef>(null);
  const { urlInfra } = useParams();
  const infraID = useInfraID();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLocked = useSelector(getInfraLockStatus);
  const isLoading = useSelector(getIsLoading);
  const editorState = useSelector(getEditorState);
  const switchTypes = useSwitchTypes(infraID);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [toolAndState, setToolAndState] = useState<FullTool<any>>({
    tool: TOOLS[TOOL_NAMES.SELECTION],
    state: TOOLS[TOOL_NAMES.SELECTION].getInitialState({ infraID, switchTypes }),
  });
  const [isSearchToolOpened, setIsSearchToolOpened] = useState(false);
  const [renderingFingerprint, setRenderingFingerprint] = useState(Date.now());
  const forceRender = useCallback(() => {
    setRenderingFingerprint(Date.now());
  }, [setRenderingFingerprint]);

  const [isFormSubmited, setIsFormSubmited] = useState(false);

  const switchTool = useCallback(
    ({ toolType, toolState }: switchProps) => {
      const tool = TOOLS[toolType];
      const state = {
        ...tool.getInitialState({ infraID, switchTypes }),
        ...(toolState || {}),
      };
      setToolAndState({
        tool,
        state,
      });
    },
    [infraID, switchTypes, setToolAndState]
  );

  const setToolState = useCallback(
    <S extends CommonToolState>(stateOrReducer: Partial<S> | Reducer<S>) => {
      setToolAndState((s) => ({
        ...s,
        state: {
          ...s.state,
          ...(typeof stateOrReducer === 'function' ? stateOrReducer(s.state) : stateOrReducer),
        },
      }));
    },
    [setToolAndState]
  );

  const resetState = useCallback(() => {
    switchTool({ toolType: TOOL_NAMES.SELECTION, toolState: {} });
    forceRender();
  }, [switchTool, forceRender]);

  const { mapStyle, viewport } = useSelector(
    (state: { map: { mapStyle: string; viewport: Viewport } }) => state.map
  );

  const setViewport = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateViewport(value));
    },
    [dispatch]
  );

  const resetPitchBearing = () => {
    setViewport({
      ...viewport,
      bearing: 0,
      pitch: 0,
    });
  };

  const context = useMemo<EditorContextType<CommonToolState>>(
    () => ({
      t,
      openModal,
      closeModal,
      activeTool: toolAndState.tool,
      state: toolAndState.state,
      setState: setToolState,
      switchTool,
      forceRender,
      renderingFingerprint,
    }),
    [
      setToolState,
      toolAndState,
      openModal,
      closeModal,
      infraID,
      t,
      forceRender,
      renderingFingerprint,
    ]
  );
  const extendedContext = useMemo<ExtendedEditorContextType<CommonToolState>>(
    () => ({
      ...context,
      dispatch,
      editorState,
      infraID,
      isInfraLocked: isLocked,
      isLoading,
      isFormSubmited,
      setIsFormSubmited,
      switchTypes,
      mapState: {
        viewport,
        mapStyle,
      },
    }),
    [
      context,
      dispatch,
      editorState,
      mapStyle,
      infraID,
      switchTypes,
      viewport,
      isLoading,
      isLocked,
      isFormSubmited,
      setIsFormSubmited,
    ]
  );

  const actionsGroups = useMemo(
    () =>
      toolAndState.tool.actions
        .map((group) =>
          group.filter((action) => !action.isHidden || !action.isHidden(extendedContext))
        )
        .filter((group) => group.length),
    [toolAndState.tool]
  );
  /**
   * When the component mounts
   * => we load the data model
   * => we check if url has no infra and the store one => navigate to the good url
   */
  useEffect(() => {
    // load the data model
    dispatch(loadDataModel());
    if (isNil(urlInfra) && !isNil(infraID)) {
      navigate(`/editor/${infraID}`);
    }
  }, []);

  /**
   * When the component mounts
   * => get the searchParams
   * => if there is a selection param, select the entities and focus on them
   */
  useEffect(() => {
    if (urlInfra) {
      const params = searchParams.get('selection');
      if (!params && searchParams.size !== 0) {
        dispatch(
          setFailure({
            name: t('translation:Editor.tools.select-items.errors.unable-to-select'),
            message: t('translation:Editor.tools.select-items.errors.invalid-url'),
          })
        );
        navigate(`/editor/${urlInfra}`);
      }
      const paramsList = params?.split('|');

      if (paramsList && paramsList.length) {
        const selectedEntities = paramsList.map((param) => {
          const [objType, entityId] = param.split('~');
          return {
            id: entityId,
            type: objType as EditoastType,
          };
        });

        const selectObjectsAndFocus = async (
          entitiesInfos: { id: string; type: EditoastType }[]
        ) => {
          let entities: EditorEntity[];
          if (!entitiesInfos.length) return;
          try {
            if (entitiesInfos.length === 1) {
              const { type: objType, id: entityId } = selectedEntities[0];
              const entity = await getEntity(+urlInfra, entityId, objType as ObjectType, dispatch);
              entities = [entity];
            } else {
              const entitiesRecord = await getMixedEntities(+urlInfra, entitiesInfos, dispatch);
              entities = Object.values(entitiesRecord);
            }
            selectEntities(entities, { switchTool, dispatch, editorState });

            if (mapRef.current) centerMapOnObject(+urlInfra, entities, dispatch, mapRef.current);
          } catch (e) {
            dispatch(
              setFailure({
                name: t('translation:Editor.tools.select-items.errors.unable-to-select'),
                message:
                  extractMessageFromError(e as ApiError | SerializedError) !== 'undefined'
                    ? extractMessageFromError(e as ApiError | SerializedError)
                    : t('translation:Editor.tools.select-items.errors.invalid-url'),
              })
            );
          }
        };
        selectObjectsAndFocus(selectedEntities);
      }
    }
  }, []);

  /**
   * When infra change in the url
   * => change the state
   * => reset editor state
   */
  useEffect(() => {
    resetState();
    if (!isNil(urlInfra)) {
      const infradID = toInteger(urlInfra);
      dispatch(updateInfraID(infradID));
      dispatch(updateTotalsIssue(infradID));
    }
  }, [urlInfra]);

  // Lifecycle events on tools:
  useEffect(() => {
    if (toolAndState.tool.onMount) toolAndState.tool.onMount(extendedContext);

    const layersList = toolAndState.tool.requiredLayers
      ? new Set([...editorState.editorLayers, ...toolAndState.tool.requiredLayers])
      : editorState.editorLayers;

    // Remove the errors layer for better visibility in the route tool
    if (toolAndState.tool.id === 'route-edition') layersList.delete('errors');
    dispatch(selectLayers(layersList));

    return () => {
      if (toolAndState.tool.onUnmount) toolAndState.tool.onUnmount(extendedContext);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolAndState.tool]);

  /**
   * When the current entity changes, update the search params accordingly.
   * The replace in the setter nullifies the possibility for the user to "back" click on the browser
   * to get the previous selection in the url because this feature is not possible right now.
   * A solution would be to remove the auto zoom on object when sharing an url and
   * add a "zoom" button in the selection panel to let the choice to the user.
   */
  useEffect(() => {
    const currentEntity = toolAndState.state.entity as EditorEntity;
    if (currentEntity) {
      if (currentEntity.properties.id !== NEW_ENTITY_ID) {
        setSearchParams(
          { selection: `${currentEntity.objType}~${currentEntity.properties.id}` },
          { replace: true }
        );
      } else {
        const param = searchParams.get('selection');
        if (param) {
          searchParams.delete('selection');
          setSearchParams(searchParams, { replace: true });
        }
      }
    }
  }, [toolAndState.state.entity?.properties.id]);

  return (
    <EditorContext.Provider value={extendedContext as EditorContextType<unknown>}>
      <main
        className={cx('editor-root mastcontainer mastcontainer-map', infraID && 'infra-selected')}
      >
        <div className="layout">
          <div className="tool-box bg-primary">
            {Object.values(TOOL_NAMES).map((toolType: TOOL_NAMES) => {
              const tool = TOOLS[toolType];
              const { id, icon: IconComponent, labelTranslationKey } = tool;
              const label = t(labelTranslationKey);

              return (
                <Tipped key={id} mode="right">
                  <button
                    type="button"
                    className={cx(
                      'btn-rounded',
                      id === toolAndState.tool.id && 'active',
                      'editor-btn'
                    )}
                    onClick={() => {
                      switchTool({ toolType, toolState: {} });
                    }}
                  >
                    <span className="sr-only">{label}</span>
                    <IconComponent />
                  </button>
                  <span>{label}</span>
                </Tipped>
              );
            })}
          </div>
          <div className="actions-box">
            {actionsGroups.flatMap((actionsGroup, i, a) => {
              const actions = actionsGroup.map((action) => {
                const {
                  id,
                  icon: IconComponent,
                  labelTranslationKey,
                  isDisabled,
                  isActive,
                  onClick,
                } = action;
                const label = t(labelTranslationKey);

                return (
                  <Tipped key={id} mode="right">
                    <button
                      key={id}
                      type="button"
                      className={cx('editor-btn', 'btn-rounded', {
                        active: isActive && isActive(extendedContext),
                      })}
                      onClick={() => {
                        if (onClick) {
                          onClick(extendedContext);
                        }
                      }}
                      disabled={isDisabled && isDisabled(extendedContext)}
                    >
                      <span className="sr-only">{label}</span>
                      <IconComponent />
                    </button>
                    <span>{label}</span>
                  </Tipped>
                );
              });

              return i < a.length - 1
                ? [...actions, <div key={`separator-${i}`} className="separator" />]
                : actions;
            })}
          </div>
          <div>
            {isLocked && (
              <div className="infra-locked bg-yellow">{t('Editor.infra-errors.infra-locked')}</div>
            )}
            {toolAndState.tool.leftPanelComponent && (
              <div className="panel-box">
                <toolAndState.tool.leftPanelComponent />
              </div>
            )}
          </div>
          <div className="map-wrapper">
            <div className="map">
              <Map
                {...{
                  mapRef,
                  mapStyle,
                  viewport,
                  setViewport,
                  toolState: toolAndState.state,
                  activeTool: toolAndState.tool,
                  setToolState,
                  infraID,
                }}
              />
              {isSearchToolOpened && (
                <MapSearch
                  map={mapRef.current!}
                  closeMapSearchPopUp={() => setIsSearchToolOpened(false)}
                />
              )}

              <MapButtons
                map={mapRef.current ?? undefined}
                resetPitchBearing={resetPitchBearing}
                withInfraButton
                bearing={viewport.bearing}
                editorProps={{
                  toolState: toolAndState.state,
                  setToolState,
                  editorState,
                  activeTool: toolAndState.tool,
                }}
              />

              {mapRef.current &&
                editorState.editorLayers.has('errors') &&
                editorState.issues.total && (
                  <div className="error-box">
                    <InfraErrorMapControl mapRef={mapRef.current} switchTool={switchTool} />
                    <InfraErrorCorrector />
                  </div>
                )}
            </div>
            <div className="messages-bar border-left">
              <div className="px-1">
                {toolAndState.tool.messagesComponent && <toolAndState.tool.messagesComponent />}
              </div>
            </div>
          </div>
        </div>

        <LoaderState />
      </main>
    </EditorContext.Provider>
  );
};

export default Editor;
