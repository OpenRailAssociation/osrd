# Overrides

In order to configure the app, you can provide a json `overrides.json` file located in [`front/public/overrides/`](.).

This contains both settings aimed at deployment in production, such as custom module names and logos, as well as generally useful settings even when developing locally, such as the railway manager interface url.

Please consult the `Overrides` typescript type in [useDeploymentSettings.tsx](../../src/utils/hooks/useDeploymentSettings.tsx) for a full list of available settings, as well as their expected structure.

Each top level field of `overrides.json`, as well as the file itself, are entirely optional. Some features, such as the railway manager interface, may however be disabled by default.
