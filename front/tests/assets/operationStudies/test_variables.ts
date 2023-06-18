export default {
  numberOfRollingstock: process.env.CI ? '3' : '446',
  numberOfRollingstockWithElectrical: process.env.CI ? '3' : '265',
  searchRollingstock: process.env.CI ? '7200' : 'tgv',
  numberOfRollingstockWithSearch: process.env.CI ? '1' : '27',
  rollingstockTestID: process.env.CI
    ? 'rollingstock-_@Test BB 7200GVLOCOMOTIVES'
    : 'rollingstock-1TGV2N2',
  rollingStockInfo: process.env.CI ? /BB 7200GV/ : /TGV2N2US/,
  originSearch: process.env.CI ? 'south west' : 'beaune',
  originSearchItem: process.env.CI ? /South_West_station/ : 'BEA Beaune 87713545',
  originPositionClick: process.env.CI ? { x: 200, y: 170 } : { x: 270, y: 135 },
  destinationSearch: process.env.CI ? 'nor' : 'miramas',
  destinationSearchItem: process.env.CI ? /North_East_station/ : 'MAS Miramas 2B 87753004',
  destinationPositionClick: process.env.CI ? { x: 200, y: 170 } : { x: 235, y: 160 },
  pathfindingDistance: process.env.CI ? '22 km' : '461 km',
};
