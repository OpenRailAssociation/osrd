import React from 'react';
import PropTypes from 'prop-types';
import { Link, matchPath, withRouter } from 'react-router-dom';

class MastNavItemSNCF extends React.Component {
  static propTypes = {
    link: PropTypes.string.isRequired,
    linkname: PropTypes.string.isRequired,
    icon: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
    bottom: PropTypes.bool,
    location: PropTypes.object.isRequired,
    customAction: PropTypes.func,
  }

  static defaultProps = {
    customAction: () => {},
  }

  render() {
    const {
      link, linkname, icon, bottom, location, customAction,
    } = this.props;

    const match = matchPath(location.pathname, {
      path: link,
      exact: false,
      strict: false,
    });

    const mastNavItemSNCFActive = (match !== null) ? 'active' : '';

    const iconHTML = typeof icon === 'object' ? <i className="icons-size-1x5">{icon}</i> : <i className={`${icon} icons-size-1x5`} aria-hidden="true" />;

    return (bottom === true) ? (
      <div className="mastnav-bottom d-none d-lg-block">
        <Link
          to={link}
          onClick={match !== null ? customAction : () => {}}
          className="mastnav-item mastnav-item-horizontal"
        >
          {iconHTML}
          <span className="font-weight-medium">
            {linkname}
          </span>
        </Link>
      </div>
    ) : (
      <li>
        <Link
          to={link}
          onClick={match !== null ? customAction : () => {}}
          className={`mastnav-item ${mastNavItemSNCFActive}`}
        >
          {iconHTML}
          <span className="font-weight-medium">
            {linkname}
          </span>
        </Link>
      </li>
    );
  }
}

MastNavItemSNCF.defaultProps = {
  bottom: false,
};

export default withRouter(MastNavItemSNCF);
