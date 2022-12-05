import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import Map from 'applications/opendata/components/Map';
import rollingstockOpenData2OSRD from 'applications/opendata/components/rollingstock_opendata2osrd.json';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getRollingStockID, getInfraID, getTimetableID } from 'reducers/osrdconf/selectors';
import generatePathfindingPayload from 'applications/opendata/components/generatePathfinding';
import { post } from 'common/requests';

const itineraryURI = '/pathfinding/';

const initialStatus = {
  uicComplete: false,
  pathFindingDone: false,
  trainSchedulesDone: false,
};

// Look for unique pathways by concatenation of duration & coordinates
// Compare them & create dictionnary, associate reference of unique path to each train
function refactorUniquePaths(
  trains,
  setTrainsWithPathRef,
  setPathsDictionnary,
  setPointsDictionnary
) {
  const pathsDictionnary = [];
  const trainsWithPathRef = [];
  const pointsList = {};
  trains.forEach((train) => {
    const pathString =
      train.etapes
        .map((step, idx) =>
          idx === 0 || idx === step.length - 1
            ? `${step.duree}${step.lat}${step.lon}`
            : `0${step.lat}${step.lon}`
        )
        .join() + rollingstockOpenData2OSRD[train.type_em];
    const pathRef = pathsDictionnary.find((entry) => entry.pathString === pathString);
    if (pathRef === undefined) {
      pathsDictionnary.push({
        num: train.num,
        pathString,
      });
      trainsWithPathRef.push({ ...train, pathRef: train.num });
    } else {
      trainsWithPathRef.push({ ...train, pathRef: pathRef.num });
    }
    train.etapes.forEach((step) => {
      pointsList[step.uic] = { lng: step.lon, lat: step.lat, name: step.gare };
    });
  });
  setTrainsWithPathRef(trainsWithPathRef);
  setPathsDictionnary(pathsDictionnary);
  setPointsDictionnary(pointsList);
}

export default function OpenDataImportModal(props) {
  const { rollingStockDB, trains } = props;
  const { t } = useTranslation('opendata');
  const infraID = useSelector(getInfraID);
  const rollingStockID = useSelector(getRollingStockID);
  const timetableID = useSelector(getTimetableID);

  const [trainsWithPathRef, setTrainsWithPathRef] = useState();

  // Places, points, OPs to add track section id
  const [pointsDictionnary, setPointsDictionnary] = useState();
  const [clickedFeature, setClickedFeature] = useState();
  const [uicNumberToComplete, setUicNumberToComplete] = useState();

  // Path to compute
  const [pathsDictionnary, setPathsDictionnary] = useState();

  const [whatIAmDoingNow, setWhatIAmDoingNow] = useState(t('status.ready'));

  const [viewport, setViewport] = useState({
    latitude: 48.86521728735368,
    longitude: 2.341549498045856,
    zoom: 10.257506947953921,
    bearing: 0,
    pitch: 0,
    width: 420,
    height: 320,
    altitude: 1.5,
    maxZoom: 24,
    minZoom: 0,
    maxPitch: 60,
    minPitch: 0,
    transitionDuration: 100,
  });
  const [status, setStatus] = useState(initialStatus);

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
        pointsDictionnary[uic2complete[uicNumberToCompleteLocal]].lat,
        pointsDictionnary[uic2complete[uicNumberToCompleteLocal]].lng
      );
      setWhatIAmDoingNow(
        `${uicNumberToCompleteLocal}/${uic2complete.length} ${t('status.complete')} ${
          pointsDictionnary[uic2complete[uicNumberToCompleteLocal]].name
        }`
      );
    } else {
      setWhatIAmDoingNow(t('status.uicComplete'));
      setUicNumberToComplete(undefined);
      setStatus({ ...status, uicComplete: true });
    }
  }

  async function launchPathfinding(
    params,
    pathRefNum,
    pathNumberToComplete,
    pathsIDs,
    continuePath
  ) {
    try {
      const itineraryCreated = await post(itineraryURI, params, {}, true);
      continuePath(pathNumberToComplete + 1, { ...pathsIDs, [pathRefNum]: itineraryCreated.id });
    } catch (e) {
      setWhatIAmDoingNow(
        <span className="text-danger">{t('errorMessages.unableToRetrievePathfinding')}</span>
      );
      setStatus(initialStatus);
      console.log('ERROR', e);
    }
  }

  function generatePaths(pathNumberToComplete = 0, pathsIDs = {}) {
    const pathfindingPayloads = generatePathfindingPayload(
      infraID,
      rollingStockID,
      trainsWithPathRef,
      pathsDictionnary,
      pointsDictionnary,
      rollingStockDB
    );
    const path2complete = Object.keys(pathfindingPayloads);
    if (pathNumberToComplete < path2complete.length) {
      setWhatIAmDoingNow(
        `${pathNumberToComplete}/${path2complete.length} ${t('status.searchingPath')} ${
          path2complete[pathNumberToComplete]
        }`
      );
      launchPathfinding(
        pathfindingPayloads[path2complete[pathNumberToComplete]],
        path2complete[pathNumberToComplete],
        pathNumberToComplete,
        pathsIDs,
        generatePaths
      );
    } else {
      setWhatIAmDoingNow(t('status.pathComplete'));
      setTrainsWithPathRef(
        trainsWithPathRef.map((train) => ({ ...train, pathId: pathsIDs[train.pathRef] }))
      );
      setStatus({ ...status, pathFindingDone: true });
    }
  }

  function generateTrainSchedules() {
    console.log('coucou', trainsWithPathRef);
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

  return (
    <ModalSNCF htmlID="OpenDataImportModal">
      {pathsDictionnary && trainsWithPathRef ? (
        <ModalBodySNCF>
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
            } ${status.uicComplete ? '' : 'disabled'}`}
            type="button"
            onClick={() => generatePaths(0)}
          >
            <span>2 — {t('generatePaths')}</span>
            <span>{pathsDictionnary.length}</span>
          </button>
          <button
            className={`btn btn-primary btn-sm btn-block d-flex justify-content-between ${
              status.pathFindingDone ? '' : 'disabled'
            }`}
            type="button"
            onClick={generateTrainSchedules}
          >
            <span>3 — {t('generateTrainSchedules')}</span>
            <span>{trains.length}</span>
          </button>

          <hr />

          <pre>{whatIAmDoingNow}</pre>
          {uicNumberToComplete !== undefined ? (
            <div className="automated-map">
              <Map
                viewport={viewport}
                setViewport={setViewport}
                setClickedFeature={setClickedFeature}
              />
            </div>
          ) : null}
        </ModalBodySNCF>
      ) : (
        ''
      )}
    </ModalSNCF>
  );
}

OpenDataImportModal.propTypes = {
  trains: PropTypes.array.isRequired,
  rollingStockDB: PropTypes.array.isRequired,
};
