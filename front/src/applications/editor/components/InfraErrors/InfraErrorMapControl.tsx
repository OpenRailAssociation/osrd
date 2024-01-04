import React, { FC, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { LngLatBoundsLike, MapRef } from 'react-map-gl/maplibre';
import { BsExclamationOctagon } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { getEditorState } from 'reducers/editor/selectors';
import useKeyboardShortcuts from 'utils/hooks/useKeyboardShortcuts';

import { EditorContextType } from '../../tools/editorContextTypes';
import { getEntityBbox, selectEntity } from '../../tools/utils';
import { getEntity } from '../../data/api';
import InfraErrorsModal from './InfraErrorsModal';
import { InfraError } from './types';

const InfraErrorMapControl: FC<{
  mapRef: MapRef;
  switchTool: EditorContextType['switchTool'];
}> = ({ mapRef, switchTool }) => {
  const dispatch = useDispatch();
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
          const entity = await getEntity(
            infraID,
            item.information.obj_id,
            item.information.obj_type,
            dispatch
          );

          // select the entity
          selectEntity(entity, { switchTool, dispatch, editorState });

          // closing the modal
          closeModal();

          // Center the map on the object
          const bbox = await getEntityBbox(infraID, entity, dispatch);
          if (bbox) {
            // zoom to the bbox
            mapRef.fitBounds(bbox as LngLatBoundsLike, { animate: false });
            // make a zoom out to have some kind of "margin" around the bbox
            mapRef.zoomOut();
          }
        }}
      />,
      'lg'
    );
  }, [
    switchTool,
    dispatch,
    editorState,
    mapRef,
    getEntityBbox,
    getEntity,
    closeModal,
    selectEntity,
  ]);

  // ctrl+E opens the modal
  useEffect(() => {
    register({ code: 'KeyE', optionalKeys: { ctrlKey: true }, handler: displayErrors });
  }, [displayErrors]);

  return (
    <button
      type="button"
      title={t('Editor.nav.infra-errors-list')}
      className="btn btn-sm p-1 shadow d-flex align-items-center justify-content-center"
      onClick={displayErrors}
      disabled={total === 0}
    >
      <span className="px-1">{label}</span>
      <BsExclamationOctagon size="1.2em" className="ml-1 text-danger" />
    </button>
  );
};

export default InfraErrorMapControl;
