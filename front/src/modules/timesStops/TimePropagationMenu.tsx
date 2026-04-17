import { ArrowBoth, ArrowDown, ArrowUp, Dot } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import AnchoredMenu from 'common/AnchoredMenu';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import OSRDMenu from 'common/OSRDMenu';

import { formatPropagationDeltaLabelByMode } from './helpers/timePropagation';
import type { PropagationMode } from './types';

type TimePropagationMenuProps = {
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  oldValue: Date | null;
  newValue: Date | null;
  onSelectMode: (mode: PropagationMode) => void;
  disableFromDeparture?: boolean;
  disableToDestination?: boolean;
  isOrigin?: boolean;
};

const TimePropagationMenu = ({
  isOpen,
  anchorRef,
  oldValue,
  newValue,
  onSelectMode,
  disableFromDeparture = false,
  disableToDestination = false,
  isOrigin = false,
}: TimePropagationMenuProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'timeStopTable.propagationMenu' });
  const shiftAllWaypointsDeltaLabel = formatPropagationDeltaLabelByMode(
    oldValue,
    newValue,
    'shiftAllWaypoints'
  );
  const fromDepartureDeltaLabel = formatPropagationDeltaLabelByMode(
    oldValue,
    newValue,
    'fromDeparture'
  );
  const atThisWaypointDeltaLabel = formatPropagationDeltaLabelByMode(
    oldValue,
    newValue,
    'atThisWaypoint',
    isOrigin
  );
  const toDestinationDeltaLabel = formatPropagationDeltaLabelByMode(
    oldValue,
    newValue,
    'toDestination',
    isOrigin
  );
  const selectMode = (mode: PropagationMode) => () => onSelectMode(mode);

  const items: OSRDMenuItem[] = [
    {
      title: `${shiftAllWaypointsDeltaLabel} ${t('shiftAllWaypoints')}`,
      icon: <ArrowBoth />,
      onClick: selectMode('shiftAllWaypoints'),
    },
    {
      title: `${fromDepartureDeltaLabel} ${t('fromDeparture')}`,
      icon: <ArrowUp />,
      disabled: disableFromDeparture,
      onClick: selectMode('fromDeparture'),
    },
    {
      title: `${atThisWaypointDeltaLabel} ${t('atThisWaypoint')}`,
      icon: <Dot variant="base" />,
      className: 'selected',
      onClick: selectMode('atThisWaypoint'),
    },
    {
      title: `${toDestinationDeltaLabel} ${t('toDestination')}`,
      icon: <ArrowDown />,
      disabled: disableToDestination,
      onClick: selectMode('toDestination'),
    },
  ];

  return (
    <AnchoredMenu
      anchorRef={anchorRef}
      onDismiss={() => {}}
      placement="beside"
      focusOnFirstElement={false}
    >
      {isOpen && (
        <div
          role="presentation"
          className="time-propagation-menu-wrapper"
          onMouseDown={(e) => e.preventDefault()}
        >
          <OSRDMenu items={items} className="time-propagation-menu" />
        </div>
      )}
    </AnchoredMenu>
  );
};

export default TimePropagationMenu;
