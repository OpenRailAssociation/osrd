import { useState } from 'react';

const ArrivalTimeLoader = () => {
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
