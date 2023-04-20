/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import infraIcon from 'assets/pictures/components/tracks.svg';
import scenarioIcon from 'assets/pictures/home/operationalStudies.svg';
import projectIcon from 'assets/pictures/views/projects.svg';
import studyIcon from 'assets/pictures/views/study.svg';
import { useTranslation } from 'react-i18next';
import { MdTrain } from 'react-icons/md';
import { useDispatch } from 'react-redux';
import { updateInfraID, updateTimetableID } from 'reducers/osrdconf';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getDocument } from 'common/api/documentApi';
import ScenarioExplorerModal from './ScenarioExplorerModal';
import { ScenarioExplorerProps } from './ScenarioExplorerTypes';

export default function ScenarioExplorer({
  globalProjectId,
  globalStudyId,
  globalScenarioId,
}: ScenarioExplorerProps) {
  const { t } = useTranslation('common/scenarioExplorer');
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const [imageUrl, setImageUrl] = useState<string>();

  const { data: projectDetails } = osrdEditoastApi.useGetProjectsByProjectIdQuery(
    { projectId: globalProjectId as number },
    { skip: !globalProjectId }
  );

  const { data: studyDetails } = osrdEditoastApi.useGetProjectsByProjectIdStudiesAndStudyIdQuery(
    { projectId: globalProjectId as number, studyId: globalStudyId as number },
    { skip: !globalProjectId && !globalStudyId }
  );

  const { data: scenarioDetails } =
    osrdEditoastApi.useGetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdQuery(
      {
        projectId: globalProjectId as number,
        studyId: globalStudyId as number,
        scenarioId: globalScenarioId as number,
      },
      { skip: !globalProjectId && !globalStudyId && !globalScenarioId }
    );

  const getProjectImage = async (imageId: number) => {
    try {
      const blobImage = await getDocument(imageId);
      setImageUrl(URL.createObjectURL(blobImage));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (scenarioDetails?.timetable_id) {
      dispatch(updateTimetableID(scenarioDetails.timetable_id));
      dispatch(updateInfraID(scenarioDetails.infra_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioDetails]);

  useEffect(() => {
    if (projectDetails?.image) {
      getProjectImage(projectDetails?.image);
    } else {
      setImageUrl(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDetails]);

  return (
    <div
      className="scenario-explorator-card"
      data-testid="scenario-explorator"
      onClick={() => {
        openModal(
          <ScenarioExplorerModal
            globalProjectId={globalProjectId}
            globalStudyId={globalStudyId}
            globalScenarioId={globalScenarioId}
          />,
          'lg'
        );
      }}
      role="button"
      tabIndex={0}
    >
      {globalProjectId &&
      projectDetails &&
      globalStudyId &&
      studyDetails &&
      globalScenarioId &&
      scenarioDetails ? (
        <div className="scenario-explorator-card-head">
          {imageUrl && (
            <div className="scenario-explorator-card-head-img">
              <img src={imageUrl} alt="Project logo" />
            </div>
          )}
          <div className={`scenario-explorator-card-head-content ${imageUrl ? '' : 'no-image'}`}>
            <div className="scenario-explorator-card-head-content-item">
              <img src={projectIcon} alt="project icon" />
              <span className="scenario-explorator-card-head-legend">{t('projectLegend')}</span>
              <div className="scenario-explorator-card-head-project">{projectDetails.name}</div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={studyIcon} alt="study icon" />
              <span className="scenario-explorator-card-head-legend">{t('studyLegend')}</span>
              <div className="scenario-explorator-card-head-study">{studyDetails.name}</div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={scenarioIcon} alt="scenario icon" />
              <span className="scenario-explorator-card-head-legend">{t('scenarioLegend')}</span>
              <div className="scenario-explorator-card-head-scenario">
                {scenarioDetails.name}
                <span className="scenario-explorator-card-head-scenario-traincount">
                  {scenarioDetails.trains_count}
                  <MdTrain />
                </span>
              </div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={infraIcon} alt="infra icon" />
              <span className="scenario-explorator-card-head-legend">{t('infraLegend')}</span>
              <div className="scenario-explorator-card-head-infra">
                {scenarioDetails.infra_name}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="scenario-explorator-card-noscenario">{t('noScenarioSelected')}</div>
      )}
    </div>
  );
}
