import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { TFunction } from 'i18next';
import { withTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import cx from 'classnames';

import 'common/Map/Map.scss';
import './Editor.scss';

import { LoaderState } from '../../common/Loader';
import { NotificationsState } from '../../common/Notifications';
import { loadDataModel, reset } from '../../reducers/editor';
import { MainState, setFailure } from '../../reducers/main';
import { updateViewport, Viewport } from '../../reducers/map';
import { updateInfraID } from '../../reducers/osrdconf';
import Tipped from './components/Tipped';
import { getInfrastructure, getInfrastructures } from './data/api';
import Map from './Map';
import NavButtons from './nav';
import { EditorContext } from './context';
import {
  CommonToolState,
  EditorContextType,
  EditorState,
  ExtendedEditorContextType,
  FullTool,
  ModalRequest,
  OSRDConf,
  Tool,
} from './tools/types';
import TOOLS from './tools/list';

const EditorUnplugged: FC<{ t: TFunction }> = ({ t }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const osrdConf = useSelector((state: { osrdconf: OSRDConf }) => state.osrdconf);
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const { fullscreen } = useSelector((state: { main: MainState }) => state.main);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [toolAndState, setToolAndState] = useState<FullTool<any>>({
    tool: TOOLS[0],
    state: TOOLS[0].getInitialState({ osrdConf }),
  });
  const [modal, setModal] = useState<ModalRequest<any, any> | null>(null);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const openModal = useCallback(
    <ArgumentsType, SubmitArgumentsType>(
      request: ModalRequest<ArgumentsType, SubmitArgumentsType>
    ) => {
      setModal(request as ModalRequest<unknown, unknown>);
    },
    [setModal]
  );
  const switchTool = useCallback(
    <S extends CommonToolState>(tool: Tool<S>, partialState?: Partial<S>) => {
      const state = { ...tool.getInitialState({ osrdConf }), ...(partialState || {}) };
      setToolAndState({
        tool,
        state,
      });
    },
    [osrdConf, setToolAndState]
  );
  const setToolState = useCallback(
    <S extends CommonToolState>(state?: S) => {
      setToolAndState((s) => ({
        ...s,
        state,
      }));
    },
    [setToolAndState]
  );
  const resetState = useCallback(() => {
    switchTool(TOOLS[0]);
    dispatch(reset());
  }, []);

  const { infra } = useParams<{ infra?: string }>();
  const { mapStyle, viewport } = useSelector(
    (state: { map: { mapStyle: string; viewport: Viewport } }) => state.map
  );
  const setViewport = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateViewport(value, `/editor/${osrdConf.infraID || '-1'}`, false));
    },
    [dispatch, osrdConf.infraID]
  );

  const context = useMemo<EditorContextType<CommonToolState>>(
    () => ({
      t,
      modal,
      openModal,
      closeModal: () => {
        setModal(null);
      },
      activeTool: toolAndState.tool,
      state: toolAndState.state,
      setState: setToolState,
      switchTool,
    }),
    [toolAndState, modal, osrdConf, t]
  );
  const extendedContext = useMemo<ExtendedEditorContextType<CommonToolState>>(
    () => ({
      ...context,
      dispatch,
      editorState,
      osrdConf,
      mapState: {
        viewport,
        mapStyle,
      },
    }),
    [context, dispatch, editorState, mapStyle, osrdConf, viewport]
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

  // Initial viewport:
  useEffect(() => {
    // load the data model
    dispatch(loadDataModel());
  }, []);

  // Update the infrastructure in state
  // We take the one define in the url, and if it is absent or equals to '-1'
  // we call the api to find the latest infrastructure modified
  useEffect(() => {
    if (infra && parseInt(infra, 10) > 0) {
      const infraID = parseInt(infra, 10);
      getInfrastructure(infraID)
        .then(() => {
          resetState();
        })
        .catch(() => {
          dispatch(setFailure(new Error(t('Editor.errors.infra-not-found', { id: infra }))));
        })
        .finally(() => {
          dispatch(updateInfraID(infraID));
        });
    } else if (osrdConf.infraID) {
      navigate(`/editor/${osrdConf.infraID}`);
    } else {
      getInfrastructures()
        .then((infras) => {
          if (infras && infras.length > 0) {
            const infrastructure = infras[0];
            dispatch(updateInfraID(infrastructure.id));
            navigate(`/editor/${infrastructure.id}`);
          } else {
            dispatch(setFailure(new Error(t('Editor.errors.no-infra-available'))));
          }
        })
        .catch((e) => {
          dispatch(setFailure(new Error(t('Editor.errors.technical', { msg: e.message }))));
        });
    }
  }, [infra, osrdConf.infraID]);

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
        className={`editor-root mastcontainer mastcontainer-map${fullscreen ? ' fullscreen' : ''}`}
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
                            isActive && isActive(editorState) ? 'active' : ''
                          )}
                          onClick={() => {
                            if (onClick) {
                              onClick(
                                { dispatch, setViewport, viewport, openModal, editorState },
                                {
                                  activeTool: toolAndState.tool,
                                  toolState: toolAndState.state,
                                  setToolState,
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
            <div className="messages-bar">
              {toolAndState.tool.messagesComponent && <toolAndState.tool.messagesComponent />}
            </div>
          </div>
        </div>

        <LoaderState />
        <NotificationsState />

        {modal &&
          React.createElement(modal.component, {
            arguments: modal.arguments,
            cancel: () => {
              if (modal.beforeCancel) modal.beforeCancel();
              setModal(null);
              if (modal.afterCancel) modal.afterCancel();
            },
            submit: (args) => {
              if (modal.beforeSubmit) modal.beforeSubmit(args);
              setModal(null);
              if (modal.afterSubmit) modal.afterSubmit(args);
            },
          })}
      </main>
    </EditorContext.Provider>
  );
};

const Editor = withTranslation()(EditorUnplugged);

export default Editor;
