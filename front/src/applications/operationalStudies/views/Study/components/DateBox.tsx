import { useTranslation } from 'react-i18next';

import { useDateTimeLocale } from 'utils/date';

type Props = {
  date?: Date | null;
  type: 'creation' | 'expected-end' | 'modified' | 'real-end' | 'start';
  withoutTime?: boolean;
};

export default function DateBox({ date, type, withoutTime }: Props) {
  const { t } = useTranslation('operational-studies');
  const dateTimeLocale = useDateTimeLocale();
  return (
    <div className={`study-details-dates-date ${type}`}>
      <span className="study-details-dates-date-label">{t(`study.date-${type}`)}</span>
      <span className="study-details-dates-date-value" data-testid={`study-${type}-date-value`}>
        {date ? (
          date.toLocaleString(dateTimeLocale, {
            dateStyle: 'medium',
            timeStyle: withoutTime ? undefined : 'short',
          })
        ) : (
          <small className="text-muted">{t('study.noDateFound')}</small>
        )}
      </span>
    </div>
  );
}
