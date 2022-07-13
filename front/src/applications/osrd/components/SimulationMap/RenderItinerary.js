import { Layer, Source } from 'react-map-gl';

import PropTypes from 'prop-types';
import React from 'react';
import { useSelector } from 'react-redux';

export default function RenderItinerary(props) {
  const { geojsonPath } = props;
  const {
    selectedTrain, allowancesSettings,
  } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;
  return (
    <>
      <Source type="geojson" data={geojsonPath}>
        <Layer
          id="geojsonPath"
          type="line"
          paint={{
            'line-width': 3,
            'line-color': allowancesSettings[trainID].ecoBlocks ? '#82be00' : '#303383',
          }}
        />
      </Source>
    </>
  );
}

RenderItinerary.propTypes = {
  geojsonPath: PropTypes.object.isRequired,
};
