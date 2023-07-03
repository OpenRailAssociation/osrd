import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import PropTypes from 'prop-types';
import React, { useContext } from 'react';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';
import { getSelectedTrain } from 'reducers/osrdsimulation/selectors';

export default function OPModal(props) {
  const { values, setValues, fromTo } = props;
  const selectedTrain = useSelector(getSelectedTrain);
  const { closeModal } = useContext(ModalContext);
  return (
    <table className="table table-condensed table-hover">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Position</th>
        </tr>
      </thead>
      <tbody>
        {selectedTrain.base.stops.map((stop) => (
          <tr
            role="button"
            key={nextId()}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setValues({ ...values, [fromTo]: stop.position });
              closeModal();
            }}
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
