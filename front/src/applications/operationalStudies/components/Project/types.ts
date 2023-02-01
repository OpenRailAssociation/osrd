/* eslint-disable @typescript-eslint/no-explicit-any */

export type configItemsTypes = {
  id?: number;
  name: string;
  description: string;
  objectives: string;
  funders: string[];
  tags: string[];
  budget: number;
  image?: Blob;
  image_url?: string;
};
