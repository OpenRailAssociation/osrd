import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class FilterMenuSNCF extends React.Component {
  static propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.object,
    ]).isRequired,
    main: PropTypes.object.isRequired,
    toggleFiltersMenu: PropTypes.func.isRequired,
    isShown: PropTypes.bool.isRequired,
    title: PropTypes.string,
    header: PropTypes.object,
  }

  static defaultProps = {
    title: undefined,
    header: undefined,
  }

  renderHeader = () => {
    const {
      title,
      header,
      toggleFiltersMenu,
    } = this.props;
    let content;
    if (header === undefined) {
      return null;
    }
    if (title !== undefined) {
      content = (
        <>
          <div className="table-filters-title">{title}</div>
          <ul className="toolbar mb-0">
            <li className="toolbar-item">
              <button type="button" className="btn btn-sm btn-white toolbar-item-spacing" onClick={toggleFiltersMenu}>
                <span className="sr-only">Close</span>
                <i className="icons-close icons-size-1x" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </>
      );
    } else {
      content = header;
    }
    return (
      <div className="table-filters-head">
        {content}
      </div>
    );
  }

  render() {
    const {
      isShown,
      children,
      main,
    } = this.props;
    return (
      <div id="collapseFiltersMenu" className={`table-filters${main.fullscreen ? ' fullscreen' : ''}${isShown ? ' active' : ''}`}>
        {this.renderHeader()}
        <div className="table-filters-menu">
          {children}
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  main: state.main,
});

export default connect(mapStateToProps)(FilterMenuSNCF);
