import StdcmCard from './StdcmCard';

type StdcmCardProps = {
  text: string;
  Icon: React.ReactNode;
  tip?: 'bottom' | 'right' | undefined;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  testId?: string;
  tooltip?: string;
};
const StdcmDefaultCard = ({
  text,
  Icon,
  tip = undefined,
  onClick,
  disabled = false,
  className = '',
  testId = '',
  tooltip,
}: StdcmCardProps) => (
  <div title={tooltip} style={{ display: 'contents' }}>
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
  </div>
);

export default StdcmDefaultCard;
