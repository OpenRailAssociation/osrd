import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');
import('styles/styles.scss');

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};
