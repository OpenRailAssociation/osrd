import { useCallback, useEffect } from 'react';

import { Alert } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import type { MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { getEntity } from 'applications/editor/data/api';
import { centerMapOnObject, selectEntities } from 'applications/editor/tools/utils';
import type { EditorContextType } from 'applications/editor/types';
import type { InfraError } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { getEditorState } from 'reducers/editor/selectors';
import { useAppDispatch } from 'store';
import useKeyboardShortcuts from 'utils/hooks/useKeyboardShortcuts';

import InfraErrorsModal from './InfraErrorsModal';

type InfraErrorMapControlProps = {
  mapRef: MapRef;
  switchTool: EditorContextType['switchTool'];
};

const InfraErrorMapControl = ({ mapRef, switchTool }: InfraErrorMapControlProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { register } = useKeyboardShortcuts();
  const { openModal, closeModal } = useModal();
  const editorState = useSelector(getEditorState);
  const { filterTotal, total } = editorState.issues;

  const label =
    total === filterTotal
      ? t(`Editor.infra-errors.label.title`, { count: total })
      : t(`Editor.infra-errors.label.title-with-filter`, { count: filterTotal, total });

  const displayErrors = useCallback(() => {
    openModal(
      <InfraErrorsModal
        onErrorClick={async (infraID: number, item: InfraError) => {
          const entity = await getEntity(infraID, item.obj_id, item.obj_type, dispatch);

          // select the entity
          selectEntities([entity], { switchTool, dispatch, editorState });

          // closing the modal
          closeModal();

          centerMapOnObject(infraID, [entity], dispatch, mapRef);
        }}
      />,
      'lg'
    );
  }, [
    switchTool,
    dispatch,
    editorState,
    mapRef,
    getEntity,
    closeModal,
    selectEntities,
    centerMapOnObject,
  ]);

  // ctrl+E opens the modal
  useEffect(() => {
    register({ code: 'KeyE', optionalKeys: { ctrlKey: true }, handler: displayErrors });
  }, [displayErrors]);

  return (
    <button
      type="button"
      title={t('Editor.nav.infra-errors-list')}
      className="btn btn-sm py-1 px-2 shadow d-flex align-items-center justify-content-center"
      onClick={displayErrors}
      disabled={total === 0}
    >
      <span className="px-1">{label}</span>
      <span className="ml-1 text-danger">
        <Alert variant="fill" />
      </span>
    </button>
  );
};

export default InfraErrorMapControl;
