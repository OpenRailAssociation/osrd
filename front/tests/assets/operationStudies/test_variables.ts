export default process.env.CI
  ? {
      infraName: 'small_infra',
      numberOfRollingstock: '3',
      numberOfRollingstockWithElectrical: '3',
      searchRollingstock: '7200',
      numberOfRollingstockWithSearch: '1',
      rollingstockTestID: 'rollingstock-_@Test BB 7200GVLOCOMOTIVES',
      rollingStockInfo: /BB 7200GV/,
      originSearch: {
        stationName: 'south west',
        stationItemName: /South_West_station/,
        positionClick: { x: 415, y: 200 },
      },
      destinationSearch: {
        stationName: 'nor',
        stationItemName: /North_East_station/,
        positionClick: { x: 415, y: 205 },
      },
      pathfindingDistance: '22 km',
    }
  : {
      infraName: 'France',
      numberOfRollingstock: '446',
      numberOfRollingstockWithElectrical: '265',
      searchRollingstock: 'tgv',
      numberOfRollingstockWithSearch: '27',
      rollingstockTestID: 'rollingstock-1TGV2N2',
      rollingStockInfo: /TGV2N2US/,
      originSearch: {
        stationName: 'beaune',
        stationItemName: 'BEA Beaune 87713545',
        positionClick: { x: 430, y: 200 },
      },

      destinationSearch: {
        stationName: 'miramas',
        stationItemName: 'MAS Miramas A1 87753004',
        positionClick: { x: 415, y: 200 },
      },

      pathfindingDistance: '461 km',
    };
