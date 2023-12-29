import {
  ProjectWithStudies,
  StudyWithScenarios,
  ScenarioWithCountTrains,
} from 'common/api/osrdEditoastApi';

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
  project: ProjectWithStudies;
}
export interface MiniCardsStudyProps extends MiniCardsProps {
  study: StudyWithScenarios;
}
export interface MiniCardsScenarioProps extends MiniCardsProps {
  scenario: ScenarioWithCountTrains;
  projectID: number;
  studyID: number;
}

export type MiniCardsImageProps = {
  project: ProjectWithStudies;
};
