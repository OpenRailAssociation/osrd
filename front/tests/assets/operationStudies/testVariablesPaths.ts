export default process.env.CI
  ? {
      originSearch: {
        stationName: 'south west',
        stationItemName: /South_West_station/,
        positionClick: { x: 415, y: 210 },
      },
      destinationSearch: {
        stationName: 'nor',
        stationItemName: /North_East_station/,
        positionClick: { x: 415, y: 215 },
      },
      stdcm: {
        originSearch: {
          stationName: 'south west',
          stationItemName: /South_West_station/,
          positionClick: { x: 400, y: 280 },
        },
        destinationSearch: {
          stationName: 'nor',
          stationItemName: /North_East_station/,
          positionClick: { x: 400, y: 290 },
        },
      },
    }
  : {
      originSearch: {
        stationName: 'beaune',
        stationItemName: 'BEA Beaune 87713545',
        positionClick: { x: 430, y: 205 },
      },
      originSearchDijon: {
        stationName: 'dijon ville',
        stationItemName: 'DN Dijon-Ville 87713040',
        positionClick: { x: 415, y: 300 },
      },
      originSearchQuimper: {
        stationName: 'quimper',
        stationItemName: 'QR Quimper SP 87474098',
        positionClick: { x: 410, y: 215 },
      },
      destinationSearch: {
        stationName: 'miramas',
        stationItemName: 'MAS Miramas A1 87753004',
        positionClick: { x: 415, y: 215 },
      },
      destinationSearchMacon: {
        stationName: 'macon ville',
        stationItemName: 'MAC Mâcon-Ville 87725689',
        positionClick: { x: 415, y: 215 },
      },
      destinationSearchBrest: {
        stationName: 'brest',
        stationItemName: 'BT Brest 87474007',
        positionClick: { x: 415, y: 215 },
      },
      stdcm: {
        originSearchDijon: {
          stationName: 'dijon ville',
          stationItemName: 'DN Dijon-Ville 87713040',
          positionClick: { x: 400, y: 360 },
        },
        destinationSearchMacon: {
          stationName: 'macon ville',
          stationItemName: 'MAC Mâcon-Ville 87725689',
          positionClick: { x: 400, y: 300 },
        },
      },
    };
