# ui-speedspacechart

The `speed-space-chart` is a specialized chart component designed to visualize speed and space data
in a dynamic and interactive way. It leverages modern web technologies to offer a rich user
experience for data analysis and presentation.

## Features

- **Dynamic Visualization**: Offers a comprehensive view of speed and space data over time.
- **Interactive Controls**: Users can interact with the chart to explore different aspects of the
  data.
- **Customizable Appearance**: Supports theming and customization to match different UI
  requirements.
- **High Performance**: Optimized for performance, even with large datasets.

## Usage

To use the `SpeedSpaceChart` component in your project:

```js
import { SpeedSpaceChart } from '@osrd-project/ui-charts';

const App = () => {
  return (
    <SpeedSpaceChart
      width={1440}
      height={460}
      backgroundColor="rgb(247, 246, 238)"
      data={yourData}
      translations={yourTranslations}
    />
  );
};

export default App;
```

## Types

| Field Name           | Type                                              | Description                                                               |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `speeds`             | `LayerData<number>[]`                             | Array with numerical values representing speeds.                          |
| `ecoSpeeds`          | `LayerData<number>[]`                             | Array with numerical values representing eco speeds.                      |
| `stops`              | `LayerData<string>[]`                             | Array with string values representing stops.                              |
| `electrifications`   | `LayerData<ElectrificationValues>[]`              | Array with electrification values.                                        |
| `slopes`             | `LayerData<number>[]`                             | Array with numerical values representing slopes.                          |
| `trainLength`        | `number`                                          | The train length in meters.                                               |
| `electricalProfiles` | `LayerData<ElectricalProfileValues>[]` (optional) | Optional array with electrical profile values.                            |
| `powerRestrictions`  | `LayerData<PowerRestrictionValues>[]` (optional)  | Optional array with power restriction values.                             |
| `speedLimitTags`     | `LayerData<SpeedLimitTagValues>[]` (optional)     | Optional array with speed limit tag values.                               |
| `mrsp`               | `ValuesAlongPath<SpeedLimit>[]` (optional)        | Optional struct with most restricted speed profile values along the path. |

LayerData<T> is a generic type that encapsulates a layer's data, where T is the type of the value
contained in the layer. It is defined as follows:

| Field Name | Type     | Description                                                                           |
| ---------- | -------- | ------------------------------------------------------------------------------------- |
| `position` | `Object` | Object containing start and optionally end numbers representing the layer's position. |
| `value`    | `T`      | The value of the layer, where T can be any of the specific types mentioned above.     |

Specific types for LayerData values:

- `PowerRestrictionValues`
  - `powerRestriction`: string
  - `handled`: boolean

- `ElectricalProfileValues`
  - `electricalProfile`: string
  - `color?`: string (optional)
  - `heightLevel?`: number (optional)

- `SpeedLimitTagValues`
  - `tag`: string
  - `color`: string

- `ElectrificationValues`
  - `type`: 'electrification' | 'neutral_section'
  - `voltage?`: '1500V' | '25000V' (optional)
  - `lowerPantograph?`: boolean (optional)

Make sure to replace yourData and yourTranslations with your actual data and translation objects.

## Adding Translations

The `SpeedSpaceChart` component supports internationalization by allowing you to provide custom
translations for various UI elements. This feature enables you to tailor the chart to different
languages and locales, enhancing the user experience for a global audience.

### Define Your Translations

Create an object that contains key-value pairs for each text string you wish to override. The keys
should match the expected identifiers used by the `SpeedSpaceChart` component, and the values should
be the translated strings.

Example translation object for French:

```js
const yourTranslations = {
  detailsBoxDisplay: {
    reticleInfos: 'Infos Réticule',
    energySource: 'Source d Energie',
    tractionStatus: 'Etat de la traction',
    // Add more keys as needed
  },
  layersDisplay: {
    context: 'Contexte',
    steps: 'Paliers',
    declivities: 'Declivités',
    // Add more keys as needed
  },
};
```

## Visualization

The `ui-speedspacechart` component can be observed and manipulated on Storybook at this address:
[storybook/speedspacechart](https://ui.osrd.fr/?path=/story/speedspacechart-rendering--speed-space-chart-default)

## Contributing

Contributions are welcome! Please refer to the repository's main README.md and CODE_OF_CONDUCT.md
for more details on how to contribute.

## License

This project is licensed under the GNU LESSER GENERAL PUBLIC LICENSE Version 3, 29 June 2007 - see
the LICENSE file for details.
