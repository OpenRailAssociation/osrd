import type { Theme } from 'types';

const bpBg = '#405cb1';
const bpMedium = '#98aedd';
const bpLight = '#e4eaf6';
const speedNone = '#b9b9b9';
const speed30 = '#ef5151';
const speed60 = '#fbb286';
const speed100 = '#fdf479';
const speed140 = '#e0fe64';
const speed160 = '#9eff77';
const speed220 = '#89f7d8';
const speedOver220 = '#91d3ff';

const colors: Record<string, Theme> = {
  normal: {
    background: { color: 'rgb(246, 245, 241)' },
    chantier: {
      text: '#2c457a',
      halo: '#ffffff',
    },
    dbc: {
      text: '#c16b00',
      circle: '#c16b00',
    },
    detectors: {
      circle: '#cd0037',
      halo: '#e7e7e7',
      text: '#a1006b',
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
      halo: '#ffffff',
    },
    kvb: {
      color: '#ffc700',
    },
    line: {
      color: '#555555',
      halo: '#eee',
      off: '#888888',
      text: '#0088ce',
    },
    linename: {
      text: '#555555',
      halo: '#eee',
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
      circle: '#82be00',
      text: '#202258',
      minitext: '#333',
      halo: '#eee',
    },
    platform: {
      fill: '#e9b996',
    },
    pn: {
      text: '#712b2b',
      halo: '#ffffff',
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
      pointhalo: '#ffffff',
      detailtext: '#555555',
      detailhalo: '#ffffff',
      text: '#4d4f53',
      halo: '#ffffff',
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
      halo: '#ffffff',
    },
    sign: {
      text: '#333333',
      halo: '#ffffff',
    },
    signal: {
      text: '#333333',
      halo: '#ffffff',
      point: '#0088ce',
    },
    speed: {
      pointtext: '#ffffff',
      pointhalo: '#5b5b5b',
      detailtext: '#555555',
      detailhalo: '#ffffff',
      text: '#4d4f53',
      halo: '#ffffff',
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
      halo: '#ffffff',
      text: '#555555',
    },
    switches: {
      circle: '#a1006b',
      halo: '#e7e7e7',
      text: '#a1006b',
    },
    track: {
      minor: '#777777',
      major: '#6A707D',
    },
    trackname: {
      text: '#555555',
      halo: '#eee',
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
  },
  /* ***************************************************************************
   *
   * DARK
   *
   **************************************************************************** */
  dark: {
    background: { color: '#0b011d' },
    chantier: {
      text: '#aacc00',
      halo: 'rgba(255, 255, 255, 0)',
    },
    dbc: {
      text: '#c16b00',
      circle: '#c16b00',
    },
    detectors: {
      circle: '#555555',
      halo: '#ffffff',
      text: '#555555',
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
      halo: '#8338ec',
    },
    kvb: {
      color: '#ffc700',
    },
    line: {
      color: '#3a86ff',
      halo: 'rgba(255, 255, 255, 0)',
      off: '#3472d5',
      text: '#0f0',
    },
    linename: {
      text: '#4895ef',
      halo: '#0b011d',
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
      circle: '#82be00',
      text: '#4895ef',
      minitext: '#4895ef',
      halo: '#0b011d',
    },
    platform: {
      fill: '#f1c453',
    },
    pn: {
      text: '#fb5607',
      halo: '#0b011d',
      pk: '#fb5607',
      halopk: 'rgba(0, 0, 0, 0)',
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
      detailhalo: '#0b011d',
      text: '#3a86ff',
      halo: '#000000',
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
      halo: '#fff',
    },
    railyard: {
      text: '#8095c3',
    },
    routes: {
      text: '#e05206',
      halo: '#ffffff',
    },
    sign: {
      text: '#eeeeee',
      halo: '#333333',
    },
    signal: {
      text: '#eeeeee',
      halo: '#000000',
      point: '#3a86ff',
    },
    speed: {
      pointtext: '#eeeeee',
      pointhalo: '#3a86ff',
      detailtext: '#3a86ff',
      detailhalo: '#0b011d',
      text: '#3a86ff',
      halo: '#000000',
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
      halo: '#0b011d',
      text: '#e0e1dd',
    },
    switches: {
      circle: '#555555',
      halo: '#ffffff',
      text: '#555555',
    },
    track: {
      minor: '#3a86ff',
      major: '#3a86ff',
    },
    trackname: {
      text: '#4895ef',
      halo: '#0b011d',
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
  },
  /* ***************************************************************************
   *
   * BLUEPRINT
   *
   **************************************************************************** */
  blueprint: {
    background: { color: bpBg },
    chantier: {
      text: bpLight,
      halo: bpBg,
    },
    dbc: {
      text: bpLight,
      circle: bpLight,
    },
    detectors: {
      circle: bpLight,
      halo: bpBg,
      text: bpLight,
    },
    electricbox: {
      text: bpLight,
    },
    error: {
      color: '#ff0000',
      text: '#ff0000',
    },
    kp: {
      circle: bpLight,
      text: bpLight,
      halo: bpLight,
    },
    kvb: {
      color: bpLight,
    },
    line: {
      color: bpLight,
      halo: bpBg,
      off: bpLight,
      text: bpLight,
    },
    linename: {
      text: bpLight,
      halo: bpBg,
    },
    mapmarker: {
      text: bpMedium,
      circle: bpLight,
    },
    neutral_sections: {
      lower_pantograph: '#ff0000',
      switch_off: '#000000',
    },
    op: {
      circle: bpLight,
      text: bpLight,
      minitext: bpLight,
      halo: bpBg,
    },
    platform: {
      fill: bpMedium,
    },
    pn: {
      text: bpLight,
      halo: bpBg,
      pk: bpLight,
      halopk: bpBg,
    },
    powerline: {
      color25000V: bpLight,
      color15000V1623: bpLight,
      color3000V: bpLight,
      color1500V: bpLight,
      color850V: bpLight,
      color800V: bpLight,
      color750V: bpLight,
      colorOther: bpLight,
    },
    psl: {
      pointtext: bpLight,
      pointhalo: bpBg,
      detailtext: bpLight,
      detailhalo: bpBg,
      text: bpLight,
      halo: bpBg,
      color: '#747678',
    },
    radio: {
      text: bpMedium,
    },
    radioline: {
      gsmr: bpMedium,
      gsmr2: '#667daf',
      rst: '#3c5282',
    },
    railaccess: {
      halo: bpBg,
    },
    railyard: {
      text: bpLight,
    },
    routes: {
      text: bpLight,
      halo: bpBg,
    },
    sign: {
      text: bpLight,
      halo: bpBg,
    },
    signal: {
      text: bpLight,
      halo: bpBg,
      point: bpLight,
    },
    speed: {
      pointtext: bpLight,
      pointhalo: bpBg,
      detailtext: bpLight,
      detailhalo: bpBg,
      text: bpLight,
      halo: bpBg,
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
      circle: bpLight,
      halo: bpBg,
      text: bpLight,
    },
    switches: {
      circle: bpLight,
      halo: bpBg,
      text: bpLight,
    },
    track: {
      minor: bpMedium,
      major: bpLight,
    },
    trackname: {
      text: bpLight,
      halo: bpBg,
    },
    tracksosm: {
      minor: bpMedium,
      major: bpLight,
    },
    tunnel: {
      color: bpMedium,
      text: bpMedium,
    },
    warning: {
      color: '#FF8C00',
      text: '#FF8C00',
    },
  },
  /* ***************************************************************************
   *
   * MINIMAL
   *
   **************************************************************************** */
  minimal: {
    background: { color: '#eeeeee' },
    chantier: {
      text: '#2c457a',
      halo: '#ffffff',
    },
    dbc: {
      text: '#c16b00',
      circle: '#c16b00',
    },
    detectors: {
      circle: '#cd0037',
      halo: '#e7e7e7',
      text: '#a1006b',
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
      halo: '#ffffff',
    },
    kvb: {
      color: '#ffc700',
    },
    line: {
      color: '#555555',
      halo: '#eee',
      off: '#888888',
      text: '#0088ce',
    },
    linename: {
      text: '#555555',
      halo: '#eee',
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
      circle: '#82be00',
      text: '#202258',
      minitext: '#333',
      halo: '#eee',
    },
    platform: {
      fill: '#d2e5ef',
    },
    pn: {
      text: '#712b2b',
      halo: '#ffffff',
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
      pointhalo: '#ffffff',
      detailtext: '#555555',
      detailhalo: '#ffffff',
      text: '#4d4f53',
      halo: '#ffffff',
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
      halo: '#ffffff',
    },
    sign: {
      text: '#333333',
      halo: '#ffffff',
    },
    signal: {
      text: '#333333',
      halo: '#ffffff',
      point: '#0088ce',
    },
    speed: {
      pointtext: '#ffffff',
      pointhalo: '#5b5b5b',
      detailtext: '#555555',
      detailhalo: '#ffffff',
      text: '#4d4f53',
      halo: '#ffffff',
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
      halo: '#ffffff',
      text: '#555555',
    },
    switches: {
      circle: '#a1006b',
      halo: '#e7e7e7',
      text: '#a1006b',
    },
    track: {
      minor: '#777777',
      major: '#003377',
    },
    trackname: {
      text: '#555555',
      halo: '#eee',
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
  },
};

export default colors;
