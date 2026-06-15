import { Button, DatePicker, TimePicker } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import { ANY_DATE_SLOT } from './ExpandedTrainForm';

type ExtraOccurrenceFormProps = {
  addedExceptionDate: Date;
  setAddedExceptionDate: (newDate: Date) => void;
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
      <DatePicker
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
      <div className="actions">
        <Button
          id={'train-add-extra-occurrence-time-add'}
          label={t('manageTrainSchedule.trainHeader.form.add')}
          size="small"
          onClick={onCreateAddedException}
        />
      </div>
    </div>
  );
};

export default ExtraOccurrenceForm;
