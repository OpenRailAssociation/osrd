import { LAYER_VARIABLES } from 'common/Map/const';

export default function convertLayerVariables(data) {
  return Object.entries(data).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [LAYER_VARIABLES[key] || key]: value.toString(),
    }),
    {},
  );
}
