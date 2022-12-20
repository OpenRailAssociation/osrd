import React from 'react';
import PropTypes from 'prop-types';
import { deleteRequest } from 'common/requests';
import { useTranslation } from 'react-i18next';
import Countdown from 'react-countdown';

const TIMETABLE_URL = '/timetable/';

export default function TimetableSelectorEditionActionsBarDelete(props) {
  const { getTimetablesList, setRunningDelete, timetable } = props;
  const { t } = useTranslation('timetableManagement');

  async function deleteTimetable() {
    try {
      await deleteRequest(`${TIMETABLE_URL}${timetable.id}/`);
      setRunningDelete(undefined);
      getTimetablesList();
    } catch (e) {
      console.log(e);
    }
  }

  const countDownDelete = ({ seconds, completed }) => {
    if (completed) {
      return (
        <button
          type="button"
          className="timetableslist-item-edition-delete-buttons yes"
          onClick={deleteTimetable}
        >
          {t('yes')}
        </button>
      );
    }
    return (
      <button type="button" className="timetableslist-item-edition-delete-buttons almost-yes">
        {seconds}s
      </button>
    );
  };

  return (
    <div className="timetableslist-item-edition-delete">
      <div className="timetableslist-item-edition-delete-main">
        <div>
          <div className="small">{t('deleteConfirm')}</div>
          <div className="font-weight-bold">{timetable.name}</div>
        </div>
      </div>
      <button
        type="button"
        className="timetableslist-item-edition-delete-buttons no"
        onClick={() => {
          setRunningDelete(undefined);
        }}
      >
        {t('no')}
      </button>
      <Countdown date={Date.now() + 3000} renderer={countDownDelete} />
    </div>
  );
}

TimetableSelectorEditionActionsBarDelete.propTypes = {
  getTimetablesList: PropTypes.func.isRequired,
  timetable: PropTypes.object.isRequired,
  setRunningDelete: PropTypes.func.isRequired,
};
