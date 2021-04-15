import React from 'react';
import { useSelector } from 'react-redux';
import { GiArrowCursor, MdPhotoSizeSelectSmall, MdShowChart } from 'react-icons/all';
import { LoaderState } from 'common/Loader';
import { NotificationsState } from 'common/Notifications';
import 'common/Map/Map.scss';
/* Tools */
import ButtonUseTool from './components/ButtonUseTool';
import SelectItem from './components/tools/SelectItem';
import SelectZone from './components/tools/SelectZone';
import CreateLine from './components/tools/CreateLine';

/* Toolbox */
const TOOLS = [
  {
    // Zone selection:
    tool: 'select-zone',
    label: "Sélectionner la zone d'édition",
    icon: MdPhotoSizeSelectSmall,
    mapComponent: SelectZone,
    isEnabled() {
      return true;
    },
  },
  {
    // Item selection:
    tool: 'select-item',
    label: 'Sélectionner un élément',
    icon: GiArrowCursor,
    mapComponent: SelectItem,
    isEnabled(editorState) {
      return editorState.editionZone;
    },
  },
  {
    // Create rails:
    tool: 'create-line',
    label: 'Créer une ligne',
    icon: MdShowChart,
    mapComponent: CreateLine,
    isEnabled(editorState) {
      return editorState.editionZone;
    },
  },
];

const Editor = () => {
  const editorState = useSelector((state) => state.editor);
  const { fullscreen } = useSelector((state) => state.main);

  const activeTool = TOOLS.find(({ tool }) => tool === editorState.activeTool);
  const ToolComponent = activeTool.mapComponent;

  return (
    <main className={`mastcontainer mastcontainer-map${fullscreen ? ' fullscreen' : ''}`}>
      <LoaderState />
      <div className="toolbox">
        {TOOLS.map(({ tool, label, icon, isEnabled }) => (
          <ButtonUseTool
            key={tool}
            activeTool={editorState.activeTool}
            tool={tool}
            label={label}
            icon={icon}
            disabled={isEnabled && !isEnabled(editorState)}
          />
        ))}
      </div>
      <ToolComponent />
      <NotificationsState />
    </main>
  );
};

export default Editor;
