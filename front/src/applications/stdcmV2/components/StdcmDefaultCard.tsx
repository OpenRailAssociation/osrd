import React from 'react';

import StdcmCard from './StdcmCard';

type StdcmCardProps = {
  text: string;
  Icon: React.ReactNode;
  hasTip?: boolean;
  onClick?: () => void;
};
const StdcmDefaultCard = ({ text, Icon, hasTip = false, onClick }: StdcmCardProps) => (
  <StdcmCard hasTip={hasTip}>
    <button type="button" onClick={onClick}>
      <span className="stdcm-v2-default-card-icon">{Icon}</span>
      <span className="stdcm-v2-default-card-button pl-3">{text}</span>
    </button>
  </StdcmCard>
);

export default StdcmDefaultCard;
