import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class MastNavSNCF extends React.Component {
  static propTypes = {
    items: PropTypes.object.isRequired,
    itemsBottom: PropTypes.object,
    main: PropTypes.object.isRequired,
  }

  static defaultProps = {
    itemsBottom: (
      <>
      </>
    ),
  }

  render() {
    const { items, itemsBottom, main } = this.props;
    return (
      <nav role="navigation" className={`mastnav${main.fullscreen ? ' fullscreen' : ''}`}>
        <ul className="mastnav-top">
          {items}
        </ul>
        {itemsBottom}
      </nav>
    );
  }
}

const mapStateToProps = (state) => ({
  main: state.main,
});

export default connect(mapStateToProps)(MastNavSNCF);
