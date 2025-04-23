import { useTranslation } from 'react-i18next';

import { dateTimeFormatting } from 'utils/date';

type Props = {
  date?: Date | null;
  type: 'creation' | 'expected-end' | 'modified' | 'real-end' | 'start' | 'end';
  withoutTime?: boolean;
};

export default function DateBox({ date, type, withoutTime }: Props) {
  const { t } = useTranslation('operational-studies');
  return (
    <div className={`study-details-dates-date ${type}`}>
      <span className="study-details-dates-date-label">{t(`study.date-${type}`)}</span>
      <span className="study-details-dates-date-value">
        {date ? (
          dateTimeFormatting(date, withoutTime)
        ) : (
          <small className="text-muted">{t('study.noDateFound')}</small>
        )}
      </span>
    </div>
  );
}
