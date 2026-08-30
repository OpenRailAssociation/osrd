import { format as formatArgs } from 'node:util';

import { build as runTsdown } from 'tsdown';
import type { Logger as TsdownLogger, TsdownBundle } from 'tsdown';
import type { Plugin, Logger } from 'vite';

function formatWithPrefix(...args: unknown[]): string {
  return `[tsdown-sidecar] ${formatArgs(...args)}`;
}

function pipeToViteLogger(viteLogger: Logger): TsdownLogger {
  return {
    level: 'warn',
    info: (..._args: unknown[]) => {},
    warn: (...args: unknown[]) => viteLogger.warn(formatWithPrefix(...args)),
    warnOnce: (...args: unknown[]) => viteLogger.warnOnce(formatWithPrefix(...args)),
    error: (...args: unknown[]) => viteLogger.error(formatWithPrefix(...args)),
    success: (...args: unknown[]) => viteLogger.info(formatWithPrefix(...args)),
    clearScreen: () => {},
  };
}

declare global {
  var TSDOWN_ALREADY_RUNNING: boolean | undefined;
}

export function tsdownSidecar(): Plugin {
  let watchBundles: TsdownBundle[] = [];
  let logger: TsdownLogger;

  async function startTsdownOnce(isWatching: boolean, customLogger: TsdownLogger): Promise<void> {
    if (globalThis.TSDOWN_ALREADY_RUNNING) return;
    globalThis.TSDOWN_ALREADY_RUNNING = true;

    if (!isWatching) {
      try {
        await runTsdown({
          workspace: true,
          watch: false,
          customLogger,
          report: false,
          logLevel: 'warn',
        });
      } catch (err: unknown) {
        throw new Error(
          `Initial tsdown build failed: ${err instanceof Error ? (err.stack ?? err.message) : err}`
        );
      }
    } else {
      try {
        watchBundles = await runTsdown({
          workspace: ['ui/ui-core', 'ui/ui-charts', 'ui/ui-warped-map', 'ui/ui-icons'],
          configLoader: 'native',
          watch: ['ui/ui-core', 'ui/ui-charts', 'ui/ui-warped-map', 'ui/ui-icons'],
          report: false,
          customLogger,
        });
      } catch (err) {
        customLogger.error(
          `Unable to start watch-mode: ${
            err instanceof Error ? (err.stack ?? err.message) : String(err)
          }`
        );
        watchBundles = [];
      }
    }
  }

  async function stopTsdown(): Promise<void> {
    const bundles = watchBundles;
    watchBundles = [];
    await Promise.all(
      bundles.map(async (bundle) => await bundle?.[Symbol.asyncDispose].call(bundle))
    );
  }

  return {
    name: 'tsdown-sidecar',

    configResolved(config) {
      logger = pipeToViteLogger(config.logger);
    },

    async buildStart() {
      await startTsdownOnce(this.meta.watchMode, logger);
    },

    async closeBundle() {
      if (this.meta.watchMode) return;
      await stopTsdown();
    },

    async closeWatcher() {
      if (!this.meta.watchMode) return;
      await stopTsdown();
    },
  };
}

export default tsdownSidecar;
