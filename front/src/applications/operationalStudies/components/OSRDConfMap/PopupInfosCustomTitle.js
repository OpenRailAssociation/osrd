import React from 'react';
import PropTypes from 'prop-types';
import kmORm from 'common/distances';

export default function PopupInfosCustomTitle(props) {
  const { properties } = props;
  const { name, track_name: trackName, line_code: lineCode, length } = properties;
  const distance = kmORm(length);
  let title = '';
  if (lineCode !== undefined && lineCode.length !== 0) {
    title = `${lineCode} ${trackName}`;
  } else if (name) {
    title = properties.name;
  }
  return (
    <>
      <strong className="mr-2">{title}</strong>
      {length && (
        <small className="mr-2">
          {distance.value}
          <small className="text-uppercase">{distance.unit}</small>
        </small>
      )}
    </>
  );
}

PopupInfosCustomTitle.propTypes = {
  properties: PropTypes.object.isRequired,
};
