import { useState } from 'react';

import { Button, Dialog, Input } from '@osrd-project/ui-core';
import { noop } from 'lodash';
import { useTranslation } from 'react-i18next';

import { useScenarioContextWithOptionalTimetable } from 'applications/operationalStudies/hooks/useScenarioContext';
import useUrlOrStorageParam from 'applications/operationalStudies/hooks/useUrlOrStorageParam';
import { osrdEditoastApi, type TimetableType } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

type AddOrEditTimetableModalProps = {
  timetableType: TimetableType;
  onCancel: () => void;
};

const AddOrEditTimetableModal = ({ timetableType, onCancel }: AddOrEditTimetableModalProps) => {
  'use memo';

  const { t } = useTranslation(['operational-studies', 'translation']);
  const dispatch = useAppDispatch();
  const { scenario } = useScenarioContextWithOptionalTimetable();
  const { setParamsInUrlAndStorage } = useUrlOrStorageParam('timetable');
  const [postTimetable] = osrdEditoastApi.endpoints.postTimetable.useMutation();
  const [patchScenario] = osrdEditoastApi.endpoints.patchScenariosByScenarioId.useMutation();
  const [getScenario] = osrdEditoastApi.endpoints.getScenariosByScenarioId.useLazyQuery();
  const [name, setName] = useState('');
  const [displayError, setDisplayError] = useState(false);

  const title =
    timetableType === 'HOURLY'
      ? t('main.scenarioAddHourlyPatternModalTitle')
      : t('main.scenarioAddCalendarModalTitle');

  const isNameInvalid = !name.trim();

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isNameInvalid) {
      setDisplayError(true);
      return;
    }
    try {
      const timetable = await postTimetable({
        timetableForm: { timetable_type: timetableType, timetable_name: name.trim() },
      }).unwrap();
      // No need to create the sandbox here, useScenario creates it once the timetable is selected
      // The patch replaces all the timetables of the scenario, so we keep the existing ones
      await patchScenario({
        scenarioId: scenario.id,
        scenarioPatchForm: {
          timetable_ids: [
            ...scenario.timetable_summaries.map(({ id }) => id),
            timetable.timetable_id,
          ],
        },
      }).unwrap();
      // Wait for the scenario with the new timetable, otherwise useScenario doesn't know it yet
      // and falls back on the first timetable when we select it
      await getScenario({ scenarioId: scenario.id }).unwrap();
      setParamsInUrlAndStorage('timetable', String(timetable.timetable_id));
      onCancel();
    } catch (error) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
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
            displayError && isNameInvalid
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
