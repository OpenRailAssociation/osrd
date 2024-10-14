# OSRD's Front

## How to launch project for development purpose?

- go inside `/front/` from OSRD main project
- you'll need [`npm`](https://nodejs.org/en/download/package-manager) and
  [`yarn`](https://classic.yarnpkg.com/lang/en/docs/install/)
- exec `yarn` (hope you have a good connexion and a good cup of tea)
- exec `yarn start` (perhaps you'll need `NODE_OPTIONS="--openssl-legacy-provider"` if your node
  version is too new)
- enjoy

## Commands

### `yarn start`

Runs the app in a local development environment.

This requires the other services (api, core, postgres…) to be running in your local environment as
well.

See [Main Readme](../README.md) if you need more information to run the docker.

### `yarn test`

Launches the test runner in the interactive watch mode.

### `yarn build`

Builds the app for production to the `build` folder.

### `yarn generate-licenses`

Update licenses attributions in /src/common/ReleaseInformations/json/

### `yarn e2e-tests`

Launches end to end tests.

It requires:

- Install playwright dependencies `cd ./front/ && yarn playwright install --with-deps`
- Backend containers to be up: `docker compose up --no-build --detach valkey postgres gateway core editoast`
- Running front with `docker compose up --build --detach front`

Now you can run the test with `cd front/ && yarn e2e-tests`.

> [!CAUTION]
> If you try to run `yarn start` instead of running it through docker, you'll notice it doesn't
> work because the gateway can't access your local port from inside a container. 2 solutions:
>
> - run all the components locally (you might keep Postgres and Valkey in containers)
> - if on Linux, you can also launch all the containers on the host network: you can replace the
> `docker compose <something>` above with `osrd/scripts/osrd-compose.sh <something>`

If the tests fail, you'll find a `front/test-results` folder that will contain videos of the fail
test executions. They might be of help to understand what's going on. Note that the CI also exports
these videos as artifacts.

You may also want to explore the documentation of the test framework [Playwright](https://playwright.dev/).
For example, try launching each test independently using `yarn playwright test --ui`, or debug a
test with `yarn playwright test --debug`.

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
  - **ManageTrainSchedule/**
  - **Project/**
  - **Scenario/**
  - **SimulationResults/**
  - **Study/**
- consts.ts
- Home.tsx
- **views/**
  - ManageTrainSchedule.jsx
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
timetable `applications/operationalStudies/views/ManageTrainSchedule.jsx`. To do so:

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

# Other

## Coding style Policy

### Javascript / Javascript-React

- ESLint is used as linter and prettier as formatter. Both are configured as devDependencies to
  enforce default eslint configuration eventually overidden by
  [airbnb rules](https://airbnb.io/javascript/) translation. A few rules (see eslintrc) has
  been disabled and will be re-enabled in the near future):
  - 'no-named-as-default': 'off',
  - 'react/jsx-props-no-spreading': 0,
  - 'react/static-property-placement': 0,
  - 'import/no-extraneous-dependencies': 0,
- eslint rules incompatible with prettier usage are disabled, yet these styling errors will be
  displayed as prettier issues.
- Do not set your IDE to auto format with current prettier rules for now, as some old files will be
  widely updated and less readable for reviewers.
- Please push commits exclusively dedicated to styling issues
- _For VSCode Users_: Install
  [Prettier - Code Formatter Extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
  and follow instructions.

You may also use `yarn lint-fix` to format/lint.

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
When `package.json` changes (new packages or updated versions), developers may have issues running the app with Docker. New packages or versions might not be recognized by Docker.

To fix this, follow these steps:

1. After pulling new changes, run `yarn install` to update local dependencies.
2. If issues persist, delete `node_modules` and run `yarn install` again.
3. Run `docker compose build --no-cache` to rebuild Docker images from scratch with new dependencies.

This ensures developers can run the app with the latest dependencies using Docker.
