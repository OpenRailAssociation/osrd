import("@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css");
import { withPerformance } from 'storybook-addon-performance';

export const decorators = [withPerformance];

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
}
