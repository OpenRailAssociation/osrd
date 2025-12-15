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

import { computeTimetablePackageName, isSandbox } from './utils';

type TrainScheduleSetTabProps = PropsWithChildren<{
  trainScheduleSet: TrainScheduleSet;
  catalogName?: string;
  handleClickPackage: (id: number) => void;
  handleSelectPackage: () => void;
  isSelectMode: boolean;
  isSelected: boolean;
  isIndeterminate: boolean;
  isTrainListOpen: boolean;
}>;

const TrainScheduleSetTab = ({
  trainScheduleSet,
  catalogName,
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
      <div className={cx('package-tab-container', { sandbox: isSandbox(trainScheduleSet) })}>
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
          {isSandbox(trainScheduleSet) && <Beaker className="package-status" />}
          {!isSandbox(trainScheduleSet) &&
            (trainScheduleSet.published ? (
              <Broadcast className="package-status" />
            ) : (
              <DeviceDesktop className="package-status" />
            ))}
          <span>
            {isSandbox(trainScheduleSet)
              ? t('sandbox')
              : computeTimetablePackageName(trainScheduleSet.name!, catalogName)}
          </span>
        </div>
        <MenuTriggerButton
          buttonProps={{
            // TODO Package : adapt when back ready
            disabled: isSandbox(trainScheduleSet) || true,
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
