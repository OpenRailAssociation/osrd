export const LIGHT_SIGNALS = [

  'A',
  'CV',
  'D',
  'GA',
  'ID',
  'IDD',
  'CARRE',
  'S',
  'CARRE A',
  'S A',
  'CARRE VL',
  'S VL',

];

export const SIGNALS_PANELS = [
  'Aig M',
  'Aig T',
  'APPROCHETS',
  'APPROETSA',
  'ARRET A',
  'ARRET VOY',
  'ARRET',
  'ATC',
  'B',
  'BIMODE A',
  'BIMODE',
  'BP DIS',
  'BP EXE',
  'BP FIN',
  'CAB E',
  'CAB R',
  'CAB S',
  'CARRE (CH)',
  'CC EXE',
  'CC FIN',
  'CHEVRON',
  'Ct',
  'DD',
  'DEPOT',
  'DESTI',
  'DIVERS',
  'Ex',
  'FIN CAT',
  'FLECHE ACC',
  'G',
  'GABARIT',
  'GARE',
  'GIVRE',
  'HEURT...',
  'IDP',
  'IMP',
  'JAL ARRET',
  'JAL MAN',
  'L',
  'LGR',
  'LIMITETS',
  'LM',
  'MIBLAN VER',
  'MV',
  'P',
  'PAD',
  'PN...',
  'PN',
  'R',
  'R17',
  'REP ITIN',
  'REP TGV',
  'REPER VIT',
  'REV',
  'SAC',
  'SECT',
  'SG DIR',
  'SG DIVERS',
  'SG HEURT',
  'SG LIMVIT',
  'SG MANOEUV',
  'SIFFLER',
  'SIG A TRAM',
  'SLD',
  'SLM',
  'STOP A',
  'STOP',
  'TAB DIVERS',
  'TECS',
  'TIV A TRAM',
  'TIV D FIXE',
  'TIV D MOB',
  'TIV E TRAM',
  'TIV PENDIS',
  'TIV PENEXE',
  'TIV PENREP',
  'TIV R MOB',
  'TIV R TRAM',
  'TIVD B FIX',
  'TIVD C FIX',
  'TSCS',
  'TUNNEL',
  'VOIE CONV',
  'Z',
];

export const ALL_SIGNAL_LAYERS = [
  'A',
  'APPROCHETS',
  'APPROETSA',
  'ARRET',
  'ARRET A',
  'ARRET VOY',
  'ATC',
  'BP DIS',
  'BP EXE',
  'BP FIN',
  'CAB E',
  'CAB R',
  'CAB S',
  'CARRE',
  'CC EXE',
  'CC FIN',
  'CHEVRON',
  'CV',
  'D',
  'DD',
  'DESTI',
  'DIVERS',
  'DEPOT',
  'FIN CAT',
  'G',
  'GA',
  'GABARIT',
  'GARE',
  'HEURT...',
  'ID',
  'IDD',
  'IDP',
  'IMP',
  'JAL MAN',
  'L',
  'LGR',
  'LIMITETS',
  'LM',
  'MIBLAN VER',
  'P',
  'PN',
  'PN...',
  'R',
  'REPER VIT',
  'REP TGV',
  'REV',
  'S',
  'SECT',
  'SG HEURT',
  'SIFFLER',
  'STOP',
  'STOP A',
  'TECS',
  'TIV D FIXE',
  'TIV D MOB',
  'TIV PENDIS',
  'TIV PENEXE',
  'TIV PENREP',
  'TIV R MOB',
  'TIVD B FIX',
  'TIVD C FIX',
  'TSCS',
  'Z',
];

export const PANELS_STOPS = [
  'ARRET VOY',
  'ARRET',
  'CHEVRON',
  'LIMITETS',
  'LM',
  'STOP',
];

export const DYNAMIC_LIGHTS_SIGNAL_LIST = [
  'CARRE',
  'S'
];

export const DYNAMIC_LIGHTS_ATT = [
  'CARRE A',
  'S A'
];

export const DYNAMIC_LIGHTS_STOP = [
  'CARRE STOP',
  'S STOP'
];

export const PANELS_TIVS = [
  'TIV A TRAM',
  'TIV D FIXE',
  'TIV D MOB',
  'TIV E TRAM',
  'TIV PENDIS',
  'TIV PENEXE',
  'TIV PENREP',
  'TIV R MOB',
  'TIV R TRAM',
  'TIVD B FIX',
  'TIVD C FIX',
];

// Old complete list, keep for reference
/* export const SIGNALS_LIST = [
  'A (CH)',
  'A TRAM',
  'A',
  'Aig M',
  'Aig T',
  'APPROCHETS',
  'APPROETSA',
  'ARRET A',
  'ARRET VOY',
  'ARRET',
  'ATC',
  'B',
  'BIMODE A',
  'BIMODE',
  'BP DIS',
  'BP EXE',
  'BP FIN',
  'CAB E',
  'CAB R',
  'CAB S',
  'CARRE (CH)',
  'CARRE A',
  'CARRE',
  'CC EXE',
  'CC FIN',
  'CHEVRON',
  'Ct',
  'CV',
  'D',
  'DD',
  'DEPOT',
  'DESTI',
  'DIVERS',
  'Ex',
  'FEUXVERTS',
  'FIN CAT',
  'FLECHE ACC',
  'G',
  'GA',
  'GABARIT',
  'GARE',
  'GIVRE',
  'HEURT...',
  'ID',
  'IDD',
  'IDP',
  'IMP',
  'JAL ARRET',
  'JAL MAN',
  'L',
  'LGR',
  'LIMITETS',
  'LM',
  'MIBLAN VER',
  'MV',
  'P',
  'PAD',
  'PN...',
  'PN',
  'R',
  'R17',
  'R30',
  'REP ITIN',
  'REP TGV',
  'REPER VIT',
  'REV',
  'RR30',
  'S (CH)',
  'S',
  'SAC',
  'SECT',
  'SG DIR',
  'SG DIVERS',
  'SG HEURT',
  'SG LIMVIT',
  'SG MANOEUV',
  'SIFFLER',
  'SIG A TRAM',
  'SLD',
  'SLM',
  'STOP A',
  'STOP',
  'TAB DIVERS',
  'TECS',
  'TIV A TRAM',
  'TIV D FIXE',
  'TIV D MOB',
  'TIV E TRAM',
  'TIV PENDIS',
  'TIV PENEXE',
  'TIV PENREP',
  'TIV R MOB',
  'TIV R TRAM',
  'TIVD B FIX',
  'TIVD C FIX',
  'TLD',
  'TSCS',
  'TUNNEL',
  'VOIE CONV',
  'Z',
]; */
