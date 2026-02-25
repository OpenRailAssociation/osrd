# OSRD's Front

## How to launch project for development purpose?

### Inside of Docker

A Docker Compose override is provided in `docker/docker-compose.front.yml` to run the frontend in
watch mode together with the rest of the OSRD stack. The osrd-compose script can be used to start
OSRD in this mode:

```sh
./osrd-compose dev-front build
./osrd-compose up -d
```

The first time the container starts up, the osrd-ui library will be missing. This will trigger some
build errors, which should go away as soon as osrd-ui gets built. Restarting the front container
helps getting rid of lingering ESLint errors.

### Outside of Docker

If for some reason you can't or don't want to use the docker image during development, you can run
the server directly from your development host.

Everything else is still needed, so let's use `osrd-compose` with the `ext-front` flag:

```sh
./osrd-compose ext-front build
./osrd-compose up -d
```

Make sure `npm` is [installed](https://nodejs.org/en/download), then run:

```sh
cd ./front/
npm install
npm run build-ui
npm start -- --host 127.0.0.1
```

Don’t be fooled by Vite’s start message: you should then navigate to http://localhost:4000/ (not `:3000`!)
to open OSRD, as requests must pass through the `gateway`.

> [!NOTE]
> We use `--host 127.0.0.1` to let Vite know it should also bind to Docker's `bridge`
> network interface, so the `gateway` can proxy the requests accordingly.

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

### `npm run e2e-tests`

Launches end to end tests.

It requires:

- Ensure the [stack is running](./tests/README.md#requirements)
- Install [Playwright dependencies](./tests/README.md#install-specific-e2e-tests-dependencies)
- Then [run the tests](./tests/README.md#run-e2e-tests)

For more details/tips/troubleshoot/alternatives, or if you're using a Linux distribution other than Ubuntu or
Debian, refer to the dedicated [README](./tests/README.md).

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
`npm run i18n-checker` to see a complete list of unused and missing French and English
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
