import React from 'react';
import './Popup.css';
import PropTypes from 'prop-types';

function PopupInfos(props) {
  const { backgroundColor, title, content } = props;
  return (
    <>
      <div className={`mapboxgl-popup-title d-flex align-items-center justify-content-between ${backgroundColor}`}>
        {title}
      </div>
      <div className="mapboxgl-popup-container">
        {content}
      </div>
    </>
  );
}

PopupInfos.propTypes = {
  backgroundColor: PropTypes.string,
  title: PropTypes.object.isRequired,
  content: PropTypes.object.isRequired,
};
PopupInfos.defaultProps = {
  backgroundColor: 'bg-primary',
};

export default PopupInfos;
