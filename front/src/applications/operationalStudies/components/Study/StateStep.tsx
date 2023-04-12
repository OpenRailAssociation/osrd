import React from 'react';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

type StateType = 'started' | 'inProgress' | 'finish';

type StateType = 'started' | 'inProgress' | 'finish';

type Props = {
  projectID: number;
  studyID: number;
  getStudy: (withNotification: boolean) => void;
  number: number;
  state: StateType;
  done: boolean;
};

export default function StateStep({ projectID, studyID, getStudy, number, state, done }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  const [patchStudy] = osrdEditoastApi.usePatchProjectsByProjectIdStudiesAndStudyIdMutation();

  const changeStudyState = async () => {
    try {
      await patchStudy({
        projectId: projectID,
        studyId: studyID,
        studyPatchRequest: { state },
      });
      getStudy(true);
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
