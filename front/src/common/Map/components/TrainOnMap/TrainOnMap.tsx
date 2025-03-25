import { useMemo } from 'react';

import cx from 'classnames';
import type { Feature, LineString, Position } from 'geojson';
import { Source, Marker } from 'react-map-gl/maplibre';

import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { LAYERS, LAYER_GROUPS_ORDER } from 'config/layerOrder';
import type { Viewport } from 'reducers/map';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import { datetime2time } from 'utils/timeManipulation';

import { getTrainPieces } from './getTrainBody';

/** Information of the train at a precise moment */
export type TimetableItemCurrentInfo = {
  timetableItemId: TimetableItemId;
  headPositionCoord: Position;
  headDistanceAlong: number; // in km
  tailDistanceAlong: number; // in km
  speed: number;
  time: Date;
};

const LABEL_SHIFT_FACTORS = {
  LONG: 0.005,
  LAT: 0.0011,
};

const TimetableItemLabel = ({
  isEcoTrain,
  timetableItemInfo,
}: {
  isEcoTrain: boolean;
  timetableItemInfo: TimetableItemCurrentInfo;
}) => (
  <>
    <span
      className={cx(
        'small',
        'train-speed-label',
        'font-weight-bold',
        isEcoTrain ? 'text-secondary' : 'text-primary'
      )}
    >
      {Math.round(timetableItemInfo.speed)}
      km/h
    </span>
    <span className="ml-2 small train-speed-label">{`${datetime2time(timetableItemInfo.time)}`}</span>
  </>
);

const getZoomPowerOf2LengthFactor = (viewport: Viewport, threshold = 12) =>
  2 ** (threshold - viewport.zoom);

type TrainOnMapProps = {
  trainInfo: TimetableItemCurrentInfo;
  timetableItemSimulation: SimulationResponseSuccess;
  geojsonPath: Feature<LineString>;
  viewport: Viewport;
};

const TrainOnMap = ({
  trainInfo,
  geojsonPath,
  viewport,
  timetableItemSimulation,
}: TrainOnMapProps) => {
  const zoomLengthFactor = getZoomPowerOf2LengthFactor(viewport);

  const { trainBody, trainExtremities } = getTrainPieces(trainInfo, geojsonPath, zoomLengthFactor);

  const coordinates = useMemo(
    () => ({
      lat: trainInfo.headPositionCoord[1] + zoomLengthFactor * LABEL_SHIFT_FACTORS.LAT,
      long: trainInfo.headPositionCoord[0] + zoomLengthFactor * LABEL_SHIFT_FACTORS.LONG,
    }),
    [trainInfo]
  );

  const isEcoTrain = useMemo(
    () =>
      timetableItemSimulation.base.energy_consumption <
      timetableItemSimulation.final_output.energy_consumption,
    [timetableItemSimulation]
  );

  return (
    <>
      <Marker longitude={coordinates.long} latitude={coordinates.lat}>
        <TimetableItemLabel isEcoTrain={isEcoTrain} timetableItemInfo={trainInfo} />
      </Marker>
      {trainExtremities.map((trainExtremity) => (
        <Source
          type="geojson"
          data={trainExtremity.data}
          key={`${trainInfo.timetableItemId}-${trainExtremity.name}`}
        >
          <OrderedLayer
            id={`${trainInfo.timetableItemId}-${trainExtremity.name}`}
            type="fill"
            paint={{
              'fill-color': '#303383',
            }}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRAIN.GROUP]}
          />
        </Source>
      ))}
      <Source type="geojson" data={trainBody.data}>
        <OrderedLayer
          id={`${trainInfo.timetableItemId}-path`}
          type="line"
          paint={{
            'line-width': 16,
            'line-color': '#303383',
          }}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRAIN.GROUP]}
        />
      </Source>
    </>
  );
};

export default TrainOnMap;
