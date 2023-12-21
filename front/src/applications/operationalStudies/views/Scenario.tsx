import React, { useEffect, useMemo, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
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
import { GoPencil } from 'react-icons/go';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { GiElectric } from 'react-icons/gi';
import { useParams } from 'react-router-dom';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import AddAndEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';
import ScenarioLoaderMessage from 'modules/scenario/components/ScenarioLoaderMessage';
import { RootState } from 'reducers';
import { updateSelectedProjection, updateSimulation } from 'reducers/osrdsimulation/actions';
import {
  getAllowancesSettings,
  getSelectedProjection,
  getSelectedTrainId,
} from 'reducers/osrdsimulation/selectors';
import ImportTrainSchedule from './ImportTrainSchedule';
import ManageTrainSchedule from './ManageTrainSchedule';
import SimulationResults from './SimulationResults';
import InfraLoadingState from '../components/Scenario/InfraLoadingState';
import getSimulationResults, {
  selectProjection,
} from '../components/Scenario/getSimulationResults';

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

  const {
    projectId: urlProjectId,
    studyId: urlStudyId,
    scenarioId: urlScenarioId,
  } = useParams() as SimulationParams;
  const infraId = useSelector(getInfraID);
  const timetableId = useSelector(getTimetableID);
  const selectedTrainId = useSelector(getSelectedTrainId);
  const selectedProjection = useSelector(getSelectedProjection);
  const allowancesSettings = useSelector(getAllowancesSettings);

  const { projectId, studyId, scenarioId } = useMemo(
    () => ({
      projectId: !Number.isNaN(+urlProjectId) ? +urlProjectId : undefined,
      studyId: !Number.isNaN(+urlStudyId) ? +urlStudyId : undefined,
      scenarioId: !Number.isNaN(+urlScenarioId) ? +urlScenarioId : undefined,
    }),
    [urlStudyId, urlProjectId, urlScenarioId]
  );

  const {
    data: scenario,
    isError: isScenarioError,
    error: errorScenario,
  } = osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useQuery(
    {
      projectId: projectId!,
      studyId: studyId!,
      scenarioId: scenarioId!,
    },
    {
      skip: !projectId || !studyId || !scenarioId,
    }
  );

  useEffect(() => {
    if (isScenarioError && errorScenario) throw errorScenario;
  }, [isScenarioError, errorScenario]);

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
      {
        skip: !timetableId,
        // This cause the timetable to refetch each time the component mounts
        refetchOnMountOrArgChange: true,
      }
    );

  const { data: conflicts = [], refetch: refetchConflicts } =
    osrdEditoastApi.endpoints.getTimetableByIdConflicts.useQuery(
      { id: timetable?.id as number },
      { skip: !timetable }
    );

  useEffect(() => {
    if (timetable && infra?.state === 'CACHED' && timetable.train_schedule_summaries.length > 0) {
      selectProjection(timetable.train_schedule_summaries, selectedProjection, selectedTrainId);
    }
  }, [timetable, infra]);

  useEffect(() => {
    if (timetable && infra?.state === 'CACHED' && selectedProjection) {
      getSimulationResults(timetable, selectedProjection, allowancesSettings);
    }
  }, [timetable, infra, selectedProjection]);

  useEffect(() => {
    if (!projectId || !studyId || !scenarioId) {
      throw new Error('Missing projectId, studyId or scenarioId');
    } else {
      dispatch(updateMode(MODES.simulation));
    }
  }, [projectId, studyId, scenarioId]);

  useEffect(
    () => () => {
      dispatch(updateTimetableID(undefined));
      dispatch(updateInfraID(undefined));
      dispatch(updateSimulation({ trains: [] }));
      dispatch(updateSelectedProjection(undefined));
    },
    []
  );

  return scenario && infraId && timetableId ? (
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs project={scenario?.project} study={scenario?.study} scenario={scenario} />
        }
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
                        <GoPencil />
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
                    refetchConflicts={refetchConflicts}
                  />
                )}
                {infra && (
                  <Timetable
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                    trainsWithDetails={trainsWithDetails}
                    infraState={infra.state}
                    timetable={timetable}
                    selectedTrainId={selectedTrainId}
                    refetchTimetable={refetchTimetable}
                    conflicts={conflicts}
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
