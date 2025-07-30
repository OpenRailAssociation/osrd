import type { Theme } from 'types';

const speedNone = '#b9b9b9';
const speed30 = '#ef5151';
const speed60 = '#fbb286';
const speed100 = '#fdf479';
const speed140 = '#e0fe64';
const speed160 = '#9eff77';
const speed220 = '#89f7d8';
const speedOver220 = '#91d3ff';

const DEFAULT_HALO_COLOR = { normal: 'rgba(246, 245, 241, 0.75)', dark: 'rgba(9, 10, 14, 0.75)' };

const normal = {
  // color used mainly in stdcm to hide data that are not in the perimeter
  muted: { color: '#bfbfbf' },
  background: { color: 'rgb(246, 245, 241)' },
  bufferstop: {
    text: '#333333',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  chantier: {
    text: '#2c457a',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  dbc: {
    text: '#c16b00',
    circle: '#c16b00',
  },
  detectors: {
    circle: '#0058cf',
    circleOther: '#FFFFFF',
    halo: DEFAULT_HALO_COLOR.normal,
    text: 'rgba(0, 71, 168, 1)',
  },
  electricbox: {
    text: '#b42222',
  },
  error: {
    color: '#ff0000',
    text: '#ff0000',
  },
  kp: {
    circle: '#162873',
    text: '#4d4f53',
  },
  kvb: {
    color: '#ffc700',
  },
  line: {
    color: '#555555',
    halo: DEFAULT_HALO_COLOR.normal,
    off: '#888888',
    text: '#0088ce',
  },
  linename: {
    text: '#8b4414',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  mapmarker: {
    text: '#0088ce',
    circle: '#0088ce',
  },
  neutral_sections: {
    lower_pantograph: '#ff0000',
    switch_off: '#000000',
  },
  op: {
    circle: '#FF5808',
    circleBV: '#BB2727',
    stroke: '#FFFFFF',
    textTrigram: '#000000',
    textName: '#312E2B',
    textYard: '#5C5955',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  platform: {
    fill: '#e9b996',
  },
  pn: {
    text: '#712b2b',
    halo: DEFAULT_HALO_COLOR.normal,
    pk: '#333333',
    halopk: DEFAULT_HALO_COLOR.normal,
  },
  powerline: {
    color25000V: '#8700ff',
    color15000V1623: '#00cf65',
    color3000V: '#86cf00',
    color1500V: '#ff0073',
    color850V: '#86cf00',
    color800V: '#86cf00',
    color750V: '#86cf00',
    colorOther: '#000000',
  },
  psl: {
    pointtext: '#5b5b5b',
    pointhalo: DEFAULT_HALO_COLOR.normal,
    detailtext: '#555555',
    detailhalo: DEFAULT_HALO_COLOR.normal,
    text: '#4d4f53',
    halo: DEFAULT_HALO_COLOR.normal,
    color: '#747678',
  },
  radio: {
    text: '#5596c8',
  },
  radioline: {
    gsmr: '#00a3d6',
    gsmr2: '#008515',
    rst: '#a47500',
  },
  railaccess: {
    halo: DEFAULT_HALO_COLOR.normal,
  },
  railyard: {
    text: '#2c457a',
  },
  routes: {
    text: '#e05206',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  sign: {
    text: '#333333',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  signal: {
    text: '#333333',
    halo: DEFAULT_HALO_COLOR.normal,
    point: '#0088ce',
  },
  speed: {
    pointtext: '#ffffff',
    pointhalo: '#5b5b5b',
    detailtext: '#555555',
    detailhalo: DEFAULT_HALO_COLOR.normal,
    text: '#4d4f53',
    halo: DEFAULT_HALO_COLOR.normal,
    speedNone,
    speed30,
    speed60,
    speed100,
    speed140,
    speed160,
    speed220,
    speedOver220,
  },
  station: {
    circle: '#555555',
    halo: DEFAULT_HALO_COLOR.normal,
    text: '#555555',
  },
  switches: {
    circle: '#a1006b',
    circleFill: 'rgba(231, 182, 255, 0.5)',
    halo: DEFAULT_HALO_COLOR.normal,
    text: '#a1006b',
  },
  track: {
    minor: '#bfbfbf',
    major: '#404040',
  },
  trackname: {
    text: '#555555',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  tracksosm: {
    minor: '#2a686c',
    major: '#009aa6',
  },
  tunnel: {
    color: '#4b4b4b',
    text: '#164721',
  },
  warning: {
    color: '#FF8C00',
    text: '#FF8C00',
  },
};

const dark: typeof normal = {
  muted: { color: '#d0d1d1' },
  background: { color: '#0b011d' },
  bufferstop: {
    text: '#999999',
    halo: DEFAULT_HALO_COLOR.dark,
  },
  chantier: {
    text: '#aacc00',
    halo: DEFAULT_HALO_COLOR.dark,
  },
  dbc: {
    text: '#c16b00',
    circle: '#c16b00',
  },
  detectors: {
    circle: '#0058cf',
    circleOther: '#000000',
    halo: DEFAULT_HALO_COLOR.dark,
    text: 'rgba(177, 190, 201, 1)',
  },
  electricbox: {
    text: '#b42222',
  },
  error: {
    color: '#ff0000',
    text: '#ff0000',
  },
  kp: {
    circle: '#8338ec',
    text: '#8338ec',
  },
  kvb: {
    color: '#ffc700',
  },
  line: {
    color: '#3a86ff',
    halo: DEFAULT_HALO_COLOR.dark,
    off: '#3472d5',
    text: '#0f0',
  },
  linename: {
    text: '#8b4414',
    halo: DEFAULT_HALO_COLOR.dark,
  },
  mapmarker: {
    text: '#ffaa39',
    circle: '#ffaa39',
  },
  neutral_sections: {
    lower_pantograph: '#ff0000',
    switch_off: '#000000',
  },
  op: {
    circle: '#FF5808',
    circleBV: '#BB2727',
    stroke: 'rgba(255,255,255,0.5)',
    textTrigram: '#FFFFFF',
    textName: '#FFFFFF',
    textYard: '#5C5955',
    halo: DEFAULT_HALO_COLOR.dark,
  },
  platform: {
    fill: '#f1c453',
  },
  pn: {
    text: '#fb5607',
    halo: DEFAULT_HALO_COLOR.dark,
    pk: '#fb5607',
    halopk: DEFAULT_HALO_COLOR.dark,
  },
  powerline: {
    color25000V: '#8700ff',
    color15000V1623: '#00cf65',
    color3000V: '#86cf00',
    color1500V: '#ff0073',
    color850V: '#86cf00',
    color800V: '#86cf00',
    color750V: '#86cf00',
    colorOther: '#FFFFFF',
  },
  psl: {
    pointtext: '#eeeeee',
    pointhalo: '#3a86ff',
    detailtext: '#3a86ff',
    detailhalo: DEFAULT_HALO_COLOR.dark,
    text: '#3a86ff',
    halo: DEFAULT_HALO_COLOR.dark,
    color: '#747678',
  },
  radio: {
    text: '#5596c8',
  },
  radioline: {
    gsmr: '#63009f',
    gsmr2: '#97009f',
    rst: '#a47500',
  },
  railaccess: {
    halo: DEFAULT_HALO_COLOR.dark,
  },
  railyard: {
    text: '#8095c3',
  },
  routes: {
    text: '#e05206',
    halo: DEFAULT_HALO_COLOR.dark,
  },
  sign: {
    text: '#eeeeee',
    halo: DEFAULT_HALO_COLOR.dark,
  },
  signal: {
    text: '#eeeeee',
    halo: DEFAULT_HALO_COLOR.dark,
    point: '#3a86ff',
  },
  speed: {
    pointtext: '#eeeeee',
    pointhalo: '#3a86ff',
    detailtext: '#3a86ff',
    detailhalo: DEFAULT_HALO_COLOR.dark,
    text: '#3a86ff',
    halo: DEFAULT_HALO_COLOR.dark,
    speedNone,
    speed30,
    speed60,
    speed100,
    speed140,
    speed160,
    speed220,
    speedOver220,
  },
  station: {
    circle: '#3a86ff',
    halo: DEFAULT_HALO_COLOR.dark,
    text: '#e0e1dd',
  },
  switches: {
    circle: '#a1006b',
    circleFill: 'rgba(231, 182, 255, 0.5)',
    halo: DEFAULT_HALO_COLOR.dark,
    text: '#a1006b',
  },
  track: {
    minor: '#3a86ff',
    major: '#3a86ff',
  },
  trackname: {
    text: '#4895ef',
    halo: DEFAULT_HALO_COLOR.dark,
  },
  tracksosm: {
    minor: '#3a86ff',
    major: '#3a86ff',
  },
  tunnel: {
    color: '#ffbe0b',
    text: '#ffbe0b',
  },
  warning: {
    color: '#FF8C00',
    text: '#FF8C00',
  },
};

const minimal: typeof normal = {
  muted: { color: '#d0d1d1' },
  background: { color: '#eeeeee' },
  bufferstop: {
    text: '#333333',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  chantier: {
    text: '#2c457a',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  dbc: {
    text: '#c16b00',
    circle: '#c16b00',
  },
  detectors: {
    circle: '#0058cf',
    circleOther: '#FFFFFF',
    halo: DEFAULT_HALO_COLOR.normal,
    text: 'rgba(0, 71, 168, 1)',
  },
  electricbox: {
    text: '#b42222',
  },
  error: {
    color: '#ff0000',
    text: '#ff0000',
  },
  kp: {
    circle: '#162873',
    text: '#4d4f53',
  },
  kvb: {
    color: '#ffc700',
  },
  line: {
    color: '#555555',
    halo: DEFAULT_HALO_COLOR.normal,
    off: '#888888',
    text: '#0088ce',
  },
  linename: {
    text: '#8b4414',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  mapmarker: {
    text: '#0088ce',
    circle: '#0088ce',
  },
  neutral_sections: {
    lower_pantograph: '#ff0000',
    switch_off: '#000000',
  },
  op: {
    circle: '#FF5808',
    circleBV: '#BB2727',
    stroke: '#FFFFFF',
    textTrigram: '#000000',
    textName: '#312E2B',
    textYard: '#5C5955',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  platform: {
    fill: '#d2e5ef',
  },
  pn: {
    text: '#712b2b',
    halo: DEFAULT_HALO_COLOR.normal,
    pk: '#333333',
    halopk: '#ffffff',
  },
  powerline: {
    color25000V: '#8700ff',
    color15000V1623: '#00cf65',
    color3000V: '#86cf00',
    color1500V: '#ff0073',
    color850V: '#86cf00',
    color800V: '#86cf00',
    color750V: '#86cf00',
    colorOther: '#000000',
  },
  psl: {
    pointtext: '#5b5b5b',
    pointhalo: DEFAULT_HALO_COLOR.normal,
    detailtext: '#555555',
    detailhalo: DEFAULT_HALO_COLOR.normal,
    text: '#4d4f53',
    halo: DEFAULT_HALO_COLOR.normal,
    color: '#747678',
  },
  radio: {
    text: '#5596c8',
  },
  radioline: {
    gsmr: '#00a3d6',
    gsmr2: '#008515',
    rst: '#a47500',
  },
  railaccess: {
    halo: '#fff',
  },
  railyard: {
    text: '#2c457a',
  },
  routes: {
    text: '#e05206',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  sign: {
    text: '#333333',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  signal: {
    text: '#333333',
    halo: DEFAULT_HALO_COLOR.normal,
    point: '#0088ce',
  },
  speed: {
    pointtext: '#ffffff',
    pointhalo: DEFAULT_HALO_COLOR.dark,
    detailtext: '#555555',
    detailhalo: DEFAULT_HALO_COLOR.normal,
    text: '#4d4f53',
    halo: DEFAULT_HALO_COLOR.normal,
    speedNone,
    speed30,
    speed60,
    speed100,
    speed140,
    speed160,
    speed220,
    speedOver220,
  },
  station: {
    circle: '#555555',
    halo: DEFAULT_HALO_COLOR.normal,
    text: '#555555',
  },
  switches: {
    circle: '#a1006b',
    circleFill: 'rgba(231, 182, 255, 0.5)',
    halo: DEFAULT_HALO_COLOR.normal,
    text: '#a1006b',
  },
  track: {
    minor: '#777777',
    major: '#003377',
  },
  trackname: {
    text: '#555555',
    halo: DEFAULT_HALO_COLOR.normal,
  },
  tracksosm: {
    minor: '#2a686c',
    major: '#009aa6',
  },
  tunnel: {
    color: '#4b4b4b',
    text: '#164721',
  },
  warning: {
    color: '#FF8C00',
    text: '#FF8C00',
  },
};

const colors: Record<string, Theme> = {
  normal,
  minimal,
  dark,
};

export default colors;
