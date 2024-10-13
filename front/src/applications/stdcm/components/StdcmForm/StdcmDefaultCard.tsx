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
  <StdcmCard hasTip={hasTip} disabled={disabled} className="add-via">
    <button type="button" onClick={onClick}>
      <span className="stdcm-default-card-icon">{Icon}</span>
      <span className="stdcm-default-card-button">{text}</span>
    </button>
  </StdcmCard>
);

export default StdcmDefaultCard;
