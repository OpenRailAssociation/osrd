import {
  readFileSync,
  readdirSync,
  existsSync,
  unlinkSync,
  writeFileSync,
  appendFileSync,
} from 'fs';
import { join } from 'path';

import { load } from 'cheerio';

/**
 * Ggenerating React components from SVG files. Designed to work with a specific directory structure where SVG files are organized by name, variant, and size.
 *
 * Key functionalities:
 * - Parses SVG file names to extract metadata (icon name, variant, size).
 * - Validates SVG files for required attributes (width, height, viewBox) and extracts the SVG path.
 * - Builds an object representation of all icons from the SVG files.
 * - Generates a 'sizes.ts' file mapping numeric sizes to their respective designations.
 * - Creates individual React component files for each icon, ensuring they are properly typed and exportable.
 * - Updates or creates an index file to export all the generated components for easy import in other parts of a project.
 */
export default function svgToReact(
  iconsDir: string,
  srcDir: string,
  variantKeywords = ['fill'],
  reversed = { '16': 'sm', '24': 'lg' }
) {
  // Function to extract metadata (name, variant, size) from the SVG file name
  const extractMetadataFromFilename = (fileName: string) => {
    const split = fileName.split('.')[0].split('-');

    const size = split.slice(-1)[0];

    let variant = 'base';
    let name = split
      .slice(0, -1)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    // Check if variant is present
    if (variantKeywords.includes(split.slice(-2)[0])) {
      variant = split.slice(-2)[0];
      name = split
        .slice(0, -2)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
    }

    return [name, variant, size, fileName];
  };

  // Function to validate the SVG file structure and extract the SVG path
  const validateSvgAndExtractPath = (svgFilePath: string, height: string) => {
    const svg = readFileSync(svgFilePath, 'utf8');
    const svgElement = load(svg)('svg');
    svgElement.find('title').remove();
    const svgWidth = parseInt(svgElement?.attr('width') ?? '0');
    const svgHeight = parseInt(svgElement?.attr('height') ?? '0');
    const svgViewBox = svgElement.attr('viewBox');
    const svgPath = svgElement
      .html()
      ?.split('\n')
      .map((line) => line.trim())
      .join('')
      .trim();

    if (!svgWidth) {
      throw new Error(`${svgFilePath}: Missing width attribute.`);
    }

    if (!svgHeight) {
      throw new Error(`${svgFilePath}: Missing height attribute.`);
    }

    if (!svgViewBox) {
      throw new Error(`${svgFilePath}: Missing viewBox attribute.`);
    }

    if (svgHeight !== parseInt(height)) {
      throw new Error(`${svgFilePath}: Height in filename does not match height attribute of SVG`);
    }

    const viewBoxPattern = /0 0 ([0-9]+) ([0-9]+)/;

    if (!viewBoxPattern.test(svgViewBox)) {
      throw new Error(
        `${svgFilePath}: Invalid viewBox attribute. The viewBox attribute should be in the following format: "0 0 <width> <height>"`
      );
    }

    const [, viewBoxWidth, viewBoxHeight] = svgViewBox.match(viewBoxPattern) ?? [];

    if (svgWidth !== parseInt(viewBoxWidth)) {
      throw new Error(`${svgFilePath}: width attribute and viewBox width do not match.`);
    }

    if (svgHeight !== parseInt(viewBoxHeight)) {
      throw new Error(`${svgFilePath}: height attribute and viewBox height do not match.`);
    }

    return svgPath;
  };

  // Read all SVG files from the icons directory and load the component template
  const svgFiles = readdirSync(iconsDir).filter((file) => file.endsWith('.svg'));
  const componentTemplate = readFileSync(join(srcDir, 'components', '_template.tsx'), 'utf8');

  // Process each SVG file to build an object representation of the icons
  const representation = svgFiles
    .map((fileName) => extractMetadataFromFilename(fileName))
    .reduce(
      (acc, [name, variant, size, originalFileName]) => {
        if (!acc[name]) {
          acc[name] = {};
        }
        if (!acc[name][variant]) {
          acc[name][variant] = {};
        }
        acc[name][variant][size] = validateSvgAndExtractPath(
          join(iconsDir, originalFileName),
          size
        );
        return acc;
      },
      {} as Record<string, Record<string, Record<string, string | undefined>>>
    );

  // Delete the existing index file if it exists
  const indexFile = join(srcDir, 'index.ts');
  if (existsSync(indexFile)) {
    unlinkSync(indexFile);
  }

  // Generate a 'sizes.ts' file mapping sizes to their designations
  const sizesFile = join(srcDir, 'sizes.ts');
  const sizes = Object.entries(reversed).reduce(
    (acc, [key, value]) => {
      acc[value] = parseInt(key);
      return acc;
    },
    {} as Record<string, number>
  );
  const sizesContent = `export default ${JSON.stringify(sizes, null, 2)};\n`;
  writeFileSync(sizesFile, sizesContent);

  // Loop over the representation to generate React component files for each icon
  for (const [name, currentData] of Object.entries(representation)) {
    const supportedVariants = Object.keys(currentData);

    const definitions = supportedVariants.map((variant) => {
      const supportedSizes = Object.keys(currentData[variant]);
      const sizeStr = supportedSizes
        .map((word) => reversed[`${word}` as keyof typeof reversed])
        .map((word) => `"${word}"`)
        .join(' | ');

      return [
        `IconReplaceName${variant}Props`,
        `interface IconReplaceName${variant}Props { size?: ${sizeStr}; variant?: "${variant}"; title?: string; iconColor?: string; className?: string; dataTestId?: string; };`,
      ];
    });
    const iconPropsContent = definitions.map(([_, content]) => `${content}\n`).join('\n');
    const iconsPropsTypeUnion = definitions.map(([iconName]) => iconName).join(' | ');
    const iconPropsExport =
      `export type IconReplaceNameProps = ${iconsPropsTypeUnion};` +
      '\n' +
      'export type IconReplaceNameIcon = (props: IconReplaceNameProps) => React.JSX.Element;';

    const file = componentTemplate
      .replace(
        'const iconData: IconData = {}',
        `const iconData: IconData = ${JSON.stringify(currentData)}`
      )
      .replace('//ReplaceWithTypes', iconPropsContent.concat(`\n${iconPropsExport}`))
      .replace(/IconReplaceName/g, name);

    const outputFilePath = join(srcDir, 'components', `${name}.tsx`);
    const currentFileContent = existsSync(outputFilePath) ? readFileSync(outputFilePath) : '';

    if (currentFileContent !== file) {
      // Write the component file for the current icon
      writeFileSync(outputFilePath, file);
    }

    // Append the current icon's export statement to the index file
    appendFileSync(indexFile, `export { ${name} } from "./components/${name}";\n`);
  }
}
