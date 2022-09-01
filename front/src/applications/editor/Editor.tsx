import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { TFunction } from 'i18next';
import { withTranslation } from 'react-i18next';
import { ViewportProps } from 'react-map-gl';
import cx from 'classnames';

import 'common/Map/Map.scss';
import './Editor.scss';

import { LoaderState } from '../../common/Loader';
import { NotificationsState } from '../../common/Notifications';
import { EditorState, loadDataModel } from '../../reducers/editor';
import { MainState, setFailure } from '../../reducers/main';
import { updateViewport } from '../../reducers/map';
import { updateInfraID } from '../../reducers/osrdconf';
import Tipped from './components/Tipped';
import { getInfrastructure, getInfrastructures } from './data/api';
import Map from './Map';
import NavButtons from './nav';
import { EditorContext } from './context';
import {
  CommonToolState,
  EditorContextType,
  ExtendedEditorContextType,
  ModalRequest,
  OSRDConf,
  Tool,
} from './tools/types';
import TOOLS from './tools/list';

const EditorUnplugged: FC<{ t: TFunction }> = ({ t }) => {
  const dispatch = useDispatch();
  const osrdConf = useSelector((state: { osrdconf: OSRDConf }) => state.osrdconf);
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const { fullscreen } = useSelector((state: { main: MainState }) => state.main);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [activeTool, activateTool] = useState<Tool<any>>(TOOLS[0]);
  const [toolState, setToolState] = useState<any>(activeTool.getInitialState({ osrdConf }));
  const [modal, setModal] = useState<ModalRequest<any, any> | null>(null);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const { infra, urlLat, urlLon, urlZoom, urlBearing, urlPitch } =
    useParams<Record<string, string>>();
  const { mapStyle, viewport } = useSelector(
    (state: { map: { mapStyle: string; viewport: ViewportProps } }) => state.map
  );
  const setViewport = useCallback(
    (value) => {
      dispatch(updateViewport(value, `/editor/${osrdConf.infraID || '-1'}`));
    },
    [dispatch, osrdConf.infraID]
  );

  const context = useMemo<EditorContextType<CommonToolState>>(
    () => ({
      t,
      modal,
      openModal: <ArgumentsType, SubmitArgumentsType>(
        request: ModalRequest<ArgumentsType, SubmitArgumentsType>
      ) => {
        setModal(request as ModalRequest<unknown, unknown>);
      },
      closeModal: () => {
        setModal(null);
      },
      activeTool,
      state: toolState,
      setState: setToolState,
      switchTool<S extends CommonToolState>(tool: Tool<S>, state?: Partial<S>) {
        const fullState = { ...tool.getInitialState({ osrdConf }), ...(state || {}) };
        activateTool(tool);
        setToolState(fullState);
      },
    }),
    [activeTool, modal, t, toolState]
  );
  const extendedContext = useMemo<ExtendedEditorContextType<CommonToolState>>(
    () => ({
      ...context,
      dispatch,
      editorState,
      mapState: {
        viewport,
        mapStyle,
      },
    }),
    [context, dispatch, editorState, mapStyle, viewport]
  );

  const actionsGroups = activeTool.actions
    .map((group) => group.filter((action) => !action.isHidden || !action.isHidden(extendedContext)))
    .filter((group) => group.length);

  // Initial viewport:
  useEffect(() => {
    // load the data model
    dispatch(loadDataModel());
    if (urlLat) {
      setViewport({
        ...viewport,
        latitude: parseFloat(urlLat || '0'),
        longitude: parseFloat(urlLon || '0'),
        zoom: parseFloat(urlZoom || '1'),
        bearing: parseFloat(urlBearing || '1'),
        pitch: parseFloat(urlPitch || '1'),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update the infrastructure in state
  // We take the one define in the url, and if it is absent or equals to '-1'
  // we call the api to find the latest infrastructure modified
  useEffect(() => {
    if (infra && parseInt(infra, 10) > 0) {
      getInfrastructure(parseInt(infra, 10))
        .then((infrastructure) => dispatch(updateInfraID(infrastructure.id)))
        .catch(() => {
          dispatch(setFailure(new Error(t('Editor.errors.infra-not-found', { id: infra }))));
          dispatch(updateViewport({}, `/editor/`));
        });
    } else if (osrdConf.infraID) {
      dispatch(updateViewport({}, `/editor/${osrdConf.infraID}`));
    } else {
      getInfrastructures()
        .then((infras) => {
          if (infras && infras.length > 0) {
            const infrastructure = infras[0];
            dispatch(updateInfraID(infrastructure.id));
            dispatch(updateViewport({}, `/editor/${infrastructure.id}`));
          } else {
            dispatch(setFailure(new Error(t('Editor.errors.no-infra-available'))));
          }
        })
        .catch((e) => {
          dispatch(setFailure(new Error(t('Editor.errors.technical', { msg: e.message }))));
        });
    }
  }, [dispatch, infra, osrdConf.infraID, t]);

  // Lifecycle events on tools:
  useEffect(() => {
    if (activeTool.onMount) activeTool.onMount(extendedContext);

    return () => {
      if (activeTool.onUnmount) activeTool.onUnmount(extendedContext);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

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
                    className={cx('btn-rounded', id === activeTool.id && 'active', 'editor-btn')}
                    onClick={() => {
                      activateTool(tool);
                      setToolState(tool.getInitialState({ osrdConf }));
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
          {activeTool.leftPanelComponent && (
            <div className="panel-box">
              <activeTool.leftPanelComponent />
            </div>
          )}
          <div className="map-wrapper">
            <div className="map">
              <Map
                {...{
                  toolState,
                  setToolState,
                  viewport,
                  setViewport,
                  activeTool,
                  mapStyle,
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
                              onClick({ dispatch, setViewport, viewport }, editorState);
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
              {activeTool.messagesComponent && <activeTool.messagesComponent />}
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
