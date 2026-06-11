import { SegmentedControl } from '@osrd-project/ui-core';
import { NoEntry, Broadcast, DesktopDownload } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { CatalogEntry } from 'common/api/osrdEditoastApi';

import type { CartManagement, EnhancedTrainScheduleSet, TrainScheduleSetImportType } from './types';

const TRAINSCHEDULESET_IMPORT_TYPE: TrainScheduleSetImportType[] = ['reference', 'copy'];

const renderOptionIcon = (set: TrainScheduleSetImportType) => {
  if (set === 'copy') {
    return <DesktopDownload />;
  }
  return <Broadcast />;
};

type TrainScheduleSetCartItemProps = CartManagement & {
  trainScheduleSet: EnhancedTrainScheduleSet;
  catalogEntry: CatalogEntry;
  importType: TrainScheduleSetImportType;
};

const TrainScheduleSetCartItem = ({
  trainScheduleSet,
  catalogEntry,
  importType,
  removeFromCart,
  upsertToCart,
}: TrainScheduleSetCartItemProps) => {
  const { t: tCommon } = useTranslation(undefined, { keyPrefix: 'common' });
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrainScheduleSet' });

  return (
    <div className="trainscheduleset-cartItem">
      <div>
        <SegmentedControl
          value={importType}
          getOptionLabel={(set) => t(`importType.${set}`)}
          getOptionValue={(set) => `${set}`}
          getOptionIcon={renderOptionIcon}
          onChange={(set) => upsertToCart(trainScheduleSet.id, set)}
          options={TRAINSCHEDULESET_IMPORT_TYPE}
        />
      </div>
      <div className="info">
        <span className="name">
          {t('trainScheduleSet')} {trainScheduleSet.name}
        </span>
        <span className="catalog">{catalogEntry.name}</span>
      </div>
      <div className="remove">
        <button title={tCommon('delete')} onClick={() => removeFromCart(trainScheduleSet.id)}>
          <NoEntry variant="fill" className="icon" />
        </button>
      </div>
    </div>
  );
};

export default TrainScheduleSetCartItem;
