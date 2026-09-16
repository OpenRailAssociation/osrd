import { Checkbox } from '@osrd-project/ui-core';
import { Calendar } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { MdTrain } from 'react-icons/md';
import { RiFolderChartLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';

import type { ScenarioCardDetails } from 'applications/operationalStudies/types';
import infraLogo from 'assets/pictures/components/tracks.svg';
import { useDateTimeLocale } from 'utils/date';

type ScenarioCardProps = {
  setFilterChips: (filterChips: string) => void;
  scenario: ScenarioCardDetails;
  isSelected: boolean;
  toggleSelect: (id: number) => void;
};

export default function ScenarioCard({
  setFilterChips,
  scenario,
  isSelected,
  toggleSelect,
}: ScenarioCardProps) {
  const { t } = useTranslation('operational-studies');
  const dateTimeLocale = useDateTimeLocale();

  return (
    <Link
      to={`scenarios/${scenario.id}`}
      className={cx('scenario-card', isSelected && 'selected')}
      data-testid={`scenario-card-${scenario.name}`}
      onClick={() => toggleSelect(scenario.id)}
    >
      <div className={cx('scenario-card-name')} data-testid={scenario.name}>
        <RiFolderChartLine />
        <span className="scenario-card-name-text" title={scenario.name}>
          {scenario.name}
        </span>
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- This feature will disappear soon enough */}
        <div className="scenario-card-select" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onChange={() => toggleSelect(scenario.id)}
            data-testid="scenario-card-select"
          />
        </div>
      </div>
      <div className="scenario-card-description">{scenario.description}</div>

      {scenario.tags.length > 0 && (
        <div className="scenario-card-tags" data-testid="scenario-card-tags">
          {scenario.tags.map((tag) => (
            <div
              className="scenario-card-tags-tag"
              key={tag}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFilterChips(tag);
              }}
              title={tag}
            >
              {tag}
            </div>
          ))}
        </div>
      )}
      <div className="scenario-card-footer">
        <div className="scenario-card-infra">
          <img src={infraLogo} alt="infra logo" className="infra-logo" />
          {scenario.infra_name}
        </div>
        <div data-testid="scenario-trains-count" className="scenario-card-trains-count ml-auto">
          <span className="mr-1">
            <MdTrain />
          </span>
          {scenario.train_schedules_count}
        </div>
        <div className="scenario-card-date">
          <span className="mr-1">
            <Calendar />
          </span>
          <span className="mr-1">{t('scenario.updatedOn')}</span>
          {scenario.last_modification &&
            new Date(scenario.last_modification).toLocaleString(dateTimeLocale, {
              dateStyle: 'medium',
            })}
        </div>
      </div>
    </Link>
  );
}
