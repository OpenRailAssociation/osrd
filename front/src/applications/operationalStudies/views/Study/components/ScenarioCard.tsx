import { Calendar, CheckCircle, FileDirectoryOpen } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { MdTrain } from 'react-icons/md';
import { RiFolderChartLine } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  return (
    <div
      className={cx('scenario-card', isSelected && 'selected')}
      data-testid={`scenario-card-${scenario.name}`}
      onClick={() => toggleSelect(scenario.id)}
      role="button"
      tabIndex={0}
    >
      <div className={cx('scenario-card-name')} data-testid={scenario.name}>
        <span className="mr-2">
          <span className="selected-mark">
            <CheckCircle variant="fill" size="lg" />
          </span>
          <RiFolderChartLine />
        </span>
        <span className="scenario-card-name-text" title={scenario.name}>
          {scenario.name}
        </span>
        <button
          data-testid="openScenario"
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => navigate(`scenarios/${scenario.id}`)}
        >
          <span className="mr-2">{t('operational-studies-management.open')}</span>
          <FileDirectoryOpen variant="fill" />
        </button>
      </div>
      <div className="scenario-card-description">{scenario.description}</div>

      <div className="scenario-card-tags">
        {scenario.tags &&
          scenario.tags.map((tag) => (
            <div
              className="scenario-card-tags-tag"
              key={tag}
              role="button"
              tabIndex={0}
              onClick={() => setFilterChips(tag)}
              title={tag}
            >
              {tag}
            </div>
          ))}
      </div>
      <div className="scenario-card-footer">
        <div className="scenario-card-infra">
          <img src={infraLogo} alt="infra logo" className="infra-logo" />
          {scenario.infra_name}
        </div>
        <div data-testid="scenario-trains-count" className="scenario-card-trains-count ml-auto">
          <span className="mr-1">
            <MdTrain />
          </span>
          {scenario.trains_count + scenario.paced_trains_count}
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
    </div>
  );
}
