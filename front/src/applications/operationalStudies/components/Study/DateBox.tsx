import { useTranslation } from 'react-i18next';

import { dateTimeFormatting } from 'utils/date';

type Props = {
  date?: Date | null;
  className: string;
  translation: string;
  withoutTime?: boolean;
};

export default function DateBox({ date, className, translation, withoutTime }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  return (
    <div className={`study-details-dates-date ${className}`}>
      <span className="study-details-dates-date-label">{t(`dates.${translation}`)}</span>
      <span className="study-details-dates-date-value">
        {date ? (
          dateTimeFormatting(date, withoutTime)
        ) : (
          <small className="text-muted">{t('noDateFound')}</small>
        )}
      </span>
    </div>
  );
}
