import React from 'react';
import nextId from 'react-id-generator';
import PropTypes from 'prop-types';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import mlgTraffic from 'applications/osrd/components/RollingStock/consts/mlgtraffic.json';
import { mlgTrafficURL } from 'applications/osrd/components/RollingStock/consts/consts';

function cleanGifName(gifName) {
  const regex = /http:\/\/www\.mlgtraffic\.net\/images\/|\.gif/gi;
  return gifName.replaceAll(regex, '');
}

export default function RollingStock2Img(props) {
  const { name } = props;
  return name && mlgTraffic[name]
    ? mlgTraffic[name].map((gif) => (
        <LazyLoadImage src={`${mlgTrafficURL}${cleanGifName(gif)}.gif`} alt={name} key={nextId()} />
      ))
    : null;
}

RollingStock2Img.defaultProps = {
  name: undefined,
};

RollingStock2Img.propTypes = {
  name: PropTypes.string,
};
