import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { get, post } from 'common/requests';
import { updateTimetableID } from 'reducers/osrdconf';
import nextId from 'react-id-generator';
import { datetime2string } from 'utils/timeManipulation';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

const timetableURL = '/osrd/timetable';

export default function TimetableSelectorModal() {
  const dispatch = useDispatch();
  const [newNameTimetable, setNewNameTimetable] = useState(null);
  const [timetablesList, settimetablesList] = useState(undefined);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['translation', 'osrdconf']);

  const getTimetablesList = async () => {
    try {
      const timetablesListQuery = await get(timetableURL, {}, true);
      settimetablesList(timetablesListQuery);
      console.log(timetablesListQuery);
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    getTimetablesList();
  }, []);

  const createTimetable = async () => {
    const params = {
      name: newNameTimetable,
      infra: infraID,
    };

    try {
      const timetableCreation = await post(timetableURL, params, {}, true);
      console.log(timetableCreation);
    } catch (e) {
      console.log('ERROR', e);
    }
    console.log(newNameTimetable);
  };

  return (
    <ModalSNCF htmlID="timetable-selector-modal">
      <ModalHeaderSNCF>
        {t('osrdconf:timetablechoose')}
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
            noMargin
            sm
          />
          <div className="mb-3 osrd-config-timetableselector">
            {(timetablesList !== undefined) ? (
              timetablesList.results.map((timetable) => (
                <div
                  role="button"
                  tabIndex="-1"
                  onClick={() => dispatch(updateTimetableID(timetable.id))}
                  key={nextId()}
                  data-dismiss="modal"
                  className="osrd-config-timetableselector-item"
                >
                  <div className="d-flex align-items-center">
                    <div className="text-primary small mr-2">
                      {timetable.id}
                    </div>
                    <div className="flex-grow-1">{timetable.name}</div>
                    <div className="small">
                      {datetime2string(timetable.modified)}
                    </div>
                  </div>
                </div>
              ))) : null }
          </div>
          <div className="d-flex">
            <button className="btn btn-secondary flex-fill mr-2" type="button" data-dismiss="modal">
              {t('translation:common.close')}
            </button>
          </div>
        </>
      </ModalBodySNCF>
    </ModalSNCF>
  );
}
