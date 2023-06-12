export default {
  numberOfRollingstock: process.env.CI ? '3' : '446',
  numberOfRollingstockWithElectrical: process.env.CI ? '3' : '262',
  searchRollingstock: process.env.CI ? '7200' : 'tgv',
  numberOfRollingstockWithSearch: process.env.CI ? '1' : '27',
  rollingstockTestID: process.env.CI
    ? 'rollingstock-_@Test BB 7200GVLOCOMOTIVES'
    : 'rollingstock-1TGV2N2',
  rollingstockInfos: process.env.CI ? /BB 7200GV/ : /TGV2N2US/,
};
