import React from 'react';
import PropTypes from 'prop-types';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';

export default function GraouImportModal(props) {
  const { trains } = props;
  return (
    <ModalSNCF htmlID="GraouImportModal">
      <ModalBodySNCF>
        Coucou
      </ModalBodySNCF>
    </ModalSNCF>
  )
}

GraouImportModal.propTypes = {
  trains: PropTypes.array.isRequired,
};
