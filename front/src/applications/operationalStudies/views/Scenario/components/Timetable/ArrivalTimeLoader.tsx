import { useState } from 'react';

const ArrivalTimeLoader = () => {
  // TODO: fix this lint
  // eslint-disable-next-line react-hooks/purity
  const [animationDelay] = useState(Math.random());
  return (
    <div
      className="arrival-time-loader"
      data-testid="arrival-time-loader"
      style={{ animationDelay: `${animationDelay}s` }}
    />
  );
};

export default ArrivalTimeLoader;
