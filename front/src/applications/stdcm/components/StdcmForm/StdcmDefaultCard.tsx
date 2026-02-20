import StdcmCard from './StdcmCard';

type StdcmCardProps = {
  text: string;
  Icon: React.ReactNode;
  tip?: 'bottom' | 'right' | undefined;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};
const StdcmDefaultCard = ({
  text,
  Icon,
  tip = undefined,
  onClick,
  disabled = false,
  className = 'add-via',
}: StdcmCardProps) => (
  <button type="button" disabled={disabled} onClick={onClick}>
    <StdcmCard tip={tip} disabled={disabled} className={className}>
      <span className="stdcm-default-card-icon">{Icon}</span>
      <span className="stdcm-default-card-button">{text}</span>
    </StdcmCard>
  </button>
);

export default StdcmDefaultCard;
