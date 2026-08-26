# Project architecture of OSRD's front

> [!WARNING]
> This is a somewhat outdated description on how the code is sorted in the app, pending a potential
> folders structure change and code reorganization.

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
  - ManageTrainSchedule.tsx
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
timetable `applications/operationalStudies/views/ManageTrainSchedule.tsx`. To do so:

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
