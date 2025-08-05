# osrd-ui

Icons, fonts, colors, components and all user interface items for OSRD project.

A [live storybook](https://ui.osrd.fr/) showcases all components.

## Building

To build and start the storybook:

1. Run `cd front/ui` starting from the root directory of the project
2. Run `npm install`
3. Run `npm run build-ui`
4. Run `cd storybook` and `npm start`

While developing on a package, you need to run the following commands to rebuild the package when a
file changes:

1. Run `cd ui-<name-of-the-project>`
2. Run `npm run watch`

## Testing

Some components in `osrd-ui` accept a `testIdPrefix` prop to make automated testing easier.

This prop enables stable data-testid attributes inside the component, useful for E2E (e.g.,
Playwright) or integration tests.

To execute the test suite, run `npm run test`.

## Publishing versions

1. Go to the [new release page](//github.com/OpenRailAssociation/osrd/releases/new).
2. In "Choose a tag", type `ui-vX.Y.Z` and click "Create new tag".
3. In "Previous tag", pick the latest osrd-ui release and click "Generate release notes".
4. In "Release title", type "osrd-ui vX.Y.Z".
5. Trim down the release notes by filtering out OSRD PRs, only keeping ui-\* material. Organize the
   changelog by package and highlight breaking API changes.
6. Untick "Set as latest release".
7. Publish the release.

### Implications

We do not change the version on local package versions, we keep the file to the version `0.0.1-dev`
which is not a real version and can be easily identified as a development version.

The version numbers for our releases are solely managed through git tags. It implies that when we
update a single package, we release all the projects together: even if there are no changes between
two releases (let's say we update ui-icons but nothing else, we would make a release that would
publish all packages anyway).

It's the tradeoff we make to keep the project simple and easy to manage, and to avoid the complexity
of managing multiple compatible versions of the project.

In summary : we consider a version number as being an indivisible release of all the subpackages of
the repository.

### Adding a new package to the monorepo

Create a folder and follow the structure of other packages (refer to the Development section for
more information).

The package will be picked up automatically as long as it is included in the workspaces of the
`package.json` file at the root of the project and that a section is added to the `package.json` in
the package itself:

```jsonc
{
  // ...
  "publishConfig": {
    "access": "public",
  },
  // ...
}
```

If this section is not added, the package will not be published. Having a `"private": true` in the
package.json will also prevent the package from being published.
