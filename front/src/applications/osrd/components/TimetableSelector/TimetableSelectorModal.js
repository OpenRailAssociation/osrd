import React, { useEffect, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { get, post, deleteRequest } from 'common/requests';
import { updateTimetableID } from 'reducers/osrdconf';
import nextId from 'react-id-generator';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { setSuccess, setFailure } from 'reducers/main';
import icon from 'assets/pictures/components/trains_timetable.svg';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

const timetableURL = '/timetable/';

export default function TimetableSelectorModal() {
  const dispatch = useDispatch();
  const [newNameTimetable, setNewNameTimetable] = useState(null);
  const [timetablesList, settimetablesList] = useState(undefined);
  const { infraID, timetableID } = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['translation', 'osrdconf']);
  const { closeModal } = useContext(ModalContext);

  const getTimetablesList = async () => {
    try {
      const timetablesListQuery = await get(timetableURL, { infra: infraID });
      settimetablesList(timetablesListQuery);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('osrdconf:errorMessages.unableToRetrieveTimetableList'),
          message: e.message,
        })
      );
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    getTimetablesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID]);

  const deleteTimetable = async (timetable) => {
    try {
      await deleteRequest(`${timetableURL}${timetable.id}/`);
      getTimetablesList();
      dispatch(
        setSuccess({
          title: t('osrdconf:timetabledelete'),
          text: `${timetable.name} ID ${timetable.id}`,
        })
      );
      if (timetableID === timetable.id) {
        dispatch(updateTimetableID(undefined));
      }
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  const createTimetable = async () => {
    const params = {
      name: newNameTimetable,
      infra: infraID,
    };

    try {
      const result = await post(timetableURL, params, {});
      dispatch(updateTimetableID(result.id));
    } catch (e) {
      console.log('ERROR', e);
    }
    getTimetablesList();
  };

  return (
    <div>
      <ModalHeaderSNCF>
        <div className="d-flex align-items-center h1">
          <img className="mr-3" src={icon} alt="timetable icon" width="48px" />
          {t('osrdconf:timetablechoose')}
        </div>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <>
          <InputSNCF
            type="text"
            id="timetableselector-add"
            onChange={(e) => setNewNameTimetable(e.target.value)}
            appendOptions={{
              name: 'timetableselector-add',
              iconName: 'icons-add',
              onClick: createTimetable,
            }}
            sm
          />
          <div className="mb-3 osrd-config-timetableselector">
            {timetablesList !== undefined
              ? timetablesList.results.map((timetable) => (
                  <div className="d-flex align-items-center" key={nextId()}>
                    <div
                      role="button"
                      tabIndex="-1"
                      onClick={() => dispatch(updateTimetableID(timetable.id))}
                      data-dismiss="modal"
                      className="flex-grow-1 osrd-config-timetableselector-item"
                    >
                      <div className="d-flex align-items-center">
                        <div className="text-primary small mr-2">{timetable.id}</div>
                        <div className="flex-grow-1">{timetable.name}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTimetable(timetable)}
                      className="ml-1 btn btn-sm btn-only-icon btn-white"
                    >
                      <i className="icons-close" />
                    </button>
                  </div>
                ))
              : null}
          </div>
          <div className="d-flex">
            <button
              className="btn btn-secondary flex-fill btn-sm"
              type="button"
              onClick={() => closeModal()}
            >
              {t('translation:common.close')}
            </button>
          </div>
        </>
      </ModalBodySNCF>
    </div>
  );
}
