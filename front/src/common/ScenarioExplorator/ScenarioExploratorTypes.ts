import { ProjectResult, ScenarioListResult, StudyResult } from 'common/api/osrdEditoastApi';

export type FilterParams = {
  name?: string;
  description?: string;
  tags?: string;
  ordering?: string;
};

type MiniCardsProps = {
  isSelected?: boolean;
  setSelectedID: (arg0?: number) => void;
};

export interface MiniCardsProjectProps extends MiniCardsProps {
  project: ProjectResult;
}
export interface MiniCardsStudyProps extends MiniCardsProps {
  study: StudyResult;
}
export interface MiniCardsScenarioProps extends MiniCardsProps {
  scenario: ScenarioListResult;
  projectID: number;
  studyID: number;
}

export type MiniCardsImageProps = {
  project: ProjectResult;
};
