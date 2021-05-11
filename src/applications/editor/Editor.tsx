import React, { FC, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { TFunction } from 'i18next';
import { withTranslation } from 'react-i18next';

import { LoaderState } from 'common/Loader';
import { NotificationsState } from 'common/Notifications';

import 'common/Map/Map.scss';
import './Editor.scss';

import { Tool, Tools } from './tools';
import { EditorState } from '../../reducers/editor';
import { MainState } from '../../reducers/main';
import Map from './Map';

const EditorUnplugged: FC<{ t: TFunction }> = ({ t }) => {
  const dispatch = useDispatch();
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const { fullscreen } = useSelector((state: { main: MainState }) => state.main);

  const [activeTool, activateTool] = useState<Tool<any>>(Tools[0]);
  const [toolState, setToolState] = useState<any>(activeTool.getInitialState());
  const actionsGroups = activeTool.actions
    .map((group) =>
      group.filter((action) => !action.isDisabled || !action.isDisabled(toolState, editorState))
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
              <button
                type="button"
                className={`btn-rounded ${id === activeTool.id ? 'btn-rounded-white' : ''}`}
                onClick={() => {
                  activateTool(tool);
                  setToolState(tool.getInitialState());
                }}
                disabled={isDisabled && isDisabled(editorState)}
                title={label}
              >
                <span className="sr-only">{label}</span>
                <IconComponent />
              </button>
            );
          })}
        </div>
        <div className="actions-box">
          {actionsGroups.flatMap((actionsGroup, i, a) => {
            const actions = actionsGroup.map((action) => {
              const { id, icon: IconComponent, labelTranslationKey, isDisabled, onClick } = action;
              const label = t(labelTranslationKey);

              return (
                <button
                  type="button"
                  className={`btn-rounded ${id === activeTool.id ? 'btn-rounded-white' : ''}`}
                  onClick={() => {
                    if (onClick) {
                      onClick({ setState: setToolState, dispatch }, toolState, editorState);
                    }
                  }}
                  disabled={isDisabled && isDisabled(toolState, editorState)}
                  title={label}
                >
                  <span className="sr-only">{label}</span>
                  <IconComponent />
                </button>
              );
            });

            return i < a.length - 1
              ? [...actions, <div key={`separator-${i}`} className="separator" />]
              : actions;
          })}
        </div>
        <div className="map">
          {/*<Map selection={} getCursor={} onClickFeature={} />*/}
        </div>
      </div>

      <LoaderState />
      <NotificationsState />
    </main>
  );
};

const Editor = withTranslation()(EditorUnplugged);

export default Editor;
