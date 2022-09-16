import React from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router';
import { Link, matchPath } from 'react-router-dom';

function MastNavItemSNCF(props) {
  const { link, linkname, icon, bottom, customAction } = props;
  const location = useLocation();

  const match = matchPath(
    {
      path: link,
      end: false,
      caseSensitive: false,
    },
    location.pathname
  );

  const mastNavItemSNCFActive = match !== null ? 'active' : '';

  const iconHTML =
    typeof icon === 'object' ? (
      <i className="icons-size-1x5">{icon}</i>
    ) : (
      <i className={`${icon} icons-size-1x5`} aria-hidden="true" />
    );

  return bottom === true ? (
    <div className="mastnav-bottom d-none d-lg-block">
      <Link
        to={link}
        onClick={match !== null ? customAction : () => {}}
        className="mastnav-item mastnav-item-horizontal"
      >
        {iconHTML}
        <span className="font-weight-medium">{linkname}</span>
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
        <span className="font-weight-medium">{linkname}</span>
      </Link>
    </li>
  );
}

MastNavItemSNCF.propTypes = {
  link: PropTypes.string.isRequired,
  linkname: PropTypes.string.isRequired,
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  bottom: PropTypes.bool,
  customAction: PropTypes.func,
};

MastNavItemSNCF.defaultProps = {
  bottom: false,
  customAction: () => {},
};

export default MastNavItemSNCF;
