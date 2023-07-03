import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import Map from 'applications/operationalStudies/components/ImportTrainSchedule/Map';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getRollingStockID, getInfraID, getTimetableID } from 'reducers/osrdconf/selectors';
import generatePathfindingPayload from 'applications/operationalStudies/components/ImportTrainSchedule/generatePathfindingPayload';
import generateTrainSchedulesPayload from 'applications/operationalStudies/components/ImportTrainSchedule/generateTrainSchedulesPayload';
import getTimetable from 'applications/operationalStudies/components/Scenario/getTimetable';
import {
  initialViewport,
  initialStatus,
} from 'applications/operationalStudies/components/ImportTrainSchedule//consts';
import { refactorUniquePaths } from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleHelpers';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import ImportTrainScheduleModalFooter from './ImportTrainScheduleModalFooter';

/* METHOD
 *
 * 1: complete data in interactive way, proposing user to select position of each point/OP
 *   OR automatically use pathfindin/op endpoint to choose a path
 * 2: generate missing paths with new datas (or skipped part if automatically generated in phase 1)
 * 3: calculate trainSchedules and add them to the selected timetable
 * 4: two links come visible: stdcm or simulation
 *
 */

export default function ImportTrainScheduleModal(props) {
  const { rollingStockDB, trains } = props;
  const { t } = useTranslation('translation', 'operationalStudies/importTrainSchedule');
  const infraID = useSelector(getInfraID);
  const rollingStockID = useSelector(getRollingStockID);
  const timetableID = useSelector(getTimetableID);

  const [postPathFindingOp] = osrdMiddlewareApi.usePostPathfindingOpMutation();
  const [postPathFinding] = osrdEditoastApi.usePostPathfindingMutation();
  const [postTrainSchedule] = osrdMiddlewareApi.usePostTrainScheduleStandaloneSimulationMutation();

  const [trainsWithPathRef, setTrainsWithPathRef] = useState([]);

  // Places, points, OPs to add track section id
  const [pointsDictionnary, setPointsDictionnary] = useState();
  const [clickedFeature, setClickedFeature] = useState();
  const [uicNumberToComplete, setUicNumberToComplete] = useState();

  // Path to compute
  const [pathsDictionnary, setPathsDictionnary] = useState();

  const [importStatus, setImportStatus] = useState(
    t('operationalStudies/importTrainSchedule:status.ready')
  );

  const [viewport, setViewport] = useState(initialViewport);
  const [status, setStatus] = useState(initialStatus);

  function testMissingInfos() {
    const messages = [];
    if (!infraID) messages.push(t('operationalStudies/importTrainSchedule:status.missingInfra'));
    if (!rollingStockID)
      messages.push(t('operationalStudies/importTrainSchedule:status.missingRollingStock'));
    if (!timetableID)
      messages.push(t('operationalStudies/importTrainSchedule:status.missingTimetable'));
    if (messages.length > 0) {
      setImportStatus(
        <span className="text-danger">
          {[t('operationalStudies/importTrainSchedule:status.noImportationPossible'), '']
            .concat(messages)
            .join('\n')}
        </span>
      );
    } else {
      setImportStatus(t('operationalStudies/importTrainSchedule:status.ready'));
    }
  }

  function getTrackSectionID(lat, lng) {
    setViewport({
      ...viewport,
      latitude: Number(lat),
      longitude: Number(lng),
      pitch: 0,
      bearing: 0,
      zoom: 18,
    });
  }

  //
  // 1 COMPLETE DATA INTERACTIVE WAY
  //

  function completePaths(init = false) {
    if (init) {
      setStatus(initialStatus);
      setUicNumberToComplete(undefined);
    }
    const uic2complete = Object.keys(pointsDictionnary);
    const uicNumberToCompleteLocal =
      uicNumberToComplete === undefined || init ? 0 : uicNumberToComplete + 1;
    if (uicNumberToCompleteLocal < uic2complete.length) {
      setUicNumberToComplete(uicNumberToCompleteLocal);
      getTrackSectionID(
        pointsDictionnary[uic2complete[uicNumberToCompleteLocal]].latitude,
        pointsDictionnary[uic2complete[uicNumberToCompleteLocal]].longitude
      );
      setImportStatus(
        `${uicNumberToCompleteLocal}/${uic2complete.length} ${t(
          'operationalStudies/importTrainSchedule:status.complete'
        )} ${pointsDictionnary[uic2complete[uicNumberToCompleteLocal]].name}`
      );
    } else {
      setImportStatus(t('operationalStudies/importTrainSchedule:status.uicComplete'));
      setUicNumberToComplete(undefined);
      setStatus({ ...status, uicComplete: true });
    }
  }

  //
  // 2 GENERATE PATHS (autocomplete to automatically look for OPs)
  //

  async function launchPathfinding(
    params,
    pathRefNum,
    pathNumberToComplete,
    pathsIDs,
    continuePath,
    autoComplete
  ) {
    try {
      const itineraryCreated = autoComplete
        ? await postPathFindingOp({ pathOpQuery: params }).unwrap()
        : await postPathFinding({ pathQuery: params }).unwrap();

      continuePath(
        pathNumberToComplete + 1,
        {
          ...pathsIDs,
          [pathRefNum]: {
            pathId: itineraryCreated.id,
            rollingStockId: params.rolling_stocks[0],
            pathFinding: itineraryCreated,
          },
        },
        autoComplete
      );
    } catch (e) {
      setImportStatus(
        <span className="text-danger">
          {t('operationalStudies/importTrainSchedule:errorMessages.unableToRetrievePathfinding')}
        </span>
      );
      setStatus(initialStatus);
    }
  }

  function generatePaths(pathNumberToComplete = 0, pathsIDs = {}, autoComplete = false) {
    if (autoComplete && pathNumberToComplete === 0) {
      setStatus({ ...initialStatus, uicComplete: true });
      setUicNumberToComplete(undefined);
    }

    const pathfindingPayloads = generatePathfindingPayload(
      infraID,
      rollingStockID,
      trainsWithPathRef,
      pathsDictionnary,
      pointsDictionnary,
      rollingStockDB,
      autoComplete
    );
    const path2complete = Object.keys(pathfindingPayloads);
    if (pathNumberToComplete < path2complete.length) {
      setImportStatus(
        `${pathNumberToComplete}/${path2complete.length} ${t(
          'operationalStudies/importTrainSchedule:status.searchingPath'
        )} ${path2complete[pathNumberToComplete]}`
      );
      launchPathfinding(
        pathfindingPayloads[path2complete[pathNumberToComplete]],
        path2complete[pathNumberToComplete],
        pathNumberToComplete,
        pathsIDs,
        generatePaths,
        autoComplete
      );
    } else {
      setImportStatus(t('operationalStudies/importTrainSchedule:status.pathComplete'));
      setTrainsWithPathRef(
        trainsWithPathRef.map((train) => ({
          ...train,
          pathId: pathsIDs[train.pathRef].pathId,
          rollingStockId: pathsIDs[train.pathRef].rollingStockId,
          pathFinding: pathsIDs[train.pathRef].pathFinding,
        }))
      );
      setStatus({ ...status, uicComplete: true, pathFindingDone: true });
    }
  }

  //
  // 3 CALCULATE TRAINS SCHEDULES
  //

  async function launchTrainSchedules(params) {
    try {
      await postTrainSchedule({ standaloneSimulationParameters: params }).unwrap();
      getTimetable(timetableID);
      return `${t(
        'operationalStudies/importTrainSchedule:status.calculatingTrainScheduleComplete'
      )} (${params.path})`;
    } catch (error) {
      return `${t(
        'operationalStudies/importTrainSchedule:errorMessages.unableToRetrieveTrainSchedule'
      )} (${params.path})`;
    }
  }
  async function generateTrainSchedules() {
    const payload = generateTrainSchedulesPayload(trainsWithPathRef, infraID, timetableID);
    setImportStatus(
      `${t('operationalStudies/importTrainSchedule:status.calculatingTrainSchedule')}`
    );
    const messages = [];
    const promisesList = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const [idx, params] of Object.values(payload).entries()) {
      // eslint-disable-next-line no-await-in-loop
      const message = await launchTrainSchedules(params);
      promisesList.push(message);
      messages.push(`${message} ${idx + 1}/${Object.values(payload).length}`);
      setImportStatus(messages.join('\n'));
    }
    Promise.all(promisesList).then(() => {
      setStatus({ ...status, trainSchedulesDone: true });
      setImportStatus(
        t('operationalStudies/importTrainSchedule:status.calculatingTrainScheduleCompleteAll')
      );
    });
  }

  useEffect(() => {
    if (clickedFeature) {
      const actualUic = Object.keys(pointsDictionnary)[uicNumberToComplete];
      setPointsDictionnary({
        ...pointsDictionnary,
        [actualUic]: {
          ...pointsDictionnary[actualUic],
          trackSectionId: clickedFeature.properties.id,
        },
      });

      completePaths();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedFeature]);

  useEffect(() => {
    if (rollingStockDB && trains && trains.length > 0) {
      refactorUniquePaths(trains, setTrainsWithPathRef, setPathsDictionnary, setPointsDictionnary);
    }
  }, [trains, rollingStockDB]);

  useEffect(() => {
    testMissingInfos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID, rollingStockID, timetableID]);

  return (
    <>
      {pathsDictionnary && trainsWithPathRef.length > 0 ? (
        <ModalBodySNCF>
          {!infraID || !timetableID || !rollingStockID ? null : (
            <>
              <button
                className={`btn btn-sm btn-block d-flex justify-content-between ${
                  status.uicComplete ? 'btn-outline-success' : 'btn-primary'
                }`}
                type="button"
                onClick={() => completePaths(true)}
              >
                <span>
                  1 — {t('operationalStudies/importTrainSchedule:completeTrackSectionID')}
                </span>
                <span>{Object.keys(pointsDictionnary).length}</span>
              </button>
              <div className="my-1 text-center">
                {t('operationalStudies/importTrainSchedule:or')}
              </div>
              <button
                className={`btn btn-sm btn-block d-flex justify-content-between text-wrap text-left ${
                  status.uicComplete || status.pathFindingDone
                    ? 'btn-outline-success'
                    : 'btn-primary'
                }`}
                type="button"
                onClick={() => generatePaths(0, {}, true)}
              >
                <span>1 — {t('operationalStudies/importTrainSchedule:generatePathsAuto')}</span>
                <span>{pathsDictionnary.length}</span>
              </button>
              <button
                className={`btn btn-sm btn-block d-flex justify-content-between ${
                  status.pathFindingDone ? 'btn-outline-success' : 'btn-primary'
                } ${status.uicComplete ? '' : 'disabled'}`}
                type="button"
                onClick={() => generatePaths(0)}
              >
                <span>2 — {t('operationalStudies/importTrainSchedule:generatePaths')}</span>
                <span>{pathsDictionnary.length}</span>
              </button>
              <button
                className={`btn btn-primary btn-sm btn-block d-flex justify-content-between ${
                  status.pathFindingDone ? '' : 'disabled'
                }`}
                type="button"
                onClick={generateTrainSchedules}
              >
                <span>
                  3 — {t('operationalStudies/importTrainSchedule:generateTrainSchedules')}
                </span>
                <span>{trains.length}</span>
              </button>

              <hr />
            </>
          )}

          <pre>{importStatus}</pre>

          {uicNumberToComplete !== undefined && (
            <div className="automated-map">
              <Map
                viewport={viewport}
                setViewport={setViewport}
                setClickedFeature={setClickedFeature}
              />
            </div>
          )}
        </ModalBodySNCF>
      ) : (
        ''
      )}
      <ImportTrainScheduleModalFooter status={status} />
    </>
  );
}

ImportTrainScheduleModal.defaultProps = {
  rollingStockDB: [],
};

ImportTrainScheduleModal.propTypes = {
  trains: PropTypes.array.isRequired,
  rollingStockDB: PropTypes.array,
};
