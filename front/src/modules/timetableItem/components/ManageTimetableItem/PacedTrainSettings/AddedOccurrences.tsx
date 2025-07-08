import { useEffect, useState } from 'react';

import { Clock, Calendar, Trash, Dot } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { addAddedException, deleteAddedException } from 'reducers/osrdconf/operationalStudiesConf';
import { getAddedExceptions } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { formatLocalDate, formatLocalTime } from 'utils/date';

const AddedOccurrences = () => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const addedExceptions = useSelector(getAddedExceptions);
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
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
    <div className="added-occurrences" data-testid="added-occurrences">
      <h2 data-testid="added-occurrences-title">{t('pacedTrains.addExtraOccurrences')}</h2>
      <div className="controls">
        <span data-testid="" className="mr-3">
          <InputSNCF
            type="date"
            label={
              <>
                <Calendar className="input-icon" />
                <small className="text-nowrap">{t('pacedTrains.departureDay')}</small>
              </>
            }
            id="added-occurrences-date"
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
            id="added-occurrences-time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
            }}
            noMargin
            textRight
            sm
          />
        </span>
        <button
          className="add-button"
          data-testid="added-occurrences-add-button"
          type="button"
          onClick={handleAddException}
        >
          {t('pacedTrains.add')}
        </button>
      </div>
      <ul className="list" data-testid="added-occurrences-list">
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

export default AddedOccurrences;
