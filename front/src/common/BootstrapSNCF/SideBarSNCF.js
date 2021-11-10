import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class SideBarSNCF extends React.Component {
  static propTypes = {
    title: PropTypes.object.isRequired,
    toolBar: PropTypes.object.isRequired,
    content: PropTypes.object.isRequired,
    main: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
  }

  render() {
    const {
      title, toolBar, content, main, onClose,
    } = this.props;

    return (
      <nav className={`sideBar-container${main.fullscreen ? ' fullscreen' : ''}`}>
        <div className="title-color">
          <div className="d-flex align-items-center justify-content-between ml-2">
            {title}
            <button className="btn btn-sm btn-transparent btn-color-white" type="button" onClick={onClose}>
              <i className="icons-close icons-size-x75" aria-hidden="true" />
            </button>
          </div>
          <div>
            {toolBar}
          </div>
        </div>
        <div className="sideBar-content">
          {content}
        </div>
      </nav>
    );
  }
}

const mapStateToProps = (state) => ({
  main: state.main,
});

export default connect(mapStateToProps)(SideBarSNCF);
