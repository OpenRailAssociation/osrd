import React from 'react';
import { useSelector } from 'react-redux';
import { LoaderState } from 'common/Loader';
import { withTranslation } from 'react-i18next';

import { NotificationsState } from 'common/Notifications';
import ToolDescription from './components/ToolDescription';

import 'common/Map/Map.scss';
/* Tools */
import { TOOLS } from './tools';
import ButtonUseTool from './components/ButtonUseTool';

const EditorUnplugged = ({ t }) => {
  const editorState = useSelector((state) => state.editor);
  const { fullscreen } = useSelector((state) => state.main);

  const activeTool = TOOLS.find(({ tool }) => tool === editorState.activeTool);
  const ToolComponent = activeTool.mapComponent;

  return (
    <main className={`mastcontainer mastcontainer-map${fullscreen ? ' fullscreen' : ''}`}>
      <LoaderState />
      <div className="toolbox">
        {TOOLS.map(({ tool, icon, labelTranslationKey, isEnabled }) => (
          <ButtonUseTool
            key={tool}
            activeTool={editorState.activeTool}
            tool={tool}
            label={t(labelTranslationKey)}
            icon={icon}
            disabled={isEnabled && !isEnabled(editorState)}
          />
        ))}
      </div>
      <ToolComponent />
      <NotificationsState />
      <ToolDescription />
    </main>
  );
};

const Editor = withTranslation()(EditorUnplugged);

export default Editor;
