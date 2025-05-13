import { useEffect, useState } from 'react';

import { Clock, Calendar, Trash, Dot } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { addAddedException, deleteAddedException } from 'reducers/osrdconf/operationalStudiesConf';
import { getAddedExceptions } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { formatLocalDate, formatLocalTime } from 'utils/date';

const AddedOccurences = () => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const addedExceptions = useSelector(getAddedExceptions);
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });
  const dispatch = useAppDispatch();

  useEffect(() => {
    const now = new Date();
    setDate(formatLocalDate(now));
    setTime(formatLocalTime(now));
  }, []);

  function handleAddException() {
    dispatch(addAddedException(new Date(`${date}T${time}`)));
  }

  function handleDeleteException(key: string) {
    dispatch(deleteAddedException(key));
  }

  return (
    <div className="added-occurences">
      <h2>{t('pacedTrains.addExtraOccurrences')}</h2>
      <div className="controls">
        <span className="mr-3">
          <InputSNCF
            type="date"
            label={
              <>
                <Calendar className="input-icon" />
                <small className="text-nowrap">{t('pacedTrains.departureDay')}</small>
              </>
            }
            id="paced-train-exception-date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
            }}
            noMargin
            textRight
            sm
          />
        </span>
        <span>
          <InputSNCF
            type="time"
            label={
              <>
                <Clock className="input-icon" />
                <small className="text-nowrap">{t('pacedTrains.departureTime')}</small>
              </>
            }
            id="paced-train-exception-time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
            }}
            noMargin
            textRight
            sm
          />
        </span>
        <button className="add-button" type="button" onClick={handleAddException}>
          {t('pacedTrains.add')}
        </button>
      </div>
      <ul className="list">
        {addedExceptions.map(
          ({ startTime, key }) =>
            startTime && (
              <li key={key}>
                <Dot className="input-icon" variant="fill" />
                {startTime.toLocaleString()}
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteException(key);
                  }}
                >
                  <Trash className="input-icon" />
                </button>
              </li>
            )
        )}
      </ul>
    </div>
  );
};

export default AddedOccurences;
