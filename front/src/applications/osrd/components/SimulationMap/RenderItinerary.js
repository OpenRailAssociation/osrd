import React from 'react';
import { Source, Layer } from 'react-map-gl';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';

export default function RenderItinerary(props) {
  const { geojsonPath } = props;
  const {
    selectedTrain, simulation, marginsSettings,
  } = useSelector((state) => state.osrdsimulation);
  const trainID = simulation.trains[selectedTrain].id;
  return (
    <>
      <Source type="geojson" data={geojsonPath}>
        <Layer
          id="geojsonPath"
          type="line"
          paint={{
            'line-width': 3,
            'line-color': marginsSettings[trainID].ecoBlocks ? '#82be00' : '#303383',
          }}
        />
      </Source>
    </>
  );
}

RenderItinerary.propTypes = {
  geojsonPath: PropTypes.object.isRequired,
};
