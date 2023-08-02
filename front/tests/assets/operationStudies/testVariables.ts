export default process.env.CI
  ? {
      infraName: 'small_infra',
      numberOfRollingstock: '3',
      numberOfRollingstockWithElectrical: '3',
      searchRollingstock: '7200',
      searchRollingstock1500V: '22200',
      numberOfRollingstockWithSearch: '1',
      rollingstockTestID: 'rollingstock-_@Test BB 7200GVLOCOMOTIVES',
      rollingstockTestID1500V: 'rollingstock-_@Test BB 22200',
      rollingStockInfo: /BB 7200GV/,
      pathfindingDistance: '22 km',
      stdcm: {
        pathfindingDistance: '22 km',
      },
    }
  : {
      infraName: 'France',
      numberOfRollingstock: '443',
      numberOfRollingstockWithElectrical: '262',
      numberOfRollingstockWithSearch: '27',
      searchRollingstock: 'tgv',
      rollingstockTestID: 'rollingstock-1TGV2N2',
      rollingStockInfo: /TGV2N2US/,
      pathfindingDistance: '461 km',
      stdcm: {
        searchRollingstock: 'ter',
        rollingstockTestID: 'rollingstock-2X725003',
        pathfindingDistance: '126 km',
      },
    };
