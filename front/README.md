# OSRD's Front

[![Front](https://github.com/DGEXSolutions/osrd/actions/workflows/front.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/front.yml)

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

### Module osrdsimulation

* [nivo](https://nivo.rocks/) Dataviz lib built on top of d3 and react. For certain generic viz. Could be used as a basis to render our special viz more adapted to react & d3- packages nivo/circle-packing and nivo/line
* [turf.js](https:/turf.js) Javascript geospatial and analysis. Imported on a per-package basis
* [react-rnd](https://github.com/bokuweb/react-rnd) Excellent container for resizable - movable visual component
* immer - simplified immutable state control

### Module editor

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
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `yarn eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (Webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: https://facebook.github.io/create-react-app/docs/code-splitting

### Analyzing the Bundle Size

This section has moved here: https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size

### Making a Progressive Web App

This section has moved here: https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app

### Advanced Configuration

This section has moved here: https://facebook.github.io/create-react-app/docs/advanced-configuration

### Deployment

This section has moved here: https://facebook.github.io/create-react-app/docs/deployment

### `yarn build` fails to minify

This section has moved here: https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify
