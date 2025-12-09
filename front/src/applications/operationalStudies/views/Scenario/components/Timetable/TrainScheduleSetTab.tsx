import type { PropsWithChildren } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import {
  Beaker,
  Broadcast,
  DeviceDesktop,
  TriangleDown,
  TriangleRight,
} from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';
import MenuTriggerButton from 'common/MenuTriggerButton';

type TrainScheduleSetTabProps = PropsWithChildren<{
  trainScheduleSet: TrainScheduleSet;
  handleClickPackage: (id: number) => void;
  handleSelectPackage: () => void;
  isSelectMode: boolean;
  isSelected: boolean;
  isIndeterminate: boolean;
  isTrainListOpen: boolean;
}>;

const TrainScheduleSetTab = ({
  trainScheduleSet,
  handleClickPackage,
  handleSelectPackage,
  isSelectMode,
  isSelected,
  isIndeterminate,
  isTrainListOpen,
  children,
}: TrainScheduleSetTabProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.timetable.packages' });

  return (
    <>
      <div className={cx('package-tab-container', { sandbox: trainScheduleSet.is_sandbox })}>
        <div
          className="package-tab"
          role="button"
          tabIndex={0}
          onClick={() => handleClickPackage(trainScheduleSet.id)}
        >
          {isSelectMode && (
            <Checkbox
              label=""
              checked={isSelected}
              isIndeterminate={isIndeterminate}
              onChange={handleSelectPackage}
              small
            />
          )}
          {isTrainListOpen ? (
            <TriangleDown size="lg" className="package-collapse-icon" />
          ) : (
            <TriangleRight size="lg" className="package-expand-icon" />
          )}
          {trainScheduleSet.is_sandbox && <Beaker className="package-status" />}
          {!trainScheduleSet.is_sandbox &&
            (trainScheduleSet.published ? (
              <Broadcast className="package-status" />
            ) : (
              <DeviceDesktop className="package-status" />
            ))}
          <span>{trainScheduleSet.is_sandbox ? t('sandbox') : trainScheduleSet.name}</span>
        </div>
        <MenuTriggerButton
          buttonProps={{
            // TODO Package : adapt when back ready
            disabled: trainScheduleSet.is_sandbox || true,
          }}
          menuProps={{
            items: [],
          }}
        />
      </div>
      {isTrainListOpen && children}
    </>
  );
};

export default TrainScheduleSetTab;
