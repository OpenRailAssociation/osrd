import React from 'react';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { StudyState } from 'applications/operationalStudies/consts';
import { useDispatch } from 'react-redux';
import { setSuccess } from 'reducers/main';

type Props = {
  projectID: number;
  studyID: number;
  number: number;
  studyName: string;
  state: StudyState;
  done: boolean;
  tags: string[];
};

export default function StateStep({
  projectID,
  studyID,
  number,
  studyName,
  state,
  done,
  tags,
}: Props) {
  const { t } = useTranslation('operationalStudies/study');
  const dispatch = useDispatch();
  const [patchStudy] = osrdEditoastApi.usePatchProjectsByProjectIdStudiesAndStudyIdMutation();

  const changeStudyState = async () => {
    try {
      await patchStudy({
        projectId: projectID,
        studyId: studyID,
        studyUpsertRequest: { name: studyName, state, tags },
      });
      dispatch(
        setSuccess({
          title: t('studyUpdated'),
          text: t('studyUpdatedDetails', { name: studyName }),
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
      <span className="study-details-state-step-label">{t(`studyStates.${state}`)}</span>
    </div>
  );
}
