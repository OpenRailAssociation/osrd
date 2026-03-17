import { useCallback, useMemo } from 'react';

import { PlusCircle, NoEntry, Broadcast, CheckCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { CartManagement, EnhancedTrainScheduleSet } from './types';

type TrainScheduleSetMenuItemProps = CartManagement & {
  trainScheduleSet: EnhancedTrainScheduleSet;
  disabled?: boolean;
};

const TrainScheduleSetMenuItem = ({
  trainScheduleSet,
  cart,
  disabled = false,
  upsertToCart,
  removeFromCart,
}: TrainScheduleSetMenuItemProps) => {
  const { t: tCommon } = useTranslation(undefined, { keyPrefix: 'common' });
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrainScheduleSet' });

  const cartImportType = useMemo(() => {
    const cartItem = cart.find((e) => e.trainScheduleSetId === trainScheduleSet.id);
    return cartItem ? cartItem.importType : null;
  }, [cart, trainScheduleSet.id]);

  const onClick = useCallback(() => {
    if (disabled) return;
    if (cartImportType) removeFromCart(trainScheduleSet.id);
    else upsertToCart(trainScheduleSet.id, 'reference');
  }, [trainScheduleSet.id, cartImportType, upsertToCart, removeFromCart, disabled]);

  const statusIcon = useMemo(() => {
    const className = 'status';
    if (disabled)
      return <CheckCircle variant="fill" className={className} iconColor="var(--color-info-30)" />;

    if (cartImportType) return <NoEntry variant="fill" className={className} />;

    return <PlusCircle className={className} />;
  }, [cartImportType, disabled]);

  const btnTitle = useMemo(() => {
    if (disabled) return t('trainScheduleSetAlreadyImported');
    return cartImportType ? tCommon('delete') : tCommon('add');
  }, [cartImportType, disabled, tCommon, t]);

  return (
    <button
      className={cx('trainscheduleset-card', { disabled })}
      title={btnTitle}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="header">
        {statusIcon}

        <div className="title">
          <div className="name">
            <span>{trainScheduleSet.name}</span>
            {/*
              If the item is imported as a ref, we display the icon, 
              Same for disable because it can only be a ref 
            */}
            {(cartImportType === 'reference' || disabled) && <Broadcast className="icon" />}
          </div>
          <div className="metadata">
            {t('trainSchedulesCount', { count: trainScheduleSet.train_schedule_count })}
          </div>
        </div>
      </div>
      <p className="body">{trainScheduleSet.description}</p>
    </button>
  );
};

export default TrainScheduleSetMenuItem;
