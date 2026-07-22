import { ArrowDown, ArrowUp, Dot } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { OSRDMenuItem } from 'common/OSRDMenu';
import type { Duration } from 'utils/duration';

import { formatStopDurationDeltaLabel } from './helpers/stopDurationPropagation';
import PropagationMenu from './PropagationMenu';
import type { StopPropagationMode } from './types';

type DurationPropagationMenuProps = {
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  oldValue: Duration | null;
  newValue: Duration | null;
  onSelectMode: (mode: StopPropagationMode) => void;
  disableFromDeparture?: boolean;
  disableToDestination?: boolean;
};

const DurationPropagationMenu = ({
  isOpen,
  anchorRef,
  oldValue,
  newValue,
  onSelectMode,
  disableFromDeparture = false,
  disableToDestination = false,
}: DurationPropagationMenuProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'timeStopTable.propagationMenu' });
  const deltaLabel = formatStopDurationDeltaLabel(oldValue, newValue);
  const selectMode = (mode: StopPropagationMode) => () => onSelectMode(mode);

  const items: OSRDMenuItem[] = [
    {
      title: `${deltaLabel} ${t('stopDurationFromDeparture')}`,
      icon: <ArrowUp />,
      disabled: disableFromDeparture,
      onClick: selectMode('fromDeparture'),
    },
    {
      title: `${deltaLabel} ${t('stopDurationAtThisWaypoint')}`,
      icon: <Dot variant="base" />,
      className: 'selected',
      onClick: selectMode('atThisWaypoint'),
    },
    {
      title: `${deltaLabel} ${t('stopDurationToDestination')}`,
      icon: <ArrowDown />,
      disabled: disableToDestination,
      onClick: selectMode('toDestination'),
    },
  ];

  return (
    <PropagationMenu
      isOpen={isOpen}
      anchorRef={anchorRef}
      items={items}
      wrapperClassName="propagation-menu-wrapper--duration"
    />
  );
};

export default DurationPropagationMenu;
