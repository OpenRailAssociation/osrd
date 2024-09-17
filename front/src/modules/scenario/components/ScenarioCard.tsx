import { Calendar, CheckCircle, FileDirectoryOpen } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { MdTrain } from 'react-icons/md';
import { RiFolderChartLine } from 'react-icons/ri';
import nextId from 'react-id-generator';
import { useNavigate } from 'react-router-dom';

import infraLogo from 'assets/pictures/components/tracks.svg';
import type { ScenarioWithDetails } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import { updateTrainIdUsedForProjection } from 'reducers/osrdsimulation';
import { useAppDispatch } from 'store';
import { dateTimeFormatting } from 'utils/date';

type ScenarioCardProps = {
  setFilterChips: (filterChips: string) => void;
  scenario: ScenarioWithDetails;
  isSelected: boolean;
  toggleSelect: (id: number) => void;
};

export default function ScenarioCard({
  setFilterChips,
  scenario,
  isSelected,
  toggleSelect,
}: ScenarioCardProps) {
  const { t } = useTranslation('operationalStudies/study');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { updateScenarioID } = useOsrdConfActions();

  const handleClick = () => {
    dispatch(updateScenarioID(scenario.id));
    dispatch(updateTrainIdUsedForProjection(undefined));
    navigate(`scenarios/${scenario.id}`);
  };

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
          onClick={handleClick}
        >
          <span className="mr-2">{t('openScenario')}</span>
          <FileDirectoryOpen variant="fill" />
        </button>
      </div>
      <div className="scenario-card-description">{scenario.description}</div>

      <div className="scenario-card-tags">
        {scenario.tags &&
          scenario.tags.map((tag) => (
            <div
              className="scenario-card-tags-tag"
              key={nextId()}
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
        <div className="scenario-card-trains-count ml-auto">
          <span className="mr-1">
            <MdTrain />
          </span>
          {scenario.trains_count}
        </div>
        <div className="scenario-card-date">
          <span className="mr-1">
            <Calendar />
          </span>
          <span className="mr-1">{t('updatedOn')}</span>
          {scenario.last_modification && dateTimeFormatting(new Date(scenario.last_modification))}
        </div>
      </div>
    </div>
  );
}
