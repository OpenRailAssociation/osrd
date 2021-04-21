import React, { FC, useState } from 'react';
import { useSelector } from 'react-redux';
import { withTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { AiOutlineQuestionCircle } from 'react-icons/all';

import { TOOLS } from '../tools';
import { EditorState } from '../../../reducers/editor';

import './ToolDescription.scss';

const ToolDescriptionUnplugged: FC<{ t: TFunction }> = ({ t }) => {
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const activeTool = TOOLS.find(({ tool }) => tool === editorState.activeTool);
  const [isDeployed, setIsDeployed] = useState<boolean>(false);

  if (!activeTool) return null;

  return (
    <div className="tool-description">
      {isDeployed ? (
        <div className="card">
          <button
            type="button"
            className="close"
            aria-label={t('common.close')}
            onClick={() => setIsDeployed(false)}
          >
            <span aria-hidden="true">&times;</span>
          </button>
          <div className="card-body">
            <h5 className="card-title">{t(activeTool.labelTranslationKey)}</h5>
            <p className="card-text">
              {activeTool.descriptionTranslationKeys.flatMap((key, i, a) =>
                i < a.length - 1
                  ? [<span key={key}>{t(key)}</span>, <br key={`${key}-break`} />]
                  : t(key)
              )}
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn-rounded btn-rounded-white"
          onClick={() => setIsDeployed(true)}
          title={t('Editor.tool-help')}
        >
          <AiOutlineQuestionCircle />
        </button>
      )}
    </div>
  );
};

const ToolDescription = withTranslation()(ToolDescriptionUnplugged);

export default ToolDescription;
