import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class FloatingBar extends Component {
  static propTypes = {
    children: PropTypes.array.isRequired,
    main: PropTypes.object.isRequired,
  }

  render() {
    const { children, main } = this.props;
    const leftChildren = React.Children.toArray(children).filter((child) => (
      child.props.left
    ));
    const rightChildren = React.Children.toArray(children).filter((child) => (
      !child.props.left
    ));
    return (
      <div className={`actionbar${main.fullscreen ? ' fullscreen' : ''} pl-0`}>
        <div className="actionbar-head">
          <ul className="toolbar mb-0 pt-3 pb-3 white-background align-items-center">
            {leftChildren}
          </ul>
          <ul className="toolbar mb-0 pt-3 pb-3 white-background align-items-center">
            {rightChildren}
          </ul>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  main: state.main,
});

export default connect(mapStateToProps)(FloatingBar);
