// This shim is necessary as of react-tether@3.0.1, as this module do not
// export their types properly in package.json (i.e. not inside a "types"
// in "exports"). It should be removed as soon as react-tether is not
// necessary anymore.

declare module 'react-tether' {
  /// <reference path="../node-modules/react-tether/lib/react-tether.d.ts" />

  export default TetherComponent;
}
