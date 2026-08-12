import { Button, DatePicker, TimePicker, DurationInput } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import { Duration, type StartTime } from 'utils/duration';

import { ANY_DATE_SLOT } from './ExpandedTrainForm';

type ExtraOccurrenceFormProps = {
  addedExceptionDate: StartTime;
  setAddedExceptionDate: (newDate: StartTime) => void;
  onCreateAddedException: () => void;
};

const ExtraOccurrenceForm = ({
  addedExceptionDate,
  setAddedExceptionDate,
  onCreateAddedException,
}: ExtraOccurrenceFormProps) => {
  const { t } = useTranslation(['operational-studies']);

  return (
    <div className="train-add-extra-occurrence-form">
      {addedExceptionDate instanceof Date ? (
        <>
          <DatePicker
            testIdPrefix="train-header-extra-occurrence-date"
            value={addedExceptionDate}
            onDateChange={(newDate) => {
              if (newDate) {
                const dateWithTime = new Date(newDate.getTime());
                dateWithTime.setHours(
                  addedExceptionDate.getHours(),
                  addedExceptionDate.getMinutes(),
                  addedExceptionDate.getSeconds()
                );
                setAddedExceptionDate(dateWithTime);
              }
            }}
            selectableSlot={ANY_DATE_SLOT}
            inputProps={{
              id: 'train-add-extra-occurrence-date',
              label: t('manageTrainSchedule.trainHeader.form.departureDate'),
              small: true,
            }}
          />
          <TimePicker
            id={'train-add-extra-occurrence-time'}
            testIdPrefix="train-header-extra-occurrence-time"
            label={t('manageTrainSchedule.trainHeader.form.departureTime')}
            hours={addedExceptionDate.getHours()}
            minutes={addedExceptionDate.getMinutes()}
            seconds={addedExceptionDate.getSeconds()}
            displaySeconds={true}
            onTimeChange={({ hours, minutes, seconds }) => {
              const newDate = new Date(addedExceptionDate.getTime());
              newDate.setHours(hours);
              newDate.setMinutes(minutes);
              newDate.setSeconds(seconds ?? 0);
              setAddedExceptionDate(newDate);
            }}
            small
          />
        </>
      ) : (
        <DurationInput
          id={'train-add-extra-occurrence-time'}
          label={t('manageTrainSchedule.trainHeader.form.departureTime')}
          value={addedExceptionDate.ms}
          units={[
            { key: 'h', label: ':' },
            { key: 'm', label: ':' },
            { key: 's', label: '' },
          ]}
          padChar="0"
          onChange={(milliseconds) => {
            setAddedExceptionDate(new Duration({ milliseconds }));
          }}
          small
        />
      )}
      <div className="actions">
        <Button
          id={'train-add-extra-occurrence-time-add'}
          dataTestID="train-header-extra-occurrence-add-button"
          label={t('manageTrainSchedule.trainHeader.form.add')}
          size="small"
          onClick={onCreateAddedException}
        />
      </div>
    </div>
  );
};

export default ExtraOccurrenceForm;
