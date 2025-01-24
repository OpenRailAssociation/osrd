import { type ReactNode } from 'react';

import { useTranslation } from 'react-i18next';

type MapButtonProps = {
  onClick: () => void;
  isNewButton: boolean;
  icon: ReactNode;
  tooltipKey: string;
  extraClasses?: string;
  dataTestId?: string;
};

const MapButton = ({
  onClick,
  isNewButton,
  icon,
  tooltipKey,
  extraClasses = '',
  dataTestId,
}: MapButtonProps) => {
  const { t } = useTranslation('translation');

  return (
    <button
      type="button"
      className={`${isNewButton ? 'new-btn-map' : 'btn-rounded btn-rounded-white'} ${extraClasses}`}
      onClick={onClick}
      title={t(tooltipKey)}
      data-testid={dataTestId}
    >
      <span className="sr-only">{t(tooltipKey)}</span>
      {icon}
    </button>
  );
};

export default MapButton;
