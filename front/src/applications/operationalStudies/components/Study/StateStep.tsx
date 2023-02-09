import { patch } from 'common/requests';
import React from 'react';
import { useTranslation } from 'react-i18next';
import cx from 'classnames';
import { PROJECTS_URI, STUDIES_URI } from '../operationalStudiesConsts';

type Props = {
  projectID: number;
  studyID: number;
  getStudy: (withNotification: boolean) => void;
  number: number;
  state: string;
  done: boolean;
};

export default function StateStep({ projectID, studyID, getStudy, number, state, done }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  const changeStudyState = async () => {
    try {
      await patch(`${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}/`, { state });
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
