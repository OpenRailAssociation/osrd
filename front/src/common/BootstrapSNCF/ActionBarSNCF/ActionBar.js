import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class ActionBarSNCF extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    titlelogo: PropTypes.string,
    children: PropTypes.array,
    main: PropTypes.object.isRequired,
    classes: PropTypes.string,
  }

  static defaultProps = {
    title: undefined,
    titlelogo: undefined,
    children: [],
    classes: '',
  }

  render() {
    const {
      title, titlelogo, children, main, classes,
    } = this.props;

    const titlelogopicture = (titlelogo !== undefined) ? <img src={titlelogo} alt="logo" /> : '';

    return (
      <div className={`actionbar ${classes} ${main.fullscreen ? ' fullscreen' : ''}`}>
        <div className="actionbar-head">
          <h1 className="mb-0">
            {titlelogopicture}
            {title}
          </h1>
          <ul className="toolbar mb-0 align-items-center">
            {children}
          </ul>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  main: state.main,
});

export default connect(mapStateToProps)(ActionBarSNCF);
