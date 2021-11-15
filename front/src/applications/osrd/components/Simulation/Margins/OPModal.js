import React from 'react';
import { useSelector } from 'react-redux';
import nextId from 'react-id-generator';
import PropTypes from 'prop-types';

export default function OPModal(props) {
  const { values, setValues, fromTo } = props;
  const { selectedTrain, simulation } = useSelector((state) => state.osrdsimulation);
  return (
    <table className="table table-condensed table-hover">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Position</th>
        </tr>
      </thead>
      <tbody>
        {simulation.trains[selectedTrain].base.stops.map((stop, idx) => (
          <tr
            role="button"
            data-dismiss="modal"
            key={nextId()}
            style={{ cursor: 'pointer' }}
            onClick={() => setValues({ ...values, [fromTo]: stop.position })}
          >
            <td>{stop.name}</td>
            <td>{Math.round(stop.position) / 1000}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

OPModal.propTypes = {
  fromTo: PropTypes.string.isRequired,
  setValues: PropTypes.func.isRequired,
  values: PropTypes.object.isRequired,
};
