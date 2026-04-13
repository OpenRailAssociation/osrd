import { skipToken } from '@reduxjs/toolkit/query';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { MdTrain } from 'react-icons/md';

import infraIcon from 'assets/pictures/components/tracks.svg';
import scenarioIcon from 'assets/pictures/home/operationalStudies.svg';
import projectIcon from 'assets/pictures/views/projects.svg';
import studyIcon from 'assets/pictures/views/study.svg';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { LoaderFill } from 'common/Loaders';
import { useProjectImage } from 'utils/hooks/useProjectImage';

import ScenarioExplorerModal, { type ScenarioExplorerProps } from './ScenarioExplorerModal';

const ScenarioExplorer = ({
  globalProjectId,
  globalStudyId,
  globalScenarioId,
  displayImgProject = true,
}: ScenarioExplorerProps & {
  displayImgProject?: boolean;
}) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'scenarioExplorer' });
  const { openModal } = useModal();

  const { data: projectDetails } = osrdEditoastApi.endpoints.getProjectsByProjectId.useQuery(
    globalProjectId ? { projectId: globalProjectId } : skipToken
  );

  const { data: studyDetails } = osrdEditoastApi.endpoints.getStudiesByStudyId.useQuery(
    globalStudyId ? { studyId: globalStudyId } : skipToken
  );

  const { currentData: scenario } = osrdEditoastApi.endpoints.getScenariosByScenarioId.useQuery(
    globalScenarioId
      ? {
          scenarioId: globalScenarioId,
        }
      : skipToken,
    {
      refetchOnMountOrArgChange: true,
    }
  );

  const imageUrl = useProjectImage(projectDetails?.image);

  const showNoScenarioContent = () =>
    globalScenarioId && !scenario ? (
      <LoaderFill />
    ) : (
      <div className="scenario-explorator-card-noscenario">{t('noScenarioSelected')}</div>
    );

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
      {globalProjectId && projectDetails && studyDetails && scenario ? (
        <div className="scenario-explorator-card-head">
          {displayImgProject && imageUrl && (
            <div className="scenario-explorator-card-head-img">
              <img src={imageUrl} alt="Project logo" />
            </div>
          )}
          <div
            className={cx('scenario-explorator-card-head-content', {
              'no-image': !imageUrl,
              'ml-0': !displayImgProject,
            })}
          >
            <div className="scenario-explorator-card-head-content-item">
              <img src={projectIcon} alt="project icon" />
              <span className="scenario-explorator-card-head-legend">{t('projectLegend')}</span>
              <div className="scenario-explorator-card-head-project">
                <span className="text-truncate" title={projectDetails.name}>
                  {projectDetails.name}
                </span>
              </div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={studyIcon} alt="study icon" />
              <span className="scenario-explorator-card-head-legend">{t('studyLegend')}</span>
              <div className="scenario-explorator-card-head-study">
                <span className="text-truncate" title={studyDetails.name}>
                  {studyDetails.name}
                </span>
              </div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={scenarioIcon} alt="scenario icon" />
              <span className="scenario-explorator-card-head-legend">{t('scenarioLegend')}</span>
              <div className="scenario-explorator-card-head-scenario">
                <span className="text-truncate" title={scenario.name}>
                  {scenario.name}
                </span>

                <span className="scenario-explorator-card-head-scenario-traincount">
                  {scenario.train_schedules_count}
                  <MdTrain />
                </span>
              </div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={infraIcon} alt="infra icon" />
              <span className="scenario-explorator-card-head-legend">{t('infraLegend')}</span>
              <div className="scenario-explorator-card-head-infra">{scenario.infra_name}</div>
            </div>
          </div>
        </div>
      ) : (
        showNoScenarioContent()
      )}
    </div>
  );
};

export default ScenarioExplorer;
