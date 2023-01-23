# OSRD's Front

[![Front](https://github.com/DGEXSolutions/osrd/actions/workflows/front.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/front.yml)

## How to launch project for developpement purpose ?
- go inside `/front/` from OSRD main project
- exec `yarn` (hope you have a good connexion and a good cup of tea)
- exec `yarn start` (perhaps you'll need `NODE_OPTIONS="--openssl-legacy-provider"` if your node version is too new)
- enjoy

To connect to online backend, you can use `yarn start-osrd-dev` instead `yarn start`.

For more informations, [see below](#running-the-app).

## Design rules
OSRD's front is based upon [SNCF Bootstrap](https://designmetier-bootstrap.sncf.fr/). It aims to follow SNCF's design system guidelines, although the style has deviated quite a bit due to components requiring a specific design.

# Code organization, folders structure & modules descriptions

| Name           | Description & links                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------- |
| applications/  | Main applications ([see below](#applications-srcapplications)) |
| assets/        | Some pictures & osm static mapstyles |
| common/        | Common components (applications, map layers & design) ([see below](#common-components-srccommon)) |
| config/        | Some config files for all project |
| `env.ts`       | Backend urls |
| `i18n.js`      | Translation configuration ([see below](#translation-publiclocales)) |
| `index.tsx`    | Obvious, no ? |
| keycloak/      | Config files for SNCF FID authentication |
| main/          | Landing & home pages |
| reducers/      | Redux store |
| `Store.ts`     | Redux store config |
| stories/       | Storybook files |
| styles/        | All SCSS code ([see below](#css-srcstyles)) |
| types/         | Typescript types configuration |
| utils/         | Some common generic helpers |

## Homepage `/src/main`
Landing is done in `/main` where we can find `app.js` for routing purpose and `home.js` as homepage with cards linking to differents applications.

OSRD's front is organized in 5 main `applications/`.

## Applications `/src/applications`

All applications are contained in a single folder, have a `home` JS/TS file and views & components organized in folders.

**The components propose the main JS/TS file and eventually another folder with same name containing some minors subcomponents linked to.**

- [customget/](#isolated-space-time-chart-for-research-needs-customget)
  * components/
  * views/
- [editor/](#infrastructure-editor-editor)
  * components/
- [opendata/](#opendata-importation-opendata)
  * components/
  * views/
- [operationalStudies/](#operational-studies-operationalstudies)
  * components/
  * views/
- [referenceMap/](#reference-map-referencemap)
- [stdcm/](#short-term-dcm-stdcm)
  * views/

### Operational Studies `operationalStudies/`

The operational studies application enables capacity studies to be carried out on a given infrastructure.

#### Folder's tree
- **components/**
  * **Helpers/**
  * **HomeContent/**
  * **ManageTrainSchedule/**
  * **Project/**
  * **Scenario/**
  * **SimulationResults/**
  * **Study/**
  * **TimetableSelector/**
- consts.ts
- Home.tsx
- **views/**
  * HomeContent.js
  * ManageTrainSchedule.jsx
  * Project.js
  * Scenario.js
  * SimulationResults.tsx
  * Study.js

The functional workflow works as follows:
- create a project `applications/operationalStudies/views/HomeContent.js`
- create a study in this project `applications/operationalStudies/views/Project.js`
- choose an infrastructure to create a scenario in the study `applications/operationalStudies/views/Study.js`

Once in a scenario `applications/operationalStudies/views/Scenario.js` you have to add trains in the timetable `applications/operationalStudies/views/ManageTrainSchedule.jsx`.
To do so:
- choose an infrastructure & timetable *DEPRECATED: will be removed soon*
- choose a rolling stock `common/rollingStockSelector` and a composition code
- define a path on the map with crossing points (the path takes into account the restrictions of the material and the infrastructure)
- determine possible margins
- choose the number of trains to add

Then, the simulation results `applications/operationalStudies/SimulationResults` appear as (top to bottom):
- The details of the current train and a module for controlling the time cursor
- A fixed width timeline to explore the whole study
- A space-time graph displaying all the trains projected on a given path
- The space-speed graph of the selected train
- The graph of curves and gradients of the selected train
- The train sheet of the selected train
- The map showing the route, the position of the trains in time and space, and the status of the signaling with the current block occupation

### Short-term DCM `stdcm/`
STDCM makes it possible to find paths through the residual capacity of a timetable, without conflicts.

### Infrastructure editor `editor/`
OSRD's infrastructure editor allows you to edit the linear and point objects of a given infrastructure, and then run simulations based on this information.
It is possible to modify the existing infrastructure as well as to create a new one.

### Opendata importation `opendata/`
*EXPERIMENTATION*
This application uses opendata from [GRAOU](https://carto.graou.info) to create realistic timetable from [french GTFS data by SNCF](https://data.sncf.com).
### Reference map `referenceMap/`
This is an implementation reference for all map concerns. It aims to display all layers and propose a ready-to-use map component reference.
When adding a new common layer inside an application map component, please add it first to this application.

### Isolated space-time chart for research needs `customGET/`
*EXPERIMENTATION*
This application, which is not intended to remain as is, is a space-time graph fed by external data, to be used for thesis work on optimization.

## Common components `/src/common`
All common code (and shared components) supposed to be in `common/`.
## CSS `/src/styles`

## Translation `/public/locales`

# Other
## Coding style Policy

### Javascript / Javascript-React

* ESLint is used as linter and prettier as formatter. Both are configured as devDependencies to enforce default eslint configuration eventually overidden by [airbnb rules](https://https://airbnb.io/javascript/) translation. A few rules (see eslintrc) has been disabled and will be re-enabled in the near future):
   * 'no-named-as-default': 'off',
   * 'react/jsx-props-no-spreading': 0,
   * 'react/static-property-placement': 0,
   * 'import/no-extraneous-dependencies': 0,
* eslint rules incompatible with prettier usage are disabled, yet these styling errors will be displayed as prettier issues.
* Do not set your IDE to auto format with current prettier rules for now, as some old files will be widely updated and less readable for reviewers.
* Please push commits exclusively dedicated to styling issues
* _For VSCode Users_: Install [Prettier - Code Formatter Extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and follow instructions.

## Dependencies

### Cross project
* [i18n](https://www.i18next.com/) internationalization framework for javascript. Please keep it simple.
* [nivo](https://nivo.rocks/) Dataviz lib built on top of d3 and react. For certain generic viz. Could be used as a basis to render our special viz more adapted to react & d3- packages nivo/circle-packing and nivo/line
* [turf.js](https:/turf.js) Javascript geospatial and analysis. Imported on a per-package basis
* [react-rnd](https://github.com/bokuweb/react-rnd) Excellent container for resizable - movable visual component
* immer - simplified immutable state control

### Editor module

* https://www.npmjs.com/package/@rjsf/core
* https://www.npmjs.com/package/reselect
* https://github.com/reduxjs/redux-thunk

### Do not know where it is used

* debounce
* jwt-decode

### devDependencies

* Better docs: still in use ? with
* jsdocs


### Module editor

# Running the app

### `yarn start`

Runs the app in a local development environment. <br />
This requires the other services (api, core, postgres…) to be running in your local environment as well.

See [Main Readme](../README.md) if you need more information to run the docker.

### `yarn start-osrd-dev`

Runs the app in a local environment, using osrd.dev.dgexsol backend services.

### `yarn test`

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `yarn build`

Builds the app for production to the `build` folder.<br />
