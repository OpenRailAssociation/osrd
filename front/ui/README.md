# osrd-ui

Icons, fonts, colors, components and all user interface items for OSRD project.

A [live storybook](https://openrailassociation.github.io/osrd-ui/) showcases all components.

## Development

Development will leverage preconstruct. **Documentation yet to come**.

## Publishing versions

In a nutshell: we consider our version numbers metadata of the project. We use
[Semantic Versioning](https://semver.org/).

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

### Making a release

1. Create a annotated git tag (let's say `0.0.30`, you would do a `git tag -a 0.0.30`) on the `dev`
   branch and push (here it would be `git push origin tag 0.0.30`).
   **Note: we do not tag with a V in front of the version number, on our example
   the tag would be 0.0.30 and not v0.0.30**.
2. Create a github release (By convention, we use the same name as the tag with the letter `v` in
   front of it, `v0.0.30`. You can give fancy names to release if you want to :
   `0.0.30 : Camembert`, it will only appear in the release page of GitHub).

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

# Build Instructions

1. Run `npm install`
2. Run `npm run build`
3. Run `npm run storybook`

While developing on a project, you need to run the following commands to see the css modifications:

1. Run `cd ui-<name-of-the-project>`
2. Run `npm run watch`

# Tests

1. Run `npm run test`
