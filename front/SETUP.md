# Development setup for OSRD's front

## Setting up your editor

A large majority of our contributors uses [VS Code](https://code.visualstudio.com/) and our
development experience is tailored to this IDE, but you should be able to use any common, updated
editor on a daily basis, as long as your configure it accordingly.

Make sure you enable those extensions or the equivalent features in your editor:

- [Oxc extension](https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode), to lint
  your code using `oxlint` and format it using `oxfmt` automatically following our styleguide.

If you are using VSCode and the Oxc extension, make sure this configuration is set in your
workspace settings (`.vscode/settings.json`):

```jsonc
{
  // ...your previous settings...
  "oxc.configPath": "front/.oxlintrc.json",
  "oxc.fmt.configPath": "front/.oxfmtrc.json",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "oxc.oxc-vscode"
}
```

## Running the project

There are two main ways of running OSRD's `front`: either _inside_ of OSRD's Docker Compose system,
or _outside_ of it (while the backend parts are still running inside of it).

### Inside of Docker

A Docker Compose override is provided in `docker/docker-compose.front.yml` to run the frontend in
watch mode together with the rest of the OSRD stack. The `osrd-compose` script can be used to start
OSRD in this mode:

```sh
# in the root of osrd's monorepo, not in front
./osrd-compose dev-front build
./osrd-compose up -d
```

The first time the container starts up, the `osrd-ui` library will be missing. This will trigger some
build errors, which should go away as soon as `osrd-ui` gets built. Restarting the `front` container
helps getting rid of lingering `oxlint` errors.

### Outside of Docker

If for some reason you can't or don't want to use the docker image during development, you can run
the server directly from your development host.

Everything else is still needed, so let's use `osrd-compose` with the `ext-front` flag:

```sh
# in the root of osrd's monorepo, not in front
./osrd-compose ext-front build
./osrd-compose up -d
```

Now that everything else is running, make sure `npm` is installed (from
[nodejs.org](https://nodejs.org/en/download)), then run:

```sh
cd ./front/
npm install
npm run build-ui
npm start -- --host 127.0.0.1
```

Don’t be fooled by Vite’s start message: you should then navigate to http://localhost:4000/ (not `:3000`!)
to open OSRD. It's necessary, as requests to both the backend APIs and our frontend development server
must pass through the `gateway`.

> [!NOTE]
> We use `--host 127.0.0.1` to let Vite know it should also bind to Docker's `bridge`
> network interface, so the `gateway` can proxy the requests accordingly.
