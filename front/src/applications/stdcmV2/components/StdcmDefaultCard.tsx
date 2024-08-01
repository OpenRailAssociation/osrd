import React from 'react';

import StdcmCard from './StdcmCard';

type StdcmCardProps = {
  text: string;
  Icon: React.ReactNode;
  hasTip?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};
const StdcmDefaultCard = ({
  text,
  Icon,
  hasTip = false,
  onClick,
  disabled = false,
}: StdcmCardProps) => (
  <StdcmCard hasTip={hasTip} disabled={disabled}>
    <button type="button" onClick={onClick}>
      <span className="stdcm-v2-default-card-icon">{Icon}</span>
      <span className="stdcm-v2-default-card-button pl-3">{text}</span>
    </button>
  </StdcmCard>
);

export default StdcmDefaultCard;
