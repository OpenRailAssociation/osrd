# OSRD's Front

## How to launch project for development purpose?

### Inside of Docker

A Docker Compose override is provided in `docker/docker-compose.front.yml` to run the frontend in
watch mode together with the rest of the OSRD stack. The osrd-compose script can be used to start
OSRD in this mode:

    ./osrd-compose dev-front build
    ./osrd-compose up -d

The first time the container starts up, the osrd-ui library will be missing. This will trigger some
build errors, which should go away as soon as osrd-ui gets built. Restarting the front container
helps getting rid of lingering ESLint errors.

### Outside of Docker

- go inside `/front/` from OSRD main project
- you'll need [`npm`](https://nodejs.org/en/download/package-manager)
- exec `npm install` (hope you have a good connection and a good cup of tea)
- exec `npm run build-ui`
- exec `npm start` (perhaps you'll need `NODE_OPTIONS="--openssl-legacy-provider"` if your node
  version is too new)
- enjoy

## Commands

### `npm start`

Runs the app in a local development environment.

This requires the other services (api, core, postgres…) to be running in your local environment as
well.

See [Main Readme](../README.md) if you need more information to run the docker.

### `npm run test`

Launches the test runner in the interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.

### `npm run generate-types`

Update endpoints and data-types in /src/common/api/generatedEditoastApi.ts from openapi.yaml

### `npm run generate-licenses`

Update licenses attributions in /src/common/ReleaseInformations/json/

### `npm run e2e-tests`

Launches end to end tests.

It requires:

- Install Playwright dependencies `cd ./front/ && npx playwright install --with-deps`
- Backend containers to be up with authorization disabled:

  `docker compose up --no-build --detach valkey postgres gateway core editoast`

- Running front with `docker compose up --build --detach front`

Now you can run the test with `cd front/ && npm run e2e-tests`.

If you are using a Linux distribution not supported by Playwright (Playwright only supports Windows,
macOS and Ubuntu/Debian), you can start the tests inside a Docker container.

First start the playwright container using `./osrd-compose playwright up playwright`. You can also
start all back and front containers at the same time as the playwright container, for example using
`./osrd-compose playwright dev-front up`.

Then you can run the tests using `osrd/scripts/run-front-playwright-container.sh`. This script
accepts the same options and arguments as `npm run e2e-tests` or `npx playwright test`.

> [!CAUTION]
> If you try to run `npm run start` instead of running it through docker, you'll notice
> it doesn't work because the gateway can't access your local port from inside a container. 2
> solutions:
>
> - Run all the components locally (you might keep Postgres and Valkey in containers)
> - If on Linux, you can also launch all the containers on the host network: you can replace the
>   `docker compose <something>` above with `osrd/osrd-compose host <something>`

If the tests fail, a `front/test-results` folder will be created, containing videos and traces of
the failed test executions. These files can help you understand what went wrong. Additionally, the
CI system exports these videos and traces as artifacts. You can view the trace files using the
[Playwright trace viewer](https://trace.playwright.dev/).

If visual comparisons tests fail due to UI changes, new snapshots are required as the baseline. You
can automatically update snapshots by running tests with the `--update-snapshots` flag:
`npx playwright test --update-snapshots`.

You may also want to explore [Playwright documentation](https://playwright.dev/docs/intro) for more
insights. For example: Launch each test independently using: `npx playwright test --ui`. Debug a
test with: `npx playwright test --debug`. Run a specific test in a specific test file with a
specific browser and no retries using:
`npx playwright test 011-op-times-and-stops-tab.spec.ts -g "should correctly set and display times and stops tables" --project=firefox  --retries=0`.

## Design rules

OSRD's front is based upon [SNCF Bootstrap](https://designmetier-bootstrap.sncf.fr/). It aims to
follow SNCF's design system guidelines, although the style has deviated quite a bit due to
components requiring a specific design.

# Code organization, folders structure & modules descriptions

| Name          | Description & links                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------- |
| applications/ | Main applications ([see below](#applications-srcapplications))                                    |
| assets/       | Some pictures & osm static mapstyles                                                              |
| common/       | Common components (applications, map layers & design) ([see below](#common-components-srccommon)) |
| config/       | Some config files for all project                                                                 |
| `env.ts`      | Backend urls                                                                                      |
| `i18n.js`     | Translation configuration ([see below](#translation-publiclocales))                               |
| `index.tsx`   | Obvious, no ?                                                                                     |
| main/         | Landing & home pages                                                                              |
| reducers/     | Redux store                                                                                       |
| `Store.ts`    | Redux store config                                                                                |
| styles/       | All SCSS code ([see below](#css-srcstyles))                                                       |
| types/        | Typescript types configuration                                                                    |
| utils/        | Some common generic helpers                                                                       |

## Homepage `/src/main`

Landing is done in `/main` where we can find `app.js` for routing purpose and `home.js` as homepage
with cards linking to different applications.

OSRD's front is organized in 5 main `applications/`.

## Applications `/src/applications`

All applications are contained in a single folder, have a `home` JS/TS file and views & components
organized in folders.

**The components propose the main JS/TS file and eventually another folder with same name containing
some minor subcomponents linked to.**

- components/
- views/
- [editor/](#infrastructure-editor-editor)
  - components/
- [opendata/](#opendata-importation-opendata)
  - components/
  - views/
- [operationalStudies/](#operational-studies-operationalstudies)
  - components/
  - views/
- [referenceMap/](#reference-map-referencemap)
- [stdcm/](#short-term-dcm-stdcm)
  - views/

### Operational Studies `operationalStudies/`

The operational studies application enables capacity studies to be carried out on a given
infrastructure.

#### Folder's tree

- **components/**
  - **Helpers/**
  - **ManageTimetableItem/**
  - **Project/**
  - **Scenario/**
  - **SimulationResults/**
  - **Study/**
- consts.ts
- Home.tsx
- **views/**
  - ManageTimetableItem.jsx
  - Project.js
  - Scenario.js
  - SimulationResults.tsx
  - Study.js

The functional workflow works as follows:

- create a project `applications/operationalStudies/Home.js`
- create a study in this project `applications/operationalStudies/views/Project.js`
- choose an infrastructure to create a scenario in the study
  `applications/operationalStudies/views/Study.js`

Once in a scenario `applications/operationalStudies/views/Scenario.js` you have to add trains in the
timetable `applications/operationalStudies/views/ManageTimetableItem.jsx`. To do so:

- choose an infrastructure & timetable _DEPRECATED: will be removed soon_
- choose a rolling stock `common/rollingStockSelector` and a composition code
- define a path on the map with crossing points (the path takes into account the restrictions of the
  material and the infrastructure)
- determine possible margins
- choose the number of trains to add

Then, the simulation results `applications/operationalStudies/SimulationResults` appear as (top to
bottom):

- The details of the current train and a module for controlling the time cursor
- A fixed width timeline to explore the whole study
- A space-time graph displaying all the trains projected on a given path
- The space-speed graph of the selected train
- The graph of curves and gradients of the selected train
- The train sheet of the selected train
- The map showing the route, the position of the trains in time and space, and the status of the
  signaling with the current block occupation

### Short-term DCM `stdcm/`

STDCM makes it possible to find paths through the residual capacity of a timetable, without
conflicts.

### Infrastructure editor `editor/`

OSRD's infrastructure editor allows you to edit the linear and point objects of a given
infrastructure, and then run simulations based on this information. It is possible to modify the
existing infrastructure as well as to create a new one.

### Opendata importation `opendata/`

_EXPERIMENTATION_ This application uses opendata from [GRAOU](https://carto.graou.info) to create
realistic timetable from [french GTFS data by SNCF](https://data.sncf.com).

### Reference map `referenceMap/`

This is an implementation reference for all map concerns. It aims to display all layers and propose
a ready-to-use map component reference. When adding a new common layer inside an application map
component, please add it first to this application.

## Common components `/src/common`

All common code (and shared components) supposed to be in `common/`.

## CSS `/src/styles`

## Translation `/public/locales`

Any translation key used in the code must at least be present in `/public/locales/en` and
`/public/locales/fr`, other languages are work in progress. You can use
`npm run-script i18n-checker.ts` to see a complete list of unused and missing French and English
keys. You can use `./scripts/i18n-order-checker.sh --fix` to automatically sort translation keys.

# Other

## Coding style Policy

### Javascript / Javascript-React

### Javascript / Javascript-React

- ESLint is used as linter and prettier as formatter. Both are configured as devDependencies to
  enforce default eslint configuration eventually overridden by
  [airbnb rules](https://airbnb.io/javascript/) translation. A few rules (see eslintrc) has been
  disabled and will be re-enabled in the near future:
  - 'no-named-as-default': 'off',
  - 'react/jsx-props-no-spreading': 0,
  - 'react/static-property-placement': 0,
- eslint rules incompatible with prettier usage are disabled, yet these styling errors will be
  displayed as prettier issues.
- Do not set your IDE to auto format with current prettier rules for now, as some old files will be
  widely updated and less readable for reviewers.
- Please push commits exclusively dedicated to styling issues
- _For VSCode Users_: Install
  [Prettier - Code Formatter Extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
  and follow instructions.

You may also use `npm run lint-fix` to format/lint.

## Dependencies

### Cross project

- [i18n](https://www.i18next.com/) internationalization framework for javascript. Please keep it
  simple.
- [nivo](https://nivo.rocks/) Dataviz lib built on top of d3 and react. For certain generic viz.
  Could be used as a basis to render our special viz more adapted to react & d3- packages
  nivo/circle-packing and nivo/line
- [turf.js](https:/turf.js) Javascript geospatial and analysis. Imported on a per-package basis
- [react-rnd](https://github.com/bokuweb/react-rnd) Excellent container for resizable - movable
  visual component
- immer - simplified immutable state control

### Editor module

- https://www.npmjs.com/package/@rjsf/core
- https://www.npmjs.com/package/reselect

### devDependencies

- Better docs: still in use ? with
- jsdocs

### Updating Dependencies

When `package.json` changes (new packages or updated versions), developers may have issues running
the app with Docker. New packages or versions might not be recognized by Docker.

To fix this, follow these steps:

1. After pulling new changes, run `npm install` to update local dependencies.
2. If issues persist, delete `node_modules` and run `npm install` again.
3. Run `docker compose build --no-cache` to rebuild Docker images from scratch with new

   dependencies.

This ensures developers can run the app with the latest dependencies using Docker.
