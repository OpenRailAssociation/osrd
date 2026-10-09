import { useState } from 'react';

import { Button, Dialog, Input } from '@osrd-project/ui-core';
import { noop } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { TimetableType } from 'common/api/osrdEditoastApi';

type AddOrEditTimetableModalProps = {
  timetableType: TimetableType;
  onCancel: () => void;
};

const AddOrEditTimetableModal = ({ timetableType, onCancel }: AddOrEditTimetableModalProps) => {
  const { t } = useTranslation(['operational-studies', 'translation']);
  const [name, setName] = useState('');
  const [displayError, setDisplayError] = useState(false);

  const title =
    timetableType === 'HOURLY'
      ? t('main.scenarioAddHourlyPatternModalTitle')
      : t('main.scenarioAddCalendarModalTitle');

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setDisplayError(true);
      return;
    }
    // TODO(#18904): create the timetable and attach it to the scenario once editoast
    // supports linking several timetables to a scenario (#18863/#18857).
    onCancel();
  };

  return (
    <Dialog
      className="scenario-add-or-edit-timetable-modal"
      headerClassname="add-or-edit-timetable-header"
      bodyClassname="add-or-edit-timetable-body"
      footerClassname="add-or-edit-timetable-footer"
      header={<h1>{title}</h1>}
      footer={
        <>
          <Button
            variant="Cancel"
            type="reset"
            label={t('translation:common.cancel')}
            onClick={onCancel}
          />
          <Button
            type="submit"
            form="add-or-edit-timetable-form"
            label={t('translation:common.save')}
            onClick={noop}
          />
        </>
      }
    >
      <form id="add-or-edit-timetable-form" onSubmit={handleSubmit}>
        <Input
          id="timetableName"
          type="text"
          name="timetableName"
          label={t('main.scenarioTimetableNameLabel')}
          /* eslint-disable-next-line jsx-a11y/no-autofocus */
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          statusWithMessage={
            displayError
              ? {
                  message: t('main.scenarioTimetableNameInvalid'),
                  status: 'error',
                }
              : undefined
          }
        />
      </form>
    </Dialog>
  );
};

export default AddOrEditTimetableModal;
