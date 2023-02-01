import React from 'react';
import nextId from 'react-id-generator';
import PropTypes from 'prop-types';
import { LazyLoadImage } from 'react-lazy-load-image-component';

function RollingStock2Img(props) {
  const { rollingStock } = props;
  if (!rollingStock || !Array.isArray(rollingStock.liveries)) return null;
  const defaultLivery = rollingStock.liveries.find((livery) => livery.name === 'default');
  return defaultLivery?.url ? (
    <LazyLoadImage src={defaultLivery.url} alt={rollingStock?.name} key={nextId()} />
  ) : null;
}

RollingStock2Img.defaultProps = {};

RollingStock2Img.propTypes = {
  rollingStock: PropTypes.object.isRequired,
};

const MemoRollingStock2Img = React.memo(RollingStock2Img);
export default MemoRollingStock2Img;
