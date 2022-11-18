import React from 'react';
import nextId from 'react-id-generator';
import PropTypes from 'prop-types';
import mlgTraffic from 'applications/osrd/components/RollingStock/consts/mlgtraffic.json';
import { mlgTrafficURL } from 'applications/osrd/components/RollingStock/consts/consts';

export default function RollingStock2Img(props) {
  const { name } = props;
  return mlgTraffic[name]
    ? mlgTraffic[name].map((gif) => (
        <img src={`${mlgTrafficURL}${gif}.gif`} alt={name} key={nextId()} />
      ))
    : null;
}

RollingStock2Img.propTypes = {
  name: PropTypes.string.isRequired,
};
