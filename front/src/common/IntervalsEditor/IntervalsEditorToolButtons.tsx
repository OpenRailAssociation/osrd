import React from 'react';
import { ReactI18NextChild, useTranslation } from 'react-i18next';
import { IoIosAdd } from 'react-icons/io';
import { TbArrowsHorizontal, TbScissors } from 'react-icons/tb';
import { BsFillTrashFill } from 'react-icons/bs';
import { INTERVALS_EDITOR_TOOLS, IntervalsEditorTool, IntervalsEditorToolsConfig } from './types';

const ToolButton = ({
  selectedTool,
  tool,
  title,
  icon,
  toggleSelectedTool,
}: {
  selectedTool: IntervalsEditorTool | null;
  tool: IntervalsEditorTool;
  title: string;
  icon: ReactI18NextChild;
  toggleSelectedTool: (tool: IntervalsEditorTool) => void;
}) => (
  <button
    className={`${selectedTool === tool ? 'btn-selected' : 'btn'} btn-sm btn-outline-secondary`}
    type="button"
    title={title}
    onClick={() => {
      toggleSelectedTool(tool);
    }}
  >
    {icon}
  </button>
);

type ToolButtonsProps = {
  selectedTool: IntervalsEditorTool | null;
  toolsConfig: IntervalsEditorToolsConfig;
  toggleSelectedTool: (tool: IntervalsEditorTool) => void;
};

const ToolButtons = ({ selectedTool, toolsConfig, toggleSelectedTool }: ToolButtonsProps) => {
  const { t } = useTranslation('common/common');

  return (
    <div className="btn-group-vertical">
      <div className="tools">
        {toolsConfig.addTool && (
          <ToolButton
            selectedTool={selectedTool}
            tool={INTERVALS_EDITOR_TOOLS.ADD_TOOL}
            title={t('actions.add')}
            icon={<IoIosAdd />}
            toggleSelectedTool={toggleSelectedTool}
          />
        )}
        {toolsConfig.translateTool && (
          <ToolButton
            selectedTool={selectedTool}
            tool={INTERVALS_EDITOR_TOOLS.TRANSLATE_TOOL}
            title={t('actions.translate')}
            icon={<TbArrowsHorizontal />}
            toggleSelectedTool={toggleSelectedTool}
          />
        )}
        {toolsConfig.cutTool && (
          <ToolButton
            selectedTool={selectedTool}
            tool={INTERVALS_EDITOR_TOOLS.CUT_TOOL}
            title={t('actions.split')}
            icon={<TbScissors />}
            toggleSelectedTool={toggleSelectedTool}
          />
        )}
        {toolsConfig.deleteTool && (
          <ToolButton
            selectedTool={selectedTool}
            tool={INTERVALS_EDITOR_TOOLS.DELETE_TOOL}
            title={t('actions.delete')}
            icon={<BsFillTrashFill />}
            toggleSelectedTool={toggleSelectedTool}
          />
        )}
      </div>
    </div>
  );
};

export default ToolButtons;
