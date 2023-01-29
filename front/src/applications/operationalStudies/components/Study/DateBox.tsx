import React from 'react';
import { useTranslation } from 'react-i18next';
import { dateTimeFrenchFormatting } from 'utils/date';

type Props = {
  date: Date;
  css: string;
  translation: string;
};

export default function DateBox({ date, css, translation }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  return (
    <div className={`study-details-dates-date ${css}`}>
      <span className="study-details-dates-date-label">{t(`dates.${translation}`)}</span>
      <span className="study-details-dates-date-value">{dateTimeFrenchFormatting(date)}</span>
    </div>
  );
}
