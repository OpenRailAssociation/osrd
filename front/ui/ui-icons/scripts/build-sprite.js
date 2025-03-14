import fs from 'fs';
import path from 'path';
import SVGSpriter from 'svg-sprite';

const config = {
  dest: 'temp/',
  mode: {
    css: true, // Create a «css» sprite
    view: true, // Create a «view» sprite
    defs: true, // Create a «defs» sprite
    symbol: true, // Create a «symbol» sprite
    stack: true, // Create a «stack» sprite
  },
};

// Create spriter instance (see below for `config` examples)
const spriter = new SVGSpriter(config);

// Add SVG source files — the manual way ...
spriter.add('icons/bell-24.svg', null, fs.readFileSync('icons/bell-24.svg', 'utf-8'));
spriter.add('icons/wand-24.svg', null, fs.readFileSync('icons/wand-24.svg', 'utf-8'));

// Compile the sprite
spriter.compile((error, result) => {
  /* Write `result` files to disk (or do whatever with them ...) */
  for (const mode of Object.values(result)) {
    for (const resource of Object.values(mode)) {
      fs.mkdirSync(path.dirname(resource.path), { recursive: true });
      fs.writeFileSync(resource.path, resource.contents);
    }
  }
});

// Or compile the sprite async
const { result } = await spriter.compileAsync();
/* Write `result` files to disk (or do whatever with them ...) */
for (const mode of Object.values(result)) {
  for (const resource of Object.values(mode)) {
    fs.mkdirSync(path.dirname(resource.path), { recursive: true });
    fs.writeFileSync(resource.path, resource.contents);
  }
}
