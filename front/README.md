# OSRD's Front

This directory contains the `front` project of OSRD, i.e. the graphical web-based interface. It is
written in [Typescript](https://www.typescriptlang.org/) using [React](https://react.dev/) and
cover all the features of OSRD. It sits on top of `editoast` and is served through our `gateway`.

Note that this directory also contains the [`osrd-ui`](./ui/) project in `ui/` that aims to package
our [own design system and reusable components](https://ui.osrd.fr/).

## Development setup

You can learn how to setup your machine to run the `front` in [`SETUP.md`](./SETUP.md).

## Commands

We defined some commands in `package.json` you can easily run through `npm run`:

- `npm start` runs the app in a local development environment. See [`SETUP.md`](./SETUP.md) to understand how
to run it properly alongside the rest of OSRD's backend components.
- `npm run build` builds the app for production into the `build` folder, ready to be served as static files
by the `gateway`.
- `npm run build-ui` builds the `osrd-ui` packages that are needed to run the `front`.
- `npm run lint` launches our linters to check for formatting and best practices problems in the code. You can fix
most of them automatically with `npm run lint-fix`.
- `npm run test` launches the test runner in the interactive watch mode. Use `npm run test-debug` if you need a more
verbose output from tests.
- `npm run e2e-tests` launches end-to-end tests. See below for more information on how to write and run tests.
- `npm run generate-types` syncs `front` with `editoast`'s endpoints and data types, reading their `openapi.yaml`
and generating our own Typescript file at `./src/common/api/generatedEditoastApi.ts`.
- `npm run i18n-checker` and `npm run i18n-api-errors` check for missing (or redundant) keys in our locales.

## Project architecture

| Name          | Description & links                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------- |
| applications/ | [Main applications](./ARCHITECTURE.md#applications-srcapplications)                               |
| assets/       | Some pictures & osm static mapstyles                                                              |
| common/       | [Common components (applications, maps & design)](./ARCHITECTURE.md#common-components-srccommon)  |
| config/       | Some config files for all project                                                                 |
| main/         | Landing & home pages                                                                              |
| modules/      | Reusable code between applications                                                                |
| reducers/     | Redux store reducers                                                                              |
| store/        | Redux store config                                                                                |
| styles/       | [All SCSS code](./ARCHITECTURE.md#css-srcstyles)                                                  |
| test-data/    | Utilitaries to generate data for tests                                                            |
| types/        | Typescript types configuration                                                                    |
| utils/        | Some common generic helpers                                                                       |
| `i18n.ts`     | [Translation configuration](./ARCHITECTURE.md#translation-publiclocales)                          |
| `index.tsx`   | Entry point of the app                                                                            |

Learn more on how we organize the front's code in our [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Coding style guidelines

We heavily rely on our formatters and linters (`oxfmt` and `oxlint`) to enforce a common style guide
and best practices. You can run `npm run lint` to spot the problems locally; they will be caught anyway
in CI. You can fix some of them automatically using `npm run lint-fix` too.

We also have other (maybe outdated) rules described on [our developer website](https://osrd.fr/en/docs/guides/contribute/contribute-code/frontend-conventions/).

## Writing and running tests

To learn more on how we write tests in the `front` (beside end-to-end tests), head to [`TESTING.md`](./TESTING.md).

To run our end-to-end tests, make sure the [stack is running](./tests/README.md#requirements),
install [Playwright dependencies](./tests/README.md#install-specific-e2e-tests-dependencies) and
[run the tests](./tests/README.md#run-e2e-tests). For more details/tips/troubleshoot/alternatives,
or if you're using a Linux distribution other than Ubuntu or Debian, refer to the
dedicated [README](./tests/README.md).

## Updating dependencies

When `package.json` changes (new packages or updated versions), developers may have issues running
the app with Docker. New packages or versions might not be recognized by Docker.

To fix this, follow these steps:

1. After pulling new changes, run `npm install` to update local dependencies.
2. If issues persist, delete `node_modules` and run `npm install` again.
3. Run `docker compose build --no-cache` to rebuild Docker images from scratch with new
   dependencies.

This ensures developers can run the app with the latest dependencies using Docker.
