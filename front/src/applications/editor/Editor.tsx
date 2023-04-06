import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import cx from 'classnames';
import { isNil, toInteger } from 'lodash';
import 'common/Map/Map.scss';
import './Editor.scss';

import { useModal } from '../../common/BootstrapSNCF/ModalSNCF';
import { LoaderState } from '../../common/Loader';
import { loadDataModel, reset } from '../../reducers/editor';
import { updateInfraID } from '../../reducers/osrdconf';
import { updateViewport, Viewport } from '../../reducers/map';
import Tipped from './components/Tipped';
import Map from './Map';
import NavButtons from './nav';
import EditorContext from './context';
import {
  CommonToolState,
  EditorContextType,
  EditorState,
  ExtendedEditorContextType,
  FullTool,
  Tool,
} from './tools/types';
import TOOLS from './tools/list';
import { getInfraID, getSwitchTypes } from '../../reducers/osrdconf/selectors';

const Editor: FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { openModal, closeModal } = useModal();
  const { urlInfra } = useParams();
  const infraID = useSelector(getInfraID);
  const switchTypes = useSelector(getSwitchTypes);
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [toolAndState, setToolAndState] = useState<FullTool<any>>({
    tool: TOOLS[0],
    state: TOOLS[0].getInitialState({ infraID, switchTypes }),
  });
  const [renderingFingerprint, setRenderingFingerprint] = useState(Date.now());
  const forceRender = useCallback(() => {
    setRenderingFingerprint(Date.now());
  }, [setRenderingFingerprint]);

  const switchTool = useCallback(
    <S extends CommonToolState>(tool: Tool<S>, partialState?: Partial<S>) => {
      const state = { ...tool.getInitialState({ infraID, switchTypes }), ...(partialState || {}) };
      setToolAndState({
        tool,
        state,
      });
    },
    [infraID, setToolAndState]
  );
  const setToolState = useCallback(
    <S extends CommonToolState>(state: Partial<S>) => {
      setToolAndState((s) => ({
        ...s,
        state: {
          ...s.state,
          ...state,
        },
      }));
    },
    [setToolAndState]
  );

  const resetState = useCallback(() => {
    switchTool(TOOLS[0]);
    dispatch(reset());
    forceRender();
  }, [dispatch, switchTool, forceRender]);

  const { mapStyle, viewport } = useSelector(
    (state: { map: { mapStyle: string; viewport: Viewport } }) => state.map
  );

  const setViewport = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateViewport(value));
    },
    [dispatch]
  );

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
      switchTypes,
      mapState: {
        viewport,
        mapStyle,
      },
    }),
    [context, dispatch, editorState, mapStyle, infraID, switchTypes, viewport]
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
   * When the component mount
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
   * When infra change in the url
   * => change the state
   * => reset editor state
   */
  useEffect(() => {
    resetState();
    if (!isNil(urlInfra)) {
      dispatch(updateInfraID(toInteger(urlInfra)));
    }
  }, [urlInfra]);

  // Lifecycle events on tools:
  useEffect(() => {
    if (toolAndState.tool.onMount) toolAndState.tool.onMount(extendedContext);

    return () => {
      if (toolAndState.tool.onUnmount) toolAndState.tool.onUnmount(extendedContext);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolAndState.tool]);

  return (
    <EditorContext.Provider value={extendedContext as EditorContextType<unknown>}>
      <main
        className={cx('editor-root mastcontainer mastcontainer-map', infraID && 'infra-selected')}
      >
        <div className="layout">
          <div className="tool-box bg-primary">
            {TOOLS.map((tool) => {
              const { id, icon: IconComponent, labelTranslationKey, isDisabled } = tool;
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
                      switchTool(tool);
                    }}
                    disabled={isDisabled && isDisabled(extendedContext)}
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
                      className={cx(
                        'editor-btn',
                        'btn-rounded',
                        isActive && isActive(extendedContext) ? 'active' : ''
                      )}
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
          {toolAndState.tool.leftPanelComponent && (
            <div className="panel-box">
              <toolAndState.tool.leftPanelComponent />
            </div>
          )}
          <div className="map-wrapper">
            <div className="map">
              <Map
                {...{
                  mapStyle,
                  viewport,
                  setViewport,
                  toolState: toolAndState.state,
                  activeTool: toolAndState.tool,
                  setToolState,
                }}
              />

              <div className="nav-box">
                {NavButtons.flatMap((navButtons, i, a) => {
                  const buttons = navButtons.map((navButton) => {
                    const {
                      id,
                      icon: IconComponent,
                      labelTranslationKey,
                      isDisabled,
                      isActive,
                      isBlink,
                      onClick,
                    } = navButton;
                    const label = t(labelTranslationKey);

                    return (
                      <Tipped key={id} mode="left">
                        <button
                          key={id}
                          type="button"
                          className={cx(
                            'editor-btn',
                            'btn-rounded',
                            isActive && isActive(editorState) ? 'active' : '',
                            isBlink && isBlink(editorState, infraID)
                              ? 'btn-map-infras-blinking'
                              : ''
                          )}
                          onClick={() => {
                            if (onClick) {
                              onClick(
                                {
                                  navigate,
                                  dispatch,
                                  setViewport,
                                  viewport,
                                  openModal,
                                  closeModal,
                                  editorState,
                                },
                                {
                                  activeTool: toolAndState.tool,
                                  toolState: toolAndState.state,
                                  setToolState,
                                  switchTool,
                                }
                              );
                            }
                          }}
                          disabled={isDisabled && isDisabled(editorState)}
                        >
                          <span className="sr-only">{label}</span>
                          <IconComponent />
                        </button>
                        <span>{label}</span>
                      </Tipped>
                    );
                  });

                  if (i < a.length - 1)
                    return buttons.concat([<div key={`separator-${i}`} className="separator" />]);
                  return buttons;
                })}
              </div>
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
