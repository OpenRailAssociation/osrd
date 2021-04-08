const bpBg = '#405cb1';
const bpMedium = '#98aedd';
const bpLight = '#e4eaf6';

const colors = {
  normal: {
    background: '#eeeeee',
    chantier: {
      text: '#2c457a',
      halo: '#ffffff',
    },
    dbc: {
      text: '#c16b00',
      circle: '#c16b00',
    },
    electricbox: {
      text: '#b42222',
    },
    kvb: {
      color: '#ffc700',
    },
    line: {
      color: '#555555',
      halo: '#f9f5f5',
      off: '#888888',
      text: '#0088ce',
    },
    linename: {
      text: '#555555',
      halo: '#f9f5f5',
    },
    panel: {
      text: '#333333',
      halo: '#ffffff',
    },
    pk: {
      circle: '#162873',
      text: '#142c90',
    },
    platform: {
      fill: '#e05206',
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
      text: '#555555',
      halo: '#ffffff',
    },
    station: {
      circle: '#555555',
      halo: '#ffffff',
      text: '#555555',
    },
    track: {
      minor: '#777777',
      major: '#0088ce',
    },
    trackname: {
      text: '#555555',
      halo: '#f9f5f5',
    },
    tunnel: {
      color: '#4b4b4b',
      text: '#164721',
    },
  },
  /* ***************************************************************************
  *
  * DARK
  *
  **************************************************************************** */
  dark: {
    background: '#0b011d',
    chantier: {
      text: '#aacc00',
      halo: 'rgba(255, 255, 255, 0)',
    },
    dbc: {
      text: '#c16b00',
      circle: '#c16b00',
    },
    electricbox: {
      text: '#b42222',
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
    panel: {
      text: '#eeeeee',
      halo: '#333333',
    },
    pk: {
      circle: '#8338ec',
      text: '#8338ec',
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
    },
    station: {
      circle: '#3a86ff',
      halo: '#0b011d',
      text: '#e0e1dd',
    },
    track: {
      minor: '#3a86ff',
      major: '#3a86ff',
    },
    trackname: {
      text: '#4895ef',
      halo: '#0b011d',
    },
    tunnel: {
      color: '#ffbe0b',
      text: '#ffbe0b',
    },
  },
  /* ***************************************************************************
  *
  * BLUEPRINT
  *
  **************************************************************************** */
  blueprint: {
    background: bpBg,
    chantier: {
      text: bpLight,
      halo: bpBg,
    },
    dbc: {
      text: bpLight,
      circle: bpLight,
    },
    electricbox: {
      text: bpLight,
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
    panel: {
      text: bpLight,
      halo: bpBg,
    },
    pk: {
      circle: bpLight,
      text: bpLight,
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
    },
    station: {
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
    tunnel: {
      color: bpMedium,
      text: bpMedium,
    },
  },
};

export default colors;
