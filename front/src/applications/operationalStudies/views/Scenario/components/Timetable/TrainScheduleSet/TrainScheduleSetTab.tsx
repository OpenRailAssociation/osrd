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

import type { TrainScheduleSetManager } from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { CatalogEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';
import MenuTriggerButton, { type MenuProps } from 'common/MenuTriggerButton';

import TrainScheduleDeleteDialog from './TrainScheduleDeleteDialog';
import { computeTrainScheduleSetName, isSandbox } from '../utils';
import LocalCopyTrainScheduleSetDialog from './LocalCopyTrainScheduleSetDialog';
import TrainScheduleSetDialog from './TrainScheduleSetDialog';

type OpenDialogName =
  | 'duplicate'
  | 'editPublished'
  | 'editLocal'
  | 'removePublished'
  | 'removeLocal'
  | 'publishToCatalog'
  | 'transformToLocalCopy';

type TrainScheduleSetTabProps = PropsWithChildren<{
  trainScheduleSet: TrainScheduleSet;
  catalogName?: string | null;
  handleClickTrainScheduleSet: (id: number) => void;
  handleSelectTrainScheduleSet: () => void;
  isSelectMode: boolean;
  isSelected: boolean;
  isIndeterminate: boolean;
  isCheckboxDisabled: boolean;
  isTrainListOpen: boolean;
  catalogEntries: CatalogEntry[];
  manageTrainScheduleSet: TrainScheduleSetManager;
}>;

const TrainScheduleSetTab = ({
  trainScheduleSet,
  catalogName,
  handleClickTrainScheduleSet,
  handleSelectTrainScheduleSet,
  isSelectMode,
  isSelected,
  isIndeterminate,
  isCheckboxDisabled,
  isTrainListOpen,
  catalogEntries,
  manageTrainScheduleSet,
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
        trainScheduleSet.published
          ? {
              title: t('edit'),
              icon: <LinkExternal />,
              onClick: () => setOpenedDialog('editPublished'),
              disabled: false,
            }
          : {
              title: t('edit'),
              icon: <LinkExternal />,
              onClick: () => setOpenedDialog('editLocal'),
              disabled: false,
            },
        {
          title: t('duplicate'),
          icon: <Duplicate />,
          onClick: () => noop,
          disabled: true,
        },
        trainScheduleSet.published
          ? {
              title: t('removeFromScenario'),
              icon: <NoEntry />,
              onClick: () => setOpenedDialog('removePublished'),
              disabled: false,
            }
          : {
              title: t('removeFromScenario'),
              icon: <NoEntry />,
              onClick: () => setOpenedDialog('removeLocal'),
              disabled: false,
            },
      ],
    }),
    [trainScheduleSet, t]
  );

  const tabName = isSandbox(trainScheduleSet)
    ? t('sandbox')
    : computeTrainScheduleSetName(trainScheduleSet.name!, catalogName);

  return (
    <>
      <div
        className={cx('train-schedule-set-tab-container', { sandbox: isSandbox(trainScheduleSet) })}
      >
        <div
          className="train-schedule-set-tab"
          role="button"
          tabIndex={0}
          onClick={() => {
            if (isCheckboxDisabled && isSelectMode) return;
            handleClickTrainScheduleSet(trainScheduleSet.id);
          }}
        >
          {isSelectMode && (
            <Checkbox
              label=""
              checked={isSelected}
              isIndeterminate={isIndeterminate}
              disabled={isCheckboxDisabled}
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
          <span title={tabName} className="tab-name">
            {tabName}
          </span>
        </div>
        {!isSandbox(trainScheduleSet) && (
          <MenuTriggerButton buttonProps={{}} menuProps={menuProps} />
        )}
      </div>
      {openedDialog === 'publishToCatalog' &&
        createPortal(
          <TrainScheduleSetDialog
            trainScheduleSet={trainScheduleSet}
            catalogEntries={catalogEntries}
            labels={{
              title: t('publishDialogTitle'),
              submit: t('publishSubmit'),
              submitWithChanges: t('editAndPublish'),
              cancel: t('cancel'),
            }}
            onCancel={() => setOpenedDialog(null)}
            onSubmit={async (data) => {
              await manageTrainScheduleSet.publishSet(trainScheduleSet, data);
            }}
            checkNameInCatalogIsUniq={async (name, catalogId) => {
              const result = manageTrainScheduleSet.getSetByCatalogAndName(name, catalogId);
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
              await manageTrainScheduleSet.localCopySet(trainScheduleSet);
            }}
          />,
          document.body
        )}
      {(openedDialog === 'editPublished' || openedDialog === 'editLocal') &&
        createPortal(
          <TrainScheduleSetDialog
            trainScheduleSet={trainScheduleSet}
            catalogEntries={catalogEntries}
            labels={{
              title: t(openedDialog === 'editLocal' ? 'editLocalTitle' : 'editPublishedTitle'),
              submit: t(openedDialog === 'editLocal' ? 'edit' : 'editAndPublish'),
              cancel: t('cancel'),
            }}
            onCancel={() => setOpenedDialog(null)}
            onSubmit={async (data) => {
              await manageTrainScheduleSet.updateSet(trainScheduleSet, data);
            }}
          />,
          document.body
        )}

      {(openedDialog === 'removePublished' || openedDialog === 'removeLocal') &&
        createPortal(
          <TrainScheduleDeleteDialog
            trainScheduleSet={trainScheduleSet}
            labels={{
              title: t(
                openedDialog === 'removeLocal' ? 'localRemoveDialogTitle' : 'removeDialogTitle'
              ),
              texts: [
                t('removeDialogText', {
                  name: trainScheduleSet.name,
                }),
                openedDialog === 'removeLocal' ? t('localRemoveDialogWarning') : '',
              ],
              submit: t('removeFromScenario'),
              cancel: t('cancel'),
            }}
            onCancel={() => setOpenedDialog(null)}
            onDelete={async () => {
              await manageTrainScheduleSet.removeSet(trainScheduleSet.id);
            }}
          />,
          document.body
        )}
    </>
  );
};

export default TrainScheduleSetTab;
