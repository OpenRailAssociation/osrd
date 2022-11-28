import '../src/applications/osrd/views/OSRDSimulation/OSRDSimulation.scss';
import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');
export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
}
