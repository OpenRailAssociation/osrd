import { useMemo, type PropsWithChildren } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import {
  Beaker,
  Broadcast,
  DesktopDownload,
  DeviceDesktop,
  Duplicate,
  LinkExternal,
  NoEntry,
  Pencil,
  TriangleDown,
  TriangleRight,
  Verified,
} from '@osrd-project/ui-icons';
import cx from 'classnames';
import { noop } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';
import MenuTriggerButton, { type MenuProps } from 'common/MenuTriggerButton';

import { computeTrainScheduleSetName, isSandbox } from '../utils';

type TrainScheduleSetTabProps = PropsWithChildren<{
  trainScheduleSet: TrainScheduleSet;
  catalogName?: string;
  handleClickTrainScheduleSet: (id: number) => void;
  handleSelectTrainScheduleSet: () => void;
  isSelectMode: boolean;
  isSelected: boolean;
  isIndeterminate: boolean;
  isTrainListOpen: boolean;
}>;

const TrainScheduleSetTab = ({
  trainScheduleSet,
  catalogName,
  handleClickTrainScheduleSet,
  handleSelectTrainScheduleSet,
  isSelectMode,
  isSelected,
  isIndeterminate,
  isTrainListOpen,
  children,
}: TrainScheduleSetTabProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.timetable.trainScheduleSets',
  });

  const menuProps: MenuProps = useMemo(
    () => ({
      items: [
        trainScheduleSet.published
          ? {
              title: t('transformToLocalCopy'),
              icon: <DesktopDownload />,
              onClick: noop,
              disabled: true,
            }
          : {
              title: t('publishToCatalog'),
              icon: <Verified />,
              onClick: noop,
              disabled: true,
            },
        trainScheduleSet.published
          ? {
              title: t('edit'),
              icon: <LinkExternal />,
              onClick: noop,
              disabled: true,
            }
          : {
              title: t('editName'),
              icon: <Pencil />,
              onClick: noop,
              disabled: true,
            },
        {
          title: t('duplicate'),
          icon: <Duplicate />,
          onClick: () => noop,
          disabled: true,
        },
        {
          title: t('removeFromScenario'),
          icon: <NoEntry />,
          onClick: noop,
          disabled: true,
        },
      ],
    }),
    [trainScheduleSet]
  );

  return (
    <>
      <div
        className={cx('train-schedule-set-tab-container', { sandbox: isSandbox(trainScheduleSet) })}
      >
        <div
          className="train-schedule-set-tab"
          role="button"
          tabIndex={0}
          onClick={() => handleClickTrainScheduleSet(trainScheduleSet.id)}
        >
          {isSelectMode && (
            <Checkbox
              label=""
              checked={isSelected}
              isIndeterminate={isIndeterminate}
              onChange={handleSelectTrainScheduleSet}
              small
            />
          )}
          {isTrainListOpen ? (
            <TriangleDown size="lg" className="train-schedule-set-collapse-icon" />
          ) : (
            <TriangleRight size="lg" className="train-schedule-set-expand-icon" />
          )}
          {isSandbox(trainScheduleSet) && <Beaker className="train-schedule-set-status" />}
          {!isSandbox(trainScheduleSet) &&
            (trainScheduleSet.published ? (
              <Broadcast className="train-schedule-set-status" />
            ) : (
              <DeviceDesktop className="train-schedule-set-status" />
            ))}
          <span>
            {isSandbox(trainScheduleSet)
              ? t('sandbox')
              : computeTrainScheduleSetName(trainScheduleSet.name!, catalogName)}
          </span>
        </div>
        {!isSandbox(trainScheduleSet) && (
          <MenuTriggerButton buttonProps={{}} menuProps={menuProps} />
        )}
      </div>
      {isTrainListOpen && children}
    </>
  );
};

export default TrainScheduleSetTab;
