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
  className = '',
}: StdcmCardProps) => (
  <button
    className={`${className}-card-wrapper`}
    type="button"
    disabled={disabled}
    onClick={onClick}
  >
    <StdcmCard tip={tip} disabled={disabled} className={className} testId={testId}>
      <span className="stdcm-default-card-icon">{Icon}</span>
      <span className="stdcm-default-card-text">{text}</span>
    </StdcmCard>
  </button>
);

export default StdcmDefaultCard;
