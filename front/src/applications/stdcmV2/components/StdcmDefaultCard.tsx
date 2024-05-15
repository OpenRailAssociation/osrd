import React from 'react';

import StdcmCard from './StdcmCard';

type StdcmCardProps = {
  text: string;
  Icon: React.ReactNode;
};
const StdcmDefaultCard = ({ text, Icon }: StdcmCardProps) => (
  <StdcmCard hasTip>
    <div>
      <span>{Icon}</span>
      <span>{text}</span>
    </div>
  </StdcmCard>
);

export default StdcmDefaultCard;
