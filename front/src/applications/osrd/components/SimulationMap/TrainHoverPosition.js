import { Marker } from 'react-map-gl';
import PropTypes from 'prop-types';
import React from 'react';
import { datetime2time } from 'utils/timeManipulation';
import { useSelector } from 'react-redux';

function TrainHoverPosition(props) {
  const { point } = props;
  const { selectedTrain, allowancesSettings } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;

  return (
    <>
      <Marker
        className="map-search-marker"
        longitude={point.geometry?.coordinates[0]}
        latitude={point.geometry?.coordinates[1]}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <circle
            style={{
              fill: allowancesSettings[trainID].ecoBlocks ? '#82be00' : '#303383',
              fillOpacity: '0.75',
            }}
            cx="16"
            cy="16"
            r="8"
          />
        </svg>
        <span
          className={`small font-weight-bold ${
            allowancesSettings[trainID] && allowancesSettings[trainID].ecoBlocks
              ? 'text-secondary'
              : 'text-primary'
          }`}
        >
          {point.properties && Math.round(point.properties.speedTime?.speed ?? 0)}
          km/h
        </span>
        <span className="ml-2 small">
          {point.properties.speedTime && datetime2time(point.properties.speedTime.time)}
        </span>
      </Marker>
      {point.properties.intermediaterMarkersPoints &&
        point.properties.intermediaterMarkersPoints.map((intermediateMarkerPoint, i) => (
          <Marker
            className="map-search-marker"
            longitude={intermediateMarkerPoint.geometry.coordinates[0]}
            latitude={intermediateMarkerPoint.geometry.coordinates[1]}
            key={`intermediateMarker-${i}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <circle
                style={{
                  fill: allowancesSettings[trainID].ecoBlocks ? '#82be00' : '#303383',
                  fillOpacity: '0.60',
                }}
                cx="16"
                cy="16"
                r="8"
              />
            </svg>
          </Marker>
        ))}
    </>
  );
}

TrainHoverPosition.propTypes = {
  point: PropTypes.object.isRequired,
};

export default TrainHoverPosition;
