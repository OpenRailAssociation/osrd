import React from 'react';
import { MdModeEdit, MdRemoveRedEye } from 'react-icons/md';
import { connect } from 'react-redux';
import { toggleEditMode } from 'reducers/main';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';

const ButtonEdit = ({ main, mainActions }) => (
  <button type="button" className="btn-rounded btn-rounded-white btn-edit" onClick={mainActions.toggleEditMode}>
    <span className="sr-only">Fullscreen</span>
    {main.editMode ? <MdRemoveRedEye /> : <MdModeEdit />}
  </button>
);

ButtonEdit.propTypes = {
  mainActions: PropTypes.object.isRequired,
  main: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => ({
  main: state.main,
});

const mapDispatchToProps = (dispatch) => ({
  mainActions: bindActionCreators({ toggleEditMode }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ButtonEdit);
