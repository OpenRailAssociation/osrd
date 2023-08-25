import React, { useEffect, useState } from 'react';
import cx from 'classnames';

import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import Map from 'applications/operationalStudies/components/ImportTrainSchedule/Map';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import generatePathfindingPayload from 'applications/operationalStudies/components/ImportTrainSchedule/generatePathfindingPayload';
import generateTrainSchedulesPayload from 'applications/operationalStudies/components/ImportTrainSchedule/generateTrainSchedulesPayload';
import getTimetable from 'applications/operationalStudies/components/Scenario/getTimetable';
import {
  initialViewport,
  initialStatus,
} from 'applications/operationalStudies/components/ImportTrainSchedule//consts';
import { refactorUniquePaths } from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleHelpers';
import {
  LightRollingStock,
  Path,
  TrainScheduleBatchItem,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { updateReloadTimetable } from 'reducers/osrdsimulation/actions';
import { compact } from 'lodash';
import Spacer from 'common/Spacer';
import {
  TrainSchedule,
  TrainScheduleWithPath,
  TrainScheduleWithPathRef,
} from 'applications/operationalStudies/types';
import ImportTrainScheduleModalFooter from './ImportTrainScheduleModalFooter';
import { Point } from './types';

/* METHOD
 *
 * 1: complete data in interactive way, proposing user to select position of each point/OP
 *   OR automatically use pathfindin/op endpoint to choose a path
 * 2: generate missing paths with new datas (or skipped part if automatically generated in phase 1)
 * 3: calculate trainSchedules and add them to the selected timetable
 * 4: two links come visible: stdcm or simulation
 *
 */

interface ImportTrainScheduleModalProps {
  infraId: number;
  rollingStocks: LightRollingStock[];
  timetableId: number;
  trains: TrainSchedule[];
}

const ImportTrainScheduleModal = ({
  infraId,
  rollingStocks,
  timetableId,
  trains,
}: ImportTrainScheduleModalProps) => {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const dispatch = useDispatch();
  const rollingStockID = useSelector(getRollingStockID);

  const [postPathFinding] = osrdEditoastApi.endpoints.postPathfinding.useMutation();
  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTrainScheduleStandaloneSimulation.useMutation();
  const [getTimetableWithTrainSchedulesDetails] =
    osrdEditoastApi.endpoints.getTimetableById.useLazyQuery();

  const [trainsWithPathRef, setTrainsWithPathRef] = useState<TrainScheduleWithPathRef[]>([]);
  const [trainsWithPath, setTrainsWithPath] = useState<TrainScheduleWithPath[]>([]);

  // Places, points, OPs to add track section id
  const [pointsDictionnary, setPointsDictionnary] = useState<Record<string, Point>>({});
  const [clickedFeatureId, setClickedFeatureId] = useState<string>();
  const [uicNumberToComplete, setUicNumberToComplete] = useState<number>();

  // Path to compute
  const [pathsDictionnary, setPathsDictionnary] = useState<
    { trainNumber: string; pathString: string }[]
  >([]);

  const [importStatus, setImportStatus] = useState(<span>{t('status.ready')}</span>);

  const [viewport, setViewport] = useState(initialViewport);
  const [status, setStatus] = useState(initialStatus);

  function testMissingInfos() {
    if (!rollingStockID) {
      setImportStatus(
        <span className="text-danger">
          {[t('status.noImportationPossible'), t('status.missingRollingStock')].join('\n')}
        </span>
      );
    } else {
      setImportStatus(t('status.ready'));
    }
  }

  function getTrackSectionID(lat: number, lng: number) {
    setViewport({
      latitude: lat,
      longitude: lng,
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
      const pointToComplete = pointsDictionnary[uic2complete[uicNumberToCompleteLocal]];
      getTrackSectionID(pointToComplete.latitude, pointToComplete.longitude);
      setImportStatus(
        t('status.complete', {
          uicNumber: uicNumberToCompleteLocal,
          uicTotalCount: uic2complete.length,
          uicName: pointToComplete.name,
        })
      );
    } else {
      setImportStatus(t('status.uicComplete'));
      setUicNumberToComplete(undefined);
      setStatus({ ...status, uicComplete: true });
    }
  }

  //
  // 2 GENERATE PATHS (autocomplete to automatically look for OPs)
  //

  function endGeneratePaths(newTrainsWithPath: TrainScheduleWithPath[]) {
    if (newTrainsWithPath.length > 0) {
      setImportStatus(t('status.pathComplete'));
    } else setImportStatus(<span className="text-danger">{t('status.pathsFailed')}</span>);
    setTrainsWithPath(newTrainsWithPath);
    setStatus({ ...status, uicComplete: true, pathFindingDone: true });
  }

  /**
   * Launch pathfindings.
   *
   * For each path, launch a pathfinding request (one at the time).
   * If a pathfinding is not successful, the corresponding trainSchedules will not be imported.
   */
  async function generatePaths(autocomplete = false) {
    const pathErrors: string[] = [];
    const pathFindings: Record<string, { rollingStockId: number; pathFinding: Path }> = {};
    const pathFindingsCount = pathsDictionnary.length;
    let pathFindingsDoneCount = 0;

    // eslint-disable-next-line no-restricted-syntax
    for await (const path of pathsDictionnary) {
      pathFindingsDoneCount += 1;
      const pathRef = path.trainNumber;
      const { payload, rollingStockId } = generatePathfindingPayload(
        trainsWithPathRef,
        rollingStocks,
        path.trainNumber,
        rollingStockID,
        infraId,
        autocomplete,
        pointsDictionnary
      );
      setImportStatus(
        t('status.searchingPath', {
          pathFindingsDoneCount,
          pathFindingsCount,
          pathRef,
        })
      );

      await postPathFinding({ pathQuery: payload })
        .unwrap()
        .then((pathFinding) => {
          pathFindings[pathRef] = { rollingStockId, pathFinding };
        })
        .catch(() => {
          console.warn(`pathfinding error for path ${pathRef}`);
          pathErrors.push(pathRef);
        });
    }

    let trainsDropped = 0;
    const newTrains = compact(
      trainsWithPathRef.map((train) => {
        if (!pathFindings[train.pathRef]) {
          trainsDropped += 1;
          return null;
        }
        return {
          ...train,
          pathId: pathFindings[train.pathRef].pathFinding.id,
          rollingStockId: pathFindings[train.pathRef].rollingStockId,
          pathFinding: pathFindings[train.pathRef].pathFinding,
        };
      })
    );
    if (pathErrors.length > 0) {
      console.warn(`${pathErrors.length} chemins non trouvés, ${trainsDropped} trains abandonnés`);
    }

    endGeneratePaths(newTrains);
  }

  async function generateAutocompletePaths() {
    return generatePaths(true);
  }

  //
  // 3 CALCULATE TRAINS SCHEDULES
  //

  async function launchTrainSchedules(payload: {
    path: number;
    schedules: TrainScheduleBatchItem[];
    timetable: number;
  }) {
    try {
      await postTrainSchedule({ body: payload }).unwrap();
    } catch (error) {
      return false;
    }

    try {
      const timetable = await getTimetableWithTrainSchedulesDetails({
        id: timetableId,
      }).unwrap();
      await Promise.resolve(dispatch(updateReloadTimetable(false)));
      getTimetable(timetable);
    } catch (error) {
      console.error(error);
    }
    return true;
  }

  async function generateTrainSchedules() {
    const payloads = generateTrainSchedulesPayload(trainsWithPath, timetableId);
    const trainsCount = payloads.length;
    setImportStatus(t('status.calculatingTrainSchedule'));
    const messages = [];
    let successfulTrainsCount = 0;
    let idx = 0;
    // eslint-disable-next-line no-restricted-syntax
    for await (const payload of payloads) {
      const success = await launchTrainSchedules(payload);
      const message = `${t(
        !success
          ? 'status.calculatingTrainScheduleComplete'
          : 'errorMessages.unableToCreateTrainSchedule',
        {
          pathId: payload.path,
          trainIndex: idx,
          trainsCount: payloads.length,
        }
      )}`;
      messages.push(message);
      if (success) {
        successfulTrainsCount += 1;
      }
      setImportStatus(<>{messages.join('\n')}</>);
      idx += 1;
    }
    if (successfulTrainsCount > 0) {
      setStatus({ ...status, trainSchedulesDone: true, success: true });
      setImportStatus(
        t('status.calculatingTrainScheduleCompleteAll', {
          count: successfulTrainsCount,
          successfulTrainsCount,
          trainsCount,
        })
      );
    } else {
      setStatus({ ...status, trainSchedulesDone: true });
      setImportStatus(
        <span className="text-danger">
          {t('status.calculatingTrainScheduleCompleteAllFailure')}
        </span>
      );
    }
  }

  useEffect(() => {
    if (clickedFeatureId && uicNumberToComplete !== undefined) {
      const actualUic = Object.keys(pointsDictionnary)[uicNumberToComplete];
      setPointsDictionnary({
        ...pointsDictionnary,
        [actualUic]: {
          ...pointsDictionnary[actualUic],
          trackSectionId: clickedFeatureId,
        },
      });
      setClickedFeatureId(undefined);

      completePaths();
    }
  }, [clickedFeatureId]);

  useEffect(() => {
    if (rollingStocks && trains && trains.length > 0) {
      refactorUniquePaths(trains, setTrainsWithPathRef, setPathsDictionnary, setPointsDictionnary);
    }
  }, [trains, rollingStocks]);

  useEffect(() => {
    testMissingInfos();
  }, [infraId, rollingStockID, timetableId]);

  return (
    <>
      {pathsDictionnary && trainsWithPathRef && (
        <ModalBodySNCF>
          {!infraId || !timetableId || !rollingStockID ? null : (
            <>
              <button
                className={`btn btn-sm btn-block d-flex justify-content-between ${
                  status.uicComplete ? 'btn-outline-success' : 'btn-primary'
                }`}
                type="button"
                onClick={() => completePaths(true)}
              >
                <span>1 — {t('completeTrackSectionID')}</span>
                <span>{Object.keys(pointsDictionnary).length}</span>
              </button>
              <button
                className={`btn btn-sm btn-block d-flex justify-content-between ${
                  status.pathFindingDone ? 'btn-outline-success' : 'btn-primary'
                }`}
                disabled={!status.uicComplete}
                type="button"
                onClick={() => generatePaths()}
              >
                <span>2 — {t('generatePaths')}</span>
                <span>{pathsDictionnary.length}</span>
              </button>
              <div className="my-1 text-center">{t('or')}</div>
              <button
                className={cx(
                  'btn btn-sm btn-block d-flex justify-content-between text-wrap text-left',
                  !status.pathFindingDone && 'btn-primary',
                  status.pathFindingDone && trainsWithPath.length && 'btn-outline-success',
                  status.pathFindingDone && !trainsWithPath.length && 'btn-outline-danger'
                )}
                type="button"
                onClick={generateAutocompletePaths}
              >
                <span>1/2 — {t('generatePathsAuto')}</span>
                <span>{pathsDictionnary.length}</span>
              </button>
              <Spacer height={50} />
              <button
                className={cx(
                  'btn btn-sm btn-block d-flex justify-content-between',
                  !status.trainSchedulesDone && 'btn-primary',
                  status.trainSchedulesDone && !status.success && 'btn-outline-danger',
                  status.trainSchedulesDone && status.success && 'btn-outline-success'
                )}
                disabled={!status.pathFindingDone || trainsWithPath.length === 0}
                type="button"
                onClick={generateTrainSchedules}
              >
                <span>3 — {t('generateTrainSchedules')}</span>
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
                setClickedFeatureId={setClickedFeatureId}
              />
            </div>
          )}
        </ModalBodySNCF>
      )}
      <ImportTrainScheduleModalFooter status={status} />
    </>
  );
};

export default ImportTrainScheduleModal;
