export * from './geospatial';

// Notification type
export type Notification = {
  title?: string;
  text: string;
  date?: Date;
  type: 'success' | 'error' | 'warning';
};

//
//  Misc
export type Theme = {
  [key: string]: { [key: string]: string };
};

export declare type PartialButFor<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;
