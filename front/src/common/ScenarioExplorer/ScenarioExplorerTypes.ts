import { ProjectResult, ScenarioListResult, StudyResult } from 'common/api/osrdEditoastApi';

export type ScenarioExplorerProps = {
  globalProjectId?: number;
  globalStudyId?: number;
  globalScenarioId?: number;
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
