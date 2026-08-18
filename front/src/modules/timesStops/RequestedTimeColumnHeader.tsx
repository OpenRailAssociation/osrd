import { useRef, useState } from 'react';

import { ArrowLeft, TriangleDown } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import AnchoredMenu from 'common/AnchoredMenu';
import OSRDMenu, { type OSRDMenuItem } from 'common/OSRDMenu';

import { getRowsToUpdateFromSimulation } from './helpers/fillTimesFromSimulation';
import type { RequestedTimeField, TimesStopsRowNew } from './types';

type RequestedTimeColumnHeaderProps = {
  field: RequestedTimeField;
  isSimulationValid: boolean;
  rows: TimesStopsRowNew[];
  onFillEmpty: () => void;
  onOverwriteAll: () => void;
  onMouseEnterFillEmpty: () => void;
  onMouseEnterOverwriteAll: () => void;
  onMouseLeave: () => void;
};

const RequestedTimeColumnHeader = ({
  field,
  isSimulationValid,
  rows,
}: RequestedTimeColumnHeaderProps) => {
  const { t } = useTranslation('translation', {
    keyPrefix: 'timeStopTable',
  });

  const [isOpen, setOpen] = useState<boolean>(false);

  const fillRequestTimesCount = getRowsToUpdateFromSimulation(rows, field, 'fill').length;
  const overwriteRequestTimesCount = getRowsToUpdateFromSimulation(rows, field, 'overwrite').length;

  const items: OSRDMenuItem[] = [
    {
      title: `${t(`columnHeader.${field}.overwriteAll`, { count: overwriteRequestTimesCount })}`,
      icon: <ArrowLeft />,
      onClick: () => {},
      onMouseEnter: () => {},
      onMouseLeave: () => {},
    },
  ];

  if (fillRequestTimesCount !== 0 && fillRequestTimesCount !== overwriteRequestTimesCount) {
    items.push({
      title: `${t(`columnHeader.${field}.fillEmpty`, { count: fillRequestTimesCount })}`,
      icon: <ArrowLeft />,
      onClick: () => {},
      onMouseEnter: () => {},
      onMouseLeave: () => {},
    });
  }

  const anchorRef = useRef<HTMLButtonElement>(null);

  const isDisabled = !isSimulationValid || overwriteRequestTimesCount === 0;

  return (
    <div className="requested-time-column-header-wrapper">
      <span>{t(field)}</span>
      <button
        ref={anchorRef}
        type="button"
        disabled={isDisabled}
        className={cx('requested-time-column-header-toggle', {
          'requested-time-column-header-toggle--disabled': isDisabled,
        })}
        onClick={() => setOpen(true)}
      >
        <TriangleDown
          className={
            isOpen
              ? 'requested-time-column-header-toggle-icon-open'
              : 'requested-time-column-header-toggle-icon-closed'
          }
        />
      </button>
      <AnchoredMenu
        anchorRef={anchorRef}
        onDismiss={() => setOpen(false)}
        placement="below"
        focusOnFirstElement={false}
      >
        {isOpen && (
          <div
            role="presentation"
            className="requested-time-column-header-menu-wrapper"
            onMouseDown={(e) => e.preventDefault()}
          >
            <OSRDMenu items={items} className="requested-time-column-header-menu" />
          </div>
        )}
      </AnchoredMenu>
    </div>
  );
};

export default RequestedTimeColumnHeader;
