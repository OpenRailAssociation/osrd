import React from 'react';
import PropTypes from 'prop-types';

export default class FilterMenuCategorySNCF extends React.Component {
  static propTypes = {
    htmlID: PropTypes.string.isRequired,
    children: PropTypes.array.isRequired,
    title: PropTypes.string.isRequired,
    expanded: PropTypes.bool,
  }

  static defaultProps = {
    expanded: false,
  }

  render() {
    const {
      htmlID, children, title, expanded,
    } = this.props;

    let childrenClass = 'filters-group-content collapse';
    if (expanded) {
      childrenClass += ' show';
    }
    return (
      <div className="filters-group">
        <div className="filters-group-head" data-toggle="collapse" data-target={`#${htmlID}`} aria-expanded={expanded}>
          <div className="filters-group-title text-uppercase">{title}</div>
          <div className="filters-group-toggle text-primary">
            <i className="icons-arrow-down icons-size-x75" aria-hidden="true" />
          </div>
        </div>
        <div id={htmlID} className={childrenClass}>
          {children}
        </div>
      </div>
    );
  }
}
