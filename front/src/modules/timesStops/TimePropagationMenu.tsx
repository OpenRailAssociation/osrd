import { ArrowBoth, ArrowDown, ArrowUp, Dot } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { OSRDMenuItem } from 'common/OSRDMenu';

import { formatPropagationDeltaLabelByMode } from './helpers/timePropagation';
import PropagationMenu from './PropagationMenu';
import type { PropagationMode } from './types';

type TimePropagationMenuProps = {
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  oldValue: Date | null;
  newValue: Date | null;
  onSelectMode: (mode: PropagationMode) => void;
  disableFromDeparture?: boolean;
  disableToDestination?: boolean;
  isOriginArrival?: boolean;
};

const MODE_ITEMS: { mode: PropagationMode; icon: React.ReactNode; className?: string }[] = [
  { mode: 'shiftAllWaypoints', icon: <ArrowBoth /> },
  { mode: 'fromDeparture', icon: <ArrowUp /> },
  { mode: 'atThisWaypoint', icon: <Dot variant="base" />, className: 'selected' },
  { mode: 'toDestination', icon: <ArrowDown /> },
];

const TimePropagationMenu = ({
  isOpen,
  anchorRef,
  oldValue,
  newValue,
  onSelectMode,
  disableFromDeparture = false,
  disableToDestination = false,
  isOriginArrival = false,
}: TimePropagationMenuProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'timeStopTable.propagationMenu' });
  const disabledByMode: Partial<Record<PropagationMode, boolean>> = {
    fromDeparture: disableFromDeparture,
    toDestination: disableToDestination,
  };

  const items: OSRDMenuItem[] = MODE_ITEMS.map(({ mode, icon, className }) => ({
    title: `${formatPropagationDeltaLabelByMode(oldValue, newValue, mode, isOriginArrival)} ${t(mode)}`,
    icon,
    className,
    disabled: disabledByMode[mode],
    onClick: () => onSelectMode(mode),
  }));

  return (
    <PropagationMenu
      isOpen={isOpen}
      anchorRef={anchorRef}
      items={items}
      wrapperClassName="propagation-menu-wrapper--time"
    />
  );
};

export default TimePropagationMenu;
