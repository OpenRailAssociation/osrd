# Best practices and guidelines for OSRD's front

OSRD's `front` codebase is a big repository that emcompass a lot of code written by a team of contributors. To make sure we can always be proud of our work, we decided to follow a few best practices that we ask all contributors to follow.

Most of them are not written here but are _encoded as lint rules_ (in `oxfmt`, `oxlint`, `stylelint` or other plugins or scripts we run in CI). It's easier for you as a contributor to follow rules that your editor or the CI can remind you of them directly!

However, some guidelines are too vague, to "human"-based to be encoded into lints, so this file aims to list them all. Please read and follow those practices, and moreover, please raise issues if you find them outdated or out of the line with what is done elsewhere.

## About our code organization

We have a few opiniated ideas about how and where we should write code in the `front` directory.

### Respect how we organize files

Please read the [ARCHITECTURE.md](./ARCHITECTURE.md) file to understand where and how files are created in the `src` directory.

In a nutshell, most of the code is placed in the `apps/<name of app>/<name of module>/` directory, unless it's reused between multiple apps. You don't have to create directories like `hooks` or `components` as it should be clear by the file name that they are either hooks or components. You can fold all the styles of your module into a `styles` if there multiple

### Do not repeat yourself across the app

Before reimplementing a utility function, take a few minutes to try to find if it already exists somewhere else in the app, and if it can be "lifted" to a common directory (either in `entities/` or in `utils/`).

However, don't overengineer your code to be too generic if you don't know yet if it will be used in another app or in another context.

### ...

·
·
·

## About our Typescript and React code

Most of the code of the `front` is made in Typescript, and uses modern React code. We try to follow React best practices (and lint accordingly our codebase).

### Prefer small, clear Contexts to prop drilling or global stores

Stores can be great tools in a few cases, but we prefer some short, clearly defined `Context` objects that only carries a few relevant fields instead of big, sliced stores.

### Don't call useEffect if you can avoid it

### Use Suspense instead of reimplementing it

### Add (at least) a few lines of description on all hooks and on key helpers or components

## About our stylesheets

