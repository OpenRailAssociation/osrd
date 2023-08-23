import React from 'react';
import Loader from 'common/Loader';

type Props = {
  msg: '';
};

export default function ScenarioLoader({ msg }: Props) {
  return (
    <div className="scenario-loader">
      <Loader />
      <div className="scenario-loader-msg">{msg}</div>
    </div>
  );
}
