import React from 'react';
import { FlyToInterpolator } from 'react-map-gl';
import PropTypes from 'prop-types';
import { FaCompass } from 'react-icons/fa';
import { connect } from 'react-redux';
import * as allMapActions from 'reducers/map';
import { bindActionCreators } from 'redux';

class ButtonResetViewport extends React.Component {
  static propTypes = {
    map: PropTypes.object.isRequired,
    mapActions: PropTypes.object.isRequired,
    updateLocalViewport: PropTypes.func.isRequired,
  }

  resetOrientation = () => {
    const { map, updateLocalViewport } = this.props;
    const newViewport = {
      ...map.viewport,
      bearing: 0,
      pitch: 0,
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
    };
    updateLocalViewport(newViewport, 1000);
  }

  render() {
    return (
      <button type="button" className="btn-rounded btn-rounded-white btn-map-resetviewport" onClick={this.resetOrientation}>
        <span className="sr-only">Reset north</span>
        <FaCompass />
      </button>
    );
  }
}

const mapStateToProps = (state) => ({
  map: state.map,
});

const mapDispatchToProps = (dispatch) => ({
  mapActions: bindActionCreators(allMapActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ButtonResetViewport);
