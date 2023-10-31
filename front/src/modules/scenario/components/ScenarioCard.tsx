import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RiFolderChartLine } from 'react-icons/ri';
import infraLogo from 'assets/pictures/components/tracks.svg';
import { AiFillFolderOpen } from 'react-icons/ai';
import { dateTimeFrenchFormatting } from 'utils/date';
import { useDispatch } from 'react-redux';
import { updateScenarioID } from 'reducers/osrdconf';
import { updateSelectedProjection } from 'reducers/osrdsimulation/actions';
import { FcCalendar } from 'react-icons/fc';
import { MdTrain } from 'react-icons/md';
import nextId from 'react-id-generator';
import { ScenarioWithCountTrains } from 'common/api/osrdEditoastApi';

type Props = {
  setFilterChips: (filterChips: string) => void;
  scenario: ScenarioWithCountTrains;
};

export default function StudyCard({ setFilterChips, scenario }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleClick = () => {
    dispatch(updateScenarioID(scenario.id));
    dispatch(updateSelectedProjection(undefined));
    navigate(`scenarios/${scenario.id}`);
  };

  return (
    <div className="scenario-card">
      <div className="scenario-card-name" data-testid={scenario.name}>
        <span className="mr-2">
          <RiFolderChartLine />
        </span>
        {scenario.name}
        <button
          data-testid="openScenario"
          className="btn btn-sm"
          type="button"
          onClick={handleClick}
        >
          <span className="mr-2">{t('openScenario')}</span>
          <AiFillFolderOpen />
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
            >
              {tag}
            </div>
          ))}
      </div>
      <div className="scenario-card-footer">
        <div className="scenario-card-infra">
          <img src={infraLogo} alt="infra logo" />
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
            <FcCalendar />
          </span>
          <span className="mr-1">{t('updatedOn')}</span>
          {scenario.last_modification &&
            dateTimeFrenchFormatting(new Date(scenario.last_modification))}
        </div>
      </div>
    </div>
  );
}
