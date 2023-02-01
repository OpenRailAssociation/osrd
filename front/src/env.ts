/* eslint-disable import/prefer-default-export */
declare global {
  interface Window {
    env: Env;
  }
}

type Env = Record<string, string | undefined>;

export const env: Env = { ...process.env, ...window.env };
