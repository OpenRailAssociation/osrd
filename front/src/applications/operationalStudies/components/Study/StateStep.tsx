import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { StudyState } from 'applications/operationalStudies/consts';
import { osrdEditoastApi, type StudyResponse } from 'common/api/osrdEditoastApi';
import { setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';

type Props = {
  study: StudyResponse;
  number: number;
  state: StudyState;
  done: boolean;
};

export default function StateStep({ study, number, state, done }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  const dispatch = useAppDispatch();
  const [patchStudy] =
    osrdEditoastApi.endpoints.patchProjectsByProjectIdStudiesAndStudyId.useMutation();

  const changeStudyState = async () => {
    try {
      const actual_end_date =
        state === 'finish' ? new Date().toISOString().split('T')[0] : study.actual_end_date;
      await patchStudy({
        projectId: study.project.id,
        studyId: study.id,
        studyPatchForm: { ...study, actual_end_date, state },
      });
      dispatch(
        setSuccess({
          title: t('studyUpdated'),
          text: t('studyUpdatedDetails', { name: study.name }),
        })
      );
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <div
      className={cx('study-details-state-step', { done })}
      role="button"
      tabIndex={0}
      onClick={() => changeStudyState()}
    >
      <span className="study-details-state-step-number">{number}</span>
      <span data-testid="study-state-step-label" className="study-details-state-step-label">
        {t(`studyStates.${state}`)}
      </span>
    </div>
  );
}
