import { useMemo, useState, type PropsWithChildren } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import {
  Beaker,
  Broadcast,
  DesktopDownload,
  DeviceDesktop,
  Duplicate,
  LinkExternal,
  NoEntry,
  TriangleDown,
  TriangleRight,
  Verified,
} from '@osrd-project/ui-icons';
import cx from 'classnames';
import { noop } from 'lodash';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import type useScenarioTrainScheduleSet from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';
import MenuTriggerButton, { type MenuProps } from 'common/MenuTriggerButton';

import TrainScheduleSetDialog from './TrainScheduleSetDialog';
import { computeTrainScheduleSetName, isSandbox } from '../utils';
import LocalCopyTrainScheduleSetDialog from './LocalCopyTrainScheduleSetDialog';

type OpenDialogName =
  | 'transformToLocalCopy'
  | 'publishToCatalog'
  | 'edit'
  | 'duplicate'
  | 'removeFromScenario';

type TrainScheduleSetTabProps = PropsWithChildren<{
  trainScheduleSet: TrainScheduleSet;
  catalogName?: string | null;
  handleClickTrainScheduleSet: (id: number) => void;
  handleSelectTrainScheduleSet: () => void;
  isSelectMode: boolean;
  isSelected: boolean;
  isIndeterminate: boolean;
  isTrainListOpen: boolean;
  getCatalogEntries: ReturnType<typeof useScenarioTrainScheduleSet>['getCatalogEntries'];
  publishTrainScheduleSet: ReturnType<
    typeof useScenarioTrainScheduleSet
  >['publishTrainScheduleSet'];
  getTrainScheduleSetByCatalogAndName: ReturnType<
    typeof useScenarioTrainScheduleSet
  >['getTrainScheduleSetByCatalogAndName'];
  localCopyTrainScheduleSet: ReturnType<
    typeof useScenarioTrainScheduleSet
  >['localCopyTrainScheduleSet'];
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
  getCatalogEntries,
  publishTrainScheduleSet,
  getTrainScheduleSetByCatalogAndName,
  localCopyTrainScheduleSet,
}: TrainScheduleSetTabProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.timetable.trainScheduleSets',
  });
  const [openedDialog, setOpenedDialog] = useState<OpenDialogName | null>(null);

  const menuProps: MenuProps = useMemo(
    () => ({
      items: [
        trainScheduleSet.published
          ? {
              title: t('transformToLocalCopy'),
              icon: <DesktopDownload />,
              onClick: () => setOpenedDialog('transformToLocalCopy'),
            }
          : {
              title: t('publishToCatalog'),
              icon: <Verified />,
              onClick: () => setOpenedDialog('publishToCatalog'),
            },
        {
          title: t('edit'),
          icon: <LinkExternal />,
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

      {openedDialog === 'publishToCatalog' &&
        createPortal(
          <TrainScheduleSetDialog
            trainScheduleSet={trainScheduleSet}
            getCatalogEntries={getCatalogEntries}
            labels={{
              title: t('publishDialogTitle'),
              submit: t('publishSubmit'),
              cancel: t('cancel'),
            }}
            onCancel={() => setOpenedDialog(null)}
            onSubmit={async (data) => {
              await publishTrainScheduleSet(trainScheduleSet, data);
            }}
            checkNameInCatalogIsUniq={async (name, catalogId) => {
              const result = await getTrainScheduleSetByCatalogAndName(name, catalogId);
              if (!result) return true;
              return result.id === trainScheduleSet.id;
            }}
          />,
          document.body
        )}

      {openedDialog === 'transformToLocalCopy' &&
        createPortal(
          <LocalCopyTrainScheduleSetDialog
            trainScheduleSet={trainScheduleSet}
            onCancel={() => setOpenedDialog(null)}
            onSubmit={async () => {
              await localCopyTrainScheduleSet(trainScheduleSet);
            }}
          />,
          document.body
        )}
    </>
  );
};

export default TrainScheduleSetTab;
