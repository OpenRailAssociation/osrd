import React, { useContext, useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/operationalStudies.svg';
import { useTranslation } from 'react-i18next';
import Timetable from 'applications/operationalStudies/components/Scenario/Timetable';
import infraLogo from 'assets/pictures/components/tracks.svg';
import ScenarioLoader from 'applications/operationalStudies/components/Scenario/ScenarioLoader';
import { useSelector, useDispatch } from 'react-redux';
import { MODES, MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { updateInfraID, updateMode, updateTimetableID } from 'reducers/osrdconf';
import TimetableManageTrainSchedule from 'applications/operationalStudies/components/Scenario/TimetableManageTrainSchedule';
import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import { getProjectID, getScenarioID, getStudyID } from 'reducers/osrdconf/selectors';
import { get } from 'common/requests';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { FaPencilAlt } from 'react-icons/fa';
import { setSuccess } from 'reducers/main';
import { GiElectric } from 'react-icons/gi';
import SimulationResults from './SimulationResults';
import ManageTrainSchedule from './ManageTrainSchedule';
import { PROJECTS_URI, SCENARIOS_URI, STUDIES_URI } from '../components/operationalStudiesConsts';
import getTimetable from '../components/Scenario/getTimetable';
import AddAndEditScenarioModal from '../components/Scenario/AddOrEditScenarioModal';

export default function Scenario() {
  const dispatch = useDispatch();
  const { t } = useTranslation('operationalStudies/scenario');
  const isUpdating = useSelector((state) => state.osrdsimulation.isUpdating);
  const [project, setProject] = useState();
  const [study, setStudy] = useState();
  const [scenario, setScenario] = useState();
  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const { openModal } = useContext(ModalContext);
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const scenarioID = useSelector(getScenarioID);

  const getProject = async () => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}/`);
      setProject(result);
    } catch (error) {
      console.error(error);
    }
  };
  const getStudy = async () => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}/`);
      setStudy(result);
    } catch (error) {
      console.error(error);
    }
  };
  const getScenario = async (withNotification = false) => {
    try {
      const result = await get(
        `${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}${SCENARIOS_URI}${scenarioID}/`
      );
      setScenario(result);
      dispatch(updateTimetableID(result.timetable));
      dispatch(updateInfraID(result.infra));
      getTimetable(result.timetable);
      if (withNotification) {
        dispatch(
          setSuccess({
            title: t('scenarioUpdated'),
            text: t('scenarioUpdatedDetails', { name: scenario.name }),
          })
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    getProject();
    getStudy();
    getScenario();
    dispatch(updateMode(MODES.simulation));
    return () => {
      dispatch(updateTimetableID(undefined));
      dispatch(updateInfraID(undefined));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return scenario ? (
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs
            projectName={project ? project.name : null}
            studyName={study ? study.name : null}
            scenarioName={scenario ? scenario.name : null}
          />
        }
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="scenario">
          {isUpdating && <ScenarioLoader msg={t('isUpdating')} />}
          <div className="row">
            <div className="col-lg-4">
              <div className="scenario-sidemenu">
                {scenario && (
                  <div className="scenario-details">
                    <div className="scenario-details-name">
                      {scenario.name}
                      <button
                        className="scenario-details-modify-button"
                        type="button"
                        onClick={() =>
                          openModal(
                            <AddAndEditScenarioModal
                              editionMode
                              scenario={scenario}
                              getScenario={getScenario}
                            />
                          )
                        }
                      >
                        <span className="scenario-details-modify-button-text">
                          {t('modifyScenario')}
                        </span>
                        <FaPencilAlt />
                      </button>
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="scenario-details-infra-name">
                          <img src={infraLogo} alt="Infra logo" className="mr-2" />
                          {scenario.infra_name}
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
                    <div className="scenario-details-description">
                      {scenario.description}
                    </div>
                  </div>
                )}
                {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && (
                  <TimetableManageTrainSchedule
                    displayTrainScheduleManagement={displayTrainScheduleManagement}
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                  />
                )}
                <Timetable setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement} />
              </div>
            </div>
            <div className="col-lg-8">
              {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && (
                <div className="scenario-managetrainschedule">
                  <ManageTrainSchedule
                    displayTrainScheduleManagement={displayTrainScheduleManagement}
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                  />
                </div>
              )}
              <div className="scenario-results">
                <SimulationResults />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  ) : null;
}
