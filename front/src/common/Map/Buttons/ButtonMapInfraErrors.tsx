import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { BsExclamationOctagon } from 'react-icons/bs';

import { type EditorState, editorSliceActions } from 'reducers/editor';
import { useAppDispatch } from 'store';

type ButtonMapInfraErrorsProps = {
  editorState: EditorState;
};

const ButtonMapInfraErrors = ({
  editorState: {
    mapSettings: { layersSettings },
  },
}: ButtonMapInfraErrorsProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('translation');

  const toggleInfraErrors = () => {
    dispatch(
      editorSliceActions.updateMapSettings({
        layersSettings: {
          ...layersSettings,
          errors: !layersSettings.errors,
        },
      })
    );
  };

  return (
    <button
      type="button"
      className={cx('editor-btn btn-rounded', {
        active: layersSettings.errors,
      })}
      aria-label={t('common.toggleInfraErrors')}
      title={t('common.toggleInfraErrors')}
      onClick={toggleInfraErrors}
    >
      <BsExclamationOctagon />
    </button>
  );
};

export default ButtonMapInfraErrors;
