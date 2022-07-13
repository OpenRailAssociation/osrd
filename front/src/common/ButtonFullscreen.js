import React from 'react';
import PropTypes from 'prop-types';
import { MdFullscreen } from 'react-icons/md';
import { connect } from 'react-redux';
import * as allMainActions from 'reducers/main';
import { bindActionCreators } from 'redux';

class ButtonFullscreen extends React.Component {
  static propTypes = {
    mainActions: PropTypes.object.isRequired,
  }

  toggleFullscreen = () => {
    const { mainActions } = this.props;
    mainActions.toggleFullscreen();
  }

  render() {
    return (
      <button type="button" className="btn-rounded btn-rounded-white btn-fullscreen" onClick={this.toggleFullscreen}>
        <span className="sr-only">Fullscreen</span>
        <MdFullscreen />
      </button>
    );
  }
}

const mapStateToProps = (state) => ({
  main: state.main,
});

const mapDispatchToProps = (dispatch) => ({
  mainActions: bindActionCreators(allMainActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ButtonFullscreen);
