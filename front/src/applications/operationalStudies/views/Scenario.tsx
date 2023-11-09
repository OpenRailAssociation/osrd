import React, { useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/operationalStudies.svg';
import { useTranslation } from 'react-i18next';
import Timetable from 'modules/trainschedule/components/Timetable/Timetable';
import infraLogo from 'assets/pictures/components/tracks.svg';
import { useSelector, useDispatch } from 'react-redux';
import { MODES, MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { updateInfraID, updateMode, updateTimetableID } from 'reducers/osrdconf';
import TimetableManageTrainSchedule from 'modules/trainschedule/components/Timetable/TimetableManageTrainSchedule';
import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import { getInfraID, getTimetableID } from 'reducers/osrdconf/selectors';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { FaEye, FaEyeSlash, FaPencilAlt } from 'react-icons/fa';
import { GiElectric } from 'react-icons/gi';
import { useNavigate, useParams } from 'react-router-dom';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import AddAndEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import { RootState } from 'reducers';
import { updateSimulation } from 'reducers/osrdsimulation/actions';
import ImportTrainSchedule from './ImportTrainSchedule';
import ManageTrainSchedule from './ManageTrainSchedule';
import SimulationResults from './SimulationResults';
import InfraLoadingState from '../components/Scenario/InfraLoadingState';

type SimulationParams = {
  projectId: string;
  studyId: string;
  scenarioId: string;
};

export default function Scenario() {
  const dispatch = useDispatch();
  const { t } = useTranslation('operationalStudies/scenario');
  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState<string>(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const [trainsWithDetails, setTrainsWithDetails] = useState(false);
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);
  const [isInfraLoaded, setIsInfraLoaded] = useState(false);
  const [reloadCount, setReloadCount] = useState(1);
  const isUpdating = useSelector((state: RootState) => state.osrdsimulation.isUpdating);

  const { openModal } = useModal();
  const navigate = useNavigate();
  const { projectId, studyId, scenarioId } = useParams() as SimulationParams;
  const infraId = useSelector(getInfraID);
  const timetableId = useSelector(getTimetableID);

  const { data: project } = osrdEditoastApi.endpoints.getProjectsByProjectId.useQuery(
    {
      projectId: +projectId,
    },
    { skip: !projectId || Number.isNaN(+projectId) }
  );
  const { data: study } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyId.useQuery(
      { projectId: +projectId, studyId: +studyId },
      {
        skip: !projectId || Number.isNaN(+projectId) || !studyId || Number.isNaN(+studyId),
      }
    );
  const { data: scenario } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useQuery(
      {
        projectId: +projectId,
        studyId: +studyId,
        scenarioId: +scenarioId,
      },
      {
        skip:
          !projectId ||
          Number.isNaN(+projectId) ||
          !studyId ||
          Number.isNaN(+studyId) ||
          !scenarioId ||
          Number.isNaN(+scenarioId),
      }
    );

  useEffect(() => {
    if (scenario) {
      dispatch(updateTimetableID(scenario.timetable_id));
      dispatch(updateInfraID(scenario.infra_id));
    }
  }, [scenario]);

  const { data: infra } = osrdEditoastApi.useGetInfraByIdQuery(
    { id: infraId as number },
    {
      skip: !infraId,
      refetchOnMountOrArgChange: true,
      pollingInterval: !isInfraLoaded ? 1000 : undefined,
    }
  );
  const [reloadInfra] = osrdEditoastApi.usePostInfraByIdLoadMutation();

  useEffect(() => {
    if (reloadCount <= 5 && infra && infra.state === 'TRANSIENT_ERROR') {
      setTimeout(() => {
        reloadInfra({ id: infraId as number }).unwrap();
        setReloadCount((count) => count + 1);
      }, 1000);
    }
  }, [infra, reloadCount]);

  useEffect(() => {
    if (infra && (infra.state === 'NOT_LOADED' || infra.state === 'DOWNLOADING')) {
      setIsInfraLoaded(false);
    }

    if (
      infra &&
      (infra.state === 'CACHED' || infra.state === 'ERROR' || infra.state === 'TRANSIENT_ERROR')
    ) {
      setIsInfraLoaded(true);
    }
  }, [infra]);

  useEffect(() => {
    if (infraId) {
      reloadInfra({ id: infraId as number }).unwrap();
    }
  }, [infraId]);

  /*
   * Timetable is refetched automatically if a train schedule is updated or deleted
   * but not if one is created (in importTrainScheduleModal, we don't want to refetch
   * the timetable each time a train is created), that is why the refetch is needed here
   */
  const { data: timetable, refetch: refetchTimetable } =
    osrdEditoastApi.endpoints.getTimetableById.useQuery(
      { id: timetableId as number },
      { skip: !timetableId }
    );

  useEffect(() => {
    if (!projectId || !studyId || !scenarioId) navigate('/operational-studies/projects');
    // redirect if projectId or studyId is not a number
    if (projectId && Number.isNaN(+projectId)) navigate('/operational-studies/projects');
    if (studyId && Number.isNaN(+studyId)) navigate(`/operational-studies/projects/${projectId}`);
    if (scenarioId && Number.isNaN(+scenarioId))
      navigate(`/operational-studies/projects/${projectId}/studies/${studyId}`);
  }, [projectId, studyId, scenarioId]);

  useEffect(() => {
    if (!scenarioId || !studyId || !projectId) {
      navigate('/operational-studies/study');
    } else {
      dispatch(updateMode(MODES.simulation));
    }
    return () => {
      dispatch(updateTimetableID(undefined));
      dispatch(updateInfraID(undefined));
      dispatch(updateSimulation({ trains: [] }));
    };
  }, []);

  return scenario && infraId && timetableId ? (
    <>
      <NavBarSNCF
        appName={<BreadCrumbs project={project} study={study} scenario={scenario} />}
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="scenario">
          <div className="row scenario-container">
            <div className={collapsedTimetable ? 'd-none' : 'col-hdp-3 col-xl-4 col-lg-5 col-md-6'}>
              <div className="scenario-sidemenu">
                {scenario && (
                  <div className="scenario-details">
                    <div className="scenario-details-name">
                      <span className="flex-grow-1 scenario-name">{scenario.name}</span>
                      <button
                        data-testid="editScenario"
                        className="scenario-details-modify-button"
                        type="button"
                        onClick={() =>
                          openModal(<AddAndEditScenarioModal editionMode scenario={scenario} />)
                        }
                        title={t('editScenario')}
                      >
                        <FaPencilAlt />
                      </button>
                      <button
                        type="button"
                        className="scenario-details-modify-button"
                        onClick={() => setTrainsWithDetails(!trainsWithDetails)}
                        title={t('displayTrainsWithDetails')}
                      >
                        {trainsWithDetails ? <FaEyeSlash /> : <FaEye />}
                      </button>
                      <button
                        type="button"
                        className="scenario-details-modify-button"
                        onClick={() => setCollapsedTimetable(true)}
                      >
                        <i className="icons-arrow-prev" />
                      </button>
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="scenario-details-infra-name">
                          <img src={infraLogo} alt="Infra logo" className="mr-2" />
                          {infra && <InfraLoadingState infra={infra} />}
                          <span className="scenario-infra-name">{scenario.infra_name}</span>
                          <small className="ml-auto text-muted">ID {scenario.infra_id}</small>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="scenario-details-electrical-profile-set">
                          <span className="mr-2">
                            <GiElectric />
                          </span>
                          {scenario.electrical_profile_set_name
                            ? scenario.electrical_profile_set_name
                            : t('noElectricalProfileSet')}
                        </div>
                      </div>
                    </div>
                    {infra &&
                      infra.state === 'TRANSIENT_ERROR' &&
                      (reloadCount <= 5 ? (
                        <div className="scenario-details-infra-error mt-1">
                          {t('errorMessages.unableToLoadInfra', { reloadCount })}
                        </div>
                      ) : (
                        <div className="scenario-details-infra-error mt-1">
                          {t('errorMessages.softErrorInfra')}
                        </div>
                      ))}
                    {infra && infra.state === 'ERROR' && (
                      <div className="scenario-details-infra-error mt-1">
                        {t('errorMessages.hardErrorInfra')}
                      </div>
                    )}
                    <div className="scenario-details-description">{scenario.description}</div>
                  </div>
                )}
                {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && infra && (
                  <TimetableManageTrainSchedule
                    displayTrainScheduleManagement={displayTrainScheduleManagement}
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                    infraState={infra.state}
                    refetchTimetable={refetchTimetable}
                  />
                )}
                {infra && (
                  <Timetable
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                    trainsWithDetails={trainsWithDetails}
                    infraState={infra.state}
                    timetable={timetable}
                    refetchTimetable={refetchTimetable}
                  />
                )}
              </div>
            </div>
            <div className={collapsedTimetable ? 'col-12' : 'col-hdp-9 col-xl-8 col-lg-7 col-md-6'}>
              {(!isInfraLoaded || isUpdating) &&
                displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.add &&
                displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
                  <ScenarioLoaderMessage infraState={infra?.state} />
                )}
              {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
                displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
                <div className="scenario-managetrainschedule">
                  <ManageTrainSchedule />
                </div>
              )}
              {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import && (
                <div className="scenario-managetrainschedule">
                  <ImportTrainSchedule infraId={infraId} timetableId={timetableId} />
                </div>
              )}
              <div className="scenario-results">
                {collapsedTimetable && (
                  <div className="scenario-timetable-collapsed">
                    <button
                      className="timetable-collapse-button"
                      type="button"
                      onClick={() => setCollapsedTimetable(false)}
                    >
                      <i className="icons-arrow-next" />
                    </button>
                    <div className="lead ml-2">{scenario.name}</div>
                    <div className="d-flex align-items-center ml-auto">
                      <img src={infraLogo} alt="Infra logo" className="mr-2" height="16" />
                      {scenario.infra_name}
                    </div>
                    <div className="d-flex align-items-center ml-4">
                      <span className="mr-1">
                        <GiElectric />
                      </span>
                      {scenario.electrical_profile_set_name
                        ? scenario.electrical_profile_set_name
                        : t('noElectricalProfileSet')}
                    </div>
                  </div>
                )}
                {isInfraLoaded && infra && (
                  <SimulationResults
                    isDisplayed={
                      displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.import
                    }
                    collapsedTimetable={collapsedTimetable}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  ) : null;
}
