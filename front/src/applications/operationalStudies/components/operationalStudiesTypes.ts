/* eslint-disable @typescript-eslint/no-explicit-any */

export type projectTypes = {
  id?: number;
  name: string;
  description: string;
  objectives: string;
  funders: string[];
  tags: string[];
  budget: number;
  image?: Blob | null;
  image_url?: string;
};

export type studyTypes = {
  id?: number;
  name: string;
  type: string;
  description: string;
  service_code: string;
  business_code: string;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  state: string;
  tags: string[];
  budget: number;
};

export type scenarioTypes = {
  id?: number;
  name: string;
  description: string;
  infra: number | undefined;
  tags: string[];
};
