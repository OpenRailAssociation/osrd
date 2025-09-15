import { type ReactNode } from 'react';

type MapButtonProps = {
  onClick: () => void;
  isNewButton: boolean;
  icon: ReactNode;
  tooltip: string;
  extraClasses?: string;
  dataTestId?: string;
};

const MapButton = ({
  onClick,
  isNewButton,
  icon,
  tooltip,
  extraClasses = '',
  dataTestId,
}: MapButtonProps) => (
  <button
    type="button"
    className={`${isNewButton ? 'new-btn-map' : 'btn-rounded btn-rounded-white'} ${extraClasses}`}
    onClick={onClick}
    title={tooltip}
    data-testid={dataTestId}
  >
    <span className="sr-only">{tooltip}</span>
    {icon}
  </button>
);

export default MapButton;
