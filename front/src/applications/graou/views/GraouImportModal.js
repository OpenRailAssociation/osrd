import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import Map from 'applications/graou/components/Map';
import rollingstockGraou2OSRD from 'applications/graou/components/rollingstock_graou2osrd.json';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getRollingStockID, getInfraID, getTimetableID } from 'reducers/osrdconf/selectors';
import generatePathfindingPayload from 'applications/graou/components/generatePathfinding';

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
        .join() + rollingstockGraou2OSRD[train.type_em];
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

export default function GraouImportModal(props) {
  const { rollingStockDB, trains } = props;
  const { t } = useTranslation('graou');
  const infraID = useSelector(getInfraID);
  const rollingStockID = useSelector(getRollingStockID);
  const timetableID = useSelector(getTimetableID);

  const [trainsWithPathRef, setTrainsWithPathRef] = useState();
  const [pathsDictionnary, setPathsDictionnary] = useState();
  const [pointsDictionnary, setPointsDictionnary] = useState();
  const [clickedFeature, setClickedFeature] = useState();
  const [uicNumberToComplete, setUicNumberToComplete] = useState();

  const [whatIAmDoingNow, setWhatIAmDoingNow] = useState(t('status.nothing'));

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
  const [status, setStatus] = useState({
    uicComplete: false,
    pathFindingDone: false,
    trainSchedulesDone: false,
  });

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

  function generatePaths() {
    const paths = generatePathfindingPayload(
      infraID,
      rollingStockID,
      trainsWithPathRef,
      pathsDictionnary,
      pointsDictionnary,
      rollingStockDB
    );
    console.log('coucou', paths);
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
    <ModalSNCF htmlID="GraouImportModal">
      {pathsDictionnary && trainsWithPathRef ? (
        <ModalBodySNCF>
          <button
            className={`btn btn-sm btn-block d-flex justify-content-between ${
              status.uicComplete ? 'btn-success' : 'btn-primary'
            }`}
            type="button"
            onClick={() => completePaths(true)}
          >
            <span>1 — {t('completeTrackSectionID')}</span>
            <span>{Object.keys(pointsDictionnary).length}</span>
          </button>
          <button
            className={`btn btn-primary btn-sm btn-block d-flex justify-content-between ${
              status.uicComplete ? '' : 'disabled'
            }`}
            type="button"
            onClick={generatePaths}
          >
            <span>2 — {t('generatePaths')}</span>
            <span>{pathsDictionnary.length}</span>
          </button>
          <button
            className={`btn btn-primary btn-sm btn-block d-flex justify-content-between ${
              status.pathFindingDone ? '' : 'disabled'
            }`}
            type="button"
            onClick={completePaths}
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

GraouImportModal.propTypes = {
  trains: PropTypes.array.isRequired,
  rollingStockDB: PropTypes.array.isRequired,
};
