import {
  projectTypes,
  scenarioTypes,
  studyTypes,
} from 'applications/operationalStudies/components/operationalStudiesTypes';

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
  project: projectTypes;
}
export interface MiniCardsStudyProps extends MiniCardsProps {
  study: studyTypes;
}
export interface MiniCardsScenarioProps extends MiniCardsProps {
  scenario: scenarioTypes;
  projectID: number;
  studyID: number;
}

export type MiniCardsImageProps = {
  project: projectTypes;
};
