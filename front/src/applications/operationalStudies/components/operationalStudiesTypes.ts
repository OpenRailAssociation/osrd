/* eslint-disable @typescript-eslint/no-explicit-any */

export type projectTypes = {
  id?: number;
  name: string;
  description: string;
  objectives: string;
  funders: string;
  tags: string[];
  budget: number;
  image?: Blob | null | number;
  image_url?: string;
  studies_count: number;
  currentImage?: Blob | null;
};

export type studyTypes = {
  id?: number;
  name: string;
  study_type: string;
  description: string;
  service_code: string;
  business_code: string;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  state: string;
  tags: string[];
  budget: number;
  scenarios_count: number;
};

export type scenarioTypes = {
  id?: number;
  name: string;
  description: string;
  infra_id?: number;
  infra_name?: string;
  electrical_profile_set_name?: string;
  timetable_id?: number;
  electrical_profile_set_id?: number;
  tags: string[];
};
