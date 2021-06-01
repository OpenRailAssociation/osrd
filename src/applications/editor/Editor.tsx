import React, { FC, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { TFunction } from 'i18next';
import { withTranslation } from 'react-i18next';
import cx from 'classnames';

import { LoaderState } from 'common/Loader';
import { NotificationsState } from 'common/Notifications';

import 'common/Map/Map.scss';
import './Editor.scss';

import { Tool, Tools } from './tools';
import { EditorState } from '../../reducers/editor';
import { MainState } from '../../reducers/main';
import Map from './Map';
import Tipped from './components/Tipped';

const EditorUnplugged: FC<{ t: TFunction }> = ({ t }) => {
  const dispatch = useDispatch();
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const { fullscreen } = useSelector((state: { main: MainState }) => state.main);

  const [activeTool, activateTool] = useState<Tool<any>>(Tools[0]);
  const [toolState, setToolState] = useState<any>(activeTool.getInitialState());
  const actionsGroups = activeTool.actions
    .map((group) =>
      group.filter((action) => !action.isHidden || !action.isHidden(toolState, editorState))
    )
    .filter((group) => group.length);

  return (
    <main
      className={`editor-root mastcontainer mastcontainer-map${fullscreen ? ' fullscreen' : ''}`}
    >
      <div className="layout">
        <div className="tool-box">
          {Tools.map((tool) => {
            const { id, icon: IconComponent, labelTranslationKey, isDisabled } = tool;
            const label = t(labelTranslationKey);

            return (
              <Tipped key={id} mode="right">
                <button
                  type="button"
                  className={`btn-rounded ${id === activeTool.id ? 'active' : ''}`}
                  onClick={() => {
                    activateTool(tool);
                    setToolState(tool.getInitialState());
                  }}
                  disabled={isDisabled && isDisabled(editorState)}
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
                      'btn-rounded',
                      isActive && isActive(toolState, editorState) ? 'active' : ''
                    )}
                    onClick={() => {
                      if (onClick) {
                        onClick({ setState: setToolState, dispatch }, toolState, editorState);
                      }
                    }}
                    disabled={isDisabled && isDisabled(toolState, editorState)}
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
        <div className="map-wrapper">
          <div className="map">
            <Map toolState={toolState} setToolState={setToolState} activeTool={activeTool} />
          </div>
          <div className="messages-bar">
            {(activeTool.getMessages && activeTool.getMessages({ t }, toolState, editorState)) ||
              null}
          </div>
        </div>
      </div>

      <LoaderState />
      <NotificationsState />

      {(activeTool.getDOM &&
        activeTool.getDOM({ dispatch, setState: setToolState, t }, toolState, editorState)) ||
        null}
    </main>
  );
};

const Editor = withTranslation()(EditorUnplugged);

export default Editor;
