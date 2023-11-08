export default {
  infraName: 'small_infra',
  numberOfRollingstock: process.env.CI ? '3' : '446',
  numberOfRollingstockWithElectrical: process.env.CI ? '3' : '265',
  searchRollingstock: '22200',
  searchRollingstock1500V: '7200',
  numberOfRollingstockWithSearch: process.env.CI ? '1' : '6',
  rollingstockTestID: process.env.CI ? 'rollingstock-22200-test' : 'rollingstock-22200G',
  rollingstockTestID1500V: process.env.CI ? 'rollingstock-7200-test' : 'rollingstock-7200GH',
  rollingStockInfo: /BB 22200V160/,
  pathfindingDistance: '16 km',
  stdcm: {
    pathfindingDistance: '16 km',
  },
};
// {
//   infraName: 'small_infra',
//   numberOfRollingstock: '443',
//   numberOfRollingstockWithElectrical: '262',
//   numberOfRollingstockWithSearch: '27',
//   searchRollingstock: 'tgv',
//   rollingstockTestID: 'rollingstock-1TGV2N2',
//   rollingStockInfo: /TGV2N2US/,
//   pathfindingDistance: '461 km',
//   stdcm: {
//     searchRollingstock: 'ter',
//     rollingstockTestID: 'rollingstock-2X725003',
//     pathfindingDistance: '126 km',
//   },
// };

export const BASE_URL = 'http://localhost:8090';
