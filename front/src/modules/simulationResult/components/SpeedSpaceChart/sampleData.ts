import { OsrdSimulationState } from 'reducers/osrdsimulation/types';

const ORSD_GRAPH_SAMPLE_DATA: OsrdSimulationState = {
  chart: {
    width: 543,
    height: 369,
    margin: {
      top: 1,
      right: 1,
      bottom: 30,
      left: 55,
    },
    x: {} as unknown as d3.ScaleTime<number, number>,
    y: {} as unknown as d3.ScaleLinear<number, number>,
    xAxis: {
      _groups: [[{}]],
      _parents: [null],
    } as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
    xAxisGrid: {
      _groups: [[{}]],
      _parents: [null],
    } as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
    yAxis: {
      _groups: [[{}]],
      _parents: [null],
    } as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
    yAxisGrid: {
      _groups: [[{}]],
      _parents: [null],
    } as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
    y2: {} as unknown as d3.ScaleLinear<number, number>,
    y2Axis: {
      _groups: [[{}]],
      _parents: [null],
    } as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
    y2AxisGrid: {
      _groups: [[{}]],
      _parents: [null],
    } as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
    svg: {
      _groups: [
        [
          {
            __on: [
              {
                type: 'mouseover',
                name: '',
              },
              {
                type: 'mousemove',
                name: '',
              },
              {
                type: 'wheel',
                name: '',
              },
              {
                type: 'wheel',
                name: 'zoom',
                options: {
                  passive: false,
                },
              },
              {
                type: 'mousedown',
                name: 'zoom',
              },
              {
                type: 'dblclick',
                name: 'zoom',
              },
            ],
            __zoom: {
              k: 1,
              x: 0,
              y: 0,
            },
          },
        ],
      ],
      _parents: [null],
    } as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
    drawZone: {
      _groups: [[{}]],
      _parents: [null],
    } as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
    rotate: false,
  },
  isPlaying: false,
  isUpdating: false,
  allowancesSettings: {
    '10': {
      base: true,
      baseBlocks: true,
      eco: true,
      ecoBlocks: false,
    },
    '11': {
      base: true,
      baseBlocks: true,
      eco: true,
      ecoBlocks: false,
    },
    '12': {
      base: true,
      baseBlocks: true,
      eco: true,
      ecoBlocks: false,
    },
  },
  mustRedraw: false,
  selectedProjection: {
    id: 10,
    path: 4,
  },
  selectedTrainId: 10,
  speedSpaceSettings: {
    altitude: false,
    curves: false,
    maxSpeed: false,
    slopes: false,
    electricalProfiles: false,
    powerRestriction: false,
  },
  signalBase: 'BAL3',
  consolidatedSimulation: [
    {
      id: 10,
      name: 'sample 1',
      headPosition: [
        [
          {
            time: new Date('1900-01-01T13:50:39.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T13:50:47.000Z'),
            position: 15.087681652230287,
          },
          {
            time: new Date('1900-01-01T13:50:55.000Z'),
            position: 59.95650969166121,
          },
          {
            time: new Date('1900-01-01T13:51:03.000Z'),
            position: 134.0825421380268,
          },
          {
            time: new Date('1900-01-01T13:51:11.000Z'),
            position: 236.98839247875625,
          },
          {
            time: new Date('1900-01-01T13:52:36.000Z'),
            position: 1660.9650000000001,
          },
          {
            time: new Date('1900-01-01T13:52:42.000Z'),
            position: 1767.7780072292762,
          },
          {
            time: new Date('1900-01-01T13:52:50.000Z'),
            position: 1930.6174571559138,
          },
          {
            time: new Date('1900-01-01T13:53:00.000Z'),
            position: 2161.1275570966345,
          },
          {
            time: new Date('1900-01-01T13:53:10.000Z'),
            position: 2413.0298284954642,
          },
          {
            time: new Date('1900-01-01T13:53:22.000Z'),
            position: 2738.1398383195615,
          },
          {
            time: new Date('1900-01-01T13:53:36.000Z'),
            position: 3145.965,
          },
          {
            time: new Date('1900-01-01T13:54:01.000Z'),
            position: 3770.858012400591,
          },
          {
            time: new Date('1900-01-01T13:54:15.000Z'),
            position: 4156.964371844142,
          },
          {
            time: new Date('1900-01-01T13:54:25.000Z'),
            position: 4459.229607497612,
          },
          {
            time: new Date('1900-01-01T13:54:37.000Z'),
            position: 4850.376521303067,
          },
          {
            time: new Date('1900-01-01T13:54:49.000Z'),
            position: 5270.281282169671,
          },
          {
            time: new Date('1900-01-01T13:55:01.000Z'),
            position: 5716.242002875245,
          },
          {
            time: new Date('1900-01-01T13:55:11.000Z'),
            position: 6106.035980221415,
          },
          {
            time: new Date('1900-01-01T13:55:19.000Z'),
            position: 6435.579634345027,
          },
          {
            time: new Date('1900-01-01T13:55:29.000Z'),
            position: 6868.595781383138,
          },
          {
            time: new Date('1900-01-01T13:55:55.000Z'),
            position: 8020.071253348365,
          },
          {
            time: new Date('1900-01-01T13:56:23.000Z'),
            position: 9210.531491201365,
          },
          {
            time: new Date('1900-01-01T13:56:29.000Z'),
            position: 9484.128166707702,
          },
          {
            time: new Date('1900-01-01T13:56:35.000Z'),
            position: 9771.392110422634,
          },
          {
            time: new Date('1900-01-01T13:56:43.000Z'),
            position: 10172.427180640114,
          },
          {
            time: new Date('1900-01-01T13:56:49.000Z'),
            position: 10486.693547932831,
          },
          {
            time: new Date('1900-01-01T13:58:18.000Z'),
            position: 15453.965,
          },
          {
            time: new Date('1900-01-01T13:58:24.000Z'),
            position: 15793.311759016024,
          },
          {
            time: new Date('1900-01-01T13:58:30.000Z'),
            position: 16143.99757989964,
          },
          {
            time: new Date('1900-01-01T13:58:40.000Z'),
            position: 16748.723176299554,
          },
          {
            time: new Date('1900-01-01T13:58:50.000Z'),
            position: 17368.41050165773,
          },
          {
            time: new Date('1900-01-01T13:59:12.000Z'),
            position: 18766.6763033138,
          },
          {
            time: new Date('1900-01-01T13:59:20.000Z'),
            position: 19286.141310948067,
          },
          {
            time: new Date('1900-01-01T13:59:28.000Z'),
            position: 19816.618864989814,
          },
          {
            time: new Date('1900-01-01T13:59:44.000Z'),
            position: 20905.824840111123,
          },
          {
            time: new Date('1900-01-01T13:59:52.000Z'),
            position: 21467.64995775713,
          },
          {
            time: new Date('1900-01-01T14:00:02.000Z'),
            position: 22189.116288063826,
          },
          {
            time: new Date('1900-01-01T14:00:10.000Z'),
            position: 22780.758499968604,
          },
          {
            time: new Date('1900-01-01T14:00:20.000Z'),
            position: 23537.4561097713,
          },
          {
            time: new Date('1900-01-01T14:00:46.000Z'),
            position: 25538.497935155963,
          },
          {
            time: new Date('1900-01-01T14:01:02.000Z'),
            position: 26785.73730604492,
          },
          {
            time: new Date('1900-01-01T14:01:14.000Z'),
            position: 27738.84707111232,
          },
          {
            time: new Date('1900-01-01T14:01:24.000Z'),
            position: 28553.034185602537,
          },
          {
            time: new Date('1900-01-01T14:04:01.000Z'),
            position: 41549.750324835055,
          },
          {
            time: new Date('1900-01-01T14:04:48.000Z'),
            position: 45487.18384380568,
          },
          {
            time: new Date('1900-01-01T14:08:23.000Z'),
            position: 63412.01822058594,
          },
          {
            time: new Date('1900-01-01T14:08:31.000Z'),
            position: 64070.69104510256,
          },
          {
            time: new Date('1900-01-01T14:08:49.000Z'),
            position: 65534.839081862076,
          },
          {
            time: new Date('1900-01-01T14:09:01.000Z'),
            position: 66525.77093593446,
          },
          {
            time: new Date('1900-01-01T14:14:24.000Z'),
            position: 93390.965,
          },
          {
            time: new Date('1900-01-01T14:14:51.000Z'),
            position: 95661.12432035248,
          },
          {
            time: new Date('1900-01-01T14:21:58.000Z'),
            position: 131190.965,
          },
          {
            time: new Date('1900-01-01T14:22:24.000Z'),
            position: 133333.25559366634,
          },
          {
            time: new Date('1900-01-01T14:23:07.000Z'),
            position: 136961.33569717835,
          },
          {
            time: new Date('1900-01-01T14:30:52.000Z'),
            position: 175708.57652478074,
          },
          {
            time: new Date('1900-01-01T14:30:59.000Z'),
            position: 176228.74277777784,
          },
          {
            time: new Date('1900-01-01T14:31:05.000Z'),
            position: 176700.4094444445,
          },
          {
            time: new Date('1900-01-01T14:31:13.000Z'),
            position: 177301.29833333337,
          },
          {
            time: new Date('1900-01-01T14:31:21.000Z'),
            position: 177870.18722222224,
          },
          {
            time: new Date('1900-01-01T14:31:29.000Z'),
            position: 178407.07611111112,
          },
          {
            time: new Date('1900-01-01T14:31:37.000Z'),
            position: 178911.965,
          },
          {
            time: new Date('1900-01-01T14:31:57.000Z'),
            position: 180147.2705093627,
          },
          {
            time: new Date('1900-01-01T14:32:11.000Z'),
            position: 180991.56898009698,
          },
          {
            time: new Date('1900-01-01T14:32:25.000Z'),
            position: 181823.81089114814,
          },
          {
            time: new Date('1900-01-01T14:32:49.000Z'),
            position: 183234.1939976445,
          },
          {
            time: new Date('1900-01-01T14:33:09.000Z'),
            position: 184435.50229204967,
          },
          {
            time: new Date('1900-01-01T14:36:36.000Z'),
            position: 197111.8538888888,
          },
          {
            time: new Date('1900-01-01T14:36:44.000Z'),
            position: 197582.96499999994,
          },
          {
            time: new Date('1900-01-01T14:36:48.000Z'),
            position: 197806.5205555555,
          },
          {
            time: new Date('1900-01-01T14:36:54.000Z'),
            position: 198126.85388888884,
          },
          {
            time: new Date('1900-01-01T14:37:02.000Z'),
            position: 198525.96499999997,
          },
          {
            time: new Date('1900-01-01T14:37:10.000Z'),
            position: 198893.0761111111,
          },
          {
            time: new Date('1900-01-01T14:37:18.000Z'),
            position: 199228.18722222222,
          },
          {
            time: new Date('1900-01-01T14:37:29.000Z'),
            position: 199627.96499999994,
          },
          {
            time: new Date('1900-01-01T14:37:35.000Z'),
            position: 199839.63166666662,
          },
          {
            time: new Date('1900-01-01T14:37:43.000Z'),
            position: 200093.85388888887,
          },
          {
            time: new Date('1900-01-01T14:38:06.000Z'),
            position: 200732.607,
          },
          {
            time: new Date('1900-01-01T14:38:12.000Z'),
            position: 200879.607,
          },
          {
            time: new Date('1900-01-01T14:38:18.000Z'),
            position: 201008.607,
          },
          {
            time: new Date('1900-01-01T14:38:24.000Z'),
            position: 201119.607,
          },
          {
            time: new Date('1900-01-01T14:38:32.000Z'),
            position: 201239.607,
          },
          {
            time: new Date('1900-01-01T14:38:38.000Z'),
            position: 201308.607,
          },
          {
            time: new Date('1900-01-01T14:38:46.000Z'),
            position: 201372.607,
          },
          {
            time: new Date('1900-01-01T14:38:52.000Z'),
            position: 201399.607,
          },
          {
            time: new Date('1900-01-01T14:38:59.000Z'),
            position: 201408.607,
          },
        ],
      ],
      tailPosition: [
        [
          {
            time: new Date('1900-01-01T13:50:39.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T13:50:47.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T13:50:55.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T13:51:03.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T13:51:11.000Z'),
            position: 36.98839247875625,
          },
          {
            time: new Date('1900-01-01T13:52:36.000Z'),
            position: 1460.9650000000001,
          },
          {
            time: new Date('1900-01-01T13:52:42.000Z'),
            position: 1567.7780072292762,
          },
          {
            time: new Date('1900-01-01T13:52:50.000Z'),
            position: 1730.6174571559138,
          },
          {
            time: new Date('1900-01-01T13:53:00.000Z'),
            position: 1961.1275570966345,
          },
          {
            time: new Date('1900-01-01T13:53:10.000Z'),
            position: 2213.0298284954642,
          },
          {
            time: new Date('1900-01-01T13:53:22.000Z'),
            position: 2538.1398383195615,
          },
          {
            time: new Date('1900-01-01T13:53:36.000Z'),
            position: 2945.965,
          },
          {
            time: new Date('1900-01-01T13:54:01.000Z'),
            position: 3570.858012400591,
          },
          {
            time: new Date('1900-01-01T13:54:15.000Z'),
            position: 3956.964371844142,
          },
          {
            time: new Date('1900-01-01T13:54:25.000Z'),
            position: 4259.229607497612,
          },
          {
            time: new Date('1900-01-01T13:54:37.000Z'),
            position: 4650.376521303067,
          },
          {
            time: new Date('1900-01-01T13:54:49.000Z'),
            position: 5070.281282169671,
          },
          {
            time: new Date('1900-01-01T13:55:01.000Z'),
            position: 5516.242002875245,
          },
          {
            time: new Date('1900-01-01T13:55:11.000Z'),
            position: 5906.035980221415,
          },
          {
            time: new Date('1900-01-01T13:55:19.000Z'),
            position: 6235.579634345027,
          },
          {
            time: new Date('1900-01-01T13:55:29.000Z'),
            position: 6668.595781383138,
          },
          {
            time: new Date('1900-01-01T13:55:55.000Z'),
            position: 7820.071253348365,
          },
          {
            time: new Date('1900-01-01T13:56:23.000Z'),
            position: 9010.531491201365,
          },
          {
            time: new Date('1900-01-01T13:56:29.000Z'),
            position: 9284.128166707702,
          },
          {
            time: new Date('1900-01-01T13:56:35.000Z'),
            position: 9571.392110422634,
          },
          {
            time: new Date('1900-01-01T13:56:43.000Z'),
            position: 9972.427180640114,
          },
          {
            time: new Date('1900-01-01T13:56:49.000Z'),
            position: 10286.693547932831,
          },
          {
            time: new Date('1900-01-01T13:58:18.000Z'),
            position: 15253.965,
          },
          {
            time: new Date('1900-01-01T13:58:24.000Z'),
            position: 15593.311759016024,
          },
          {
            time: new Date('1900-01-01T13:58:30.000Z'),
            position: 15943.99757989964,
          },
          {
            time: new Date('1900-01-01T13:58:40.000Z'),
            position: 16548.723176299554,
          },
          {
            time: new Date('1900-01-01T13:58:50.000Z'),
            position: 17168.41050165773,
          },
          {
            time: new Date('1900-01-01T13:59:12.000Z'),
            position: 18566.6763033138,
          },
          {
            time: new Date('1900-01-01T13:59:20.000Z'),
            position: 19086.141310948067,
          },
          {
            time: new Date('1900-01-01T13:59:28.000Z'),
            position: 19616.618864989814,
          },
          {
            time: new Date('1900-01-01T13:59:44.000Z'),
            position: 20705.824840111123,
          },
          {
            time: new Date('1900-01-01T13:59:52.000Z'),
            position: 21267.64995775713,
          },
          {
            time: new Date('1900-01-01T14:00:02.000Z'),
            position: 21989.116288063826,
          },
          {
            time: new Date('1900-01-01T14:00:10.000Z'),
            position: 22580.758499968604,
          },
          {
            time: new Date('1900-01-01T14:00:20.000Z'),
            position: 23337.4561097713,
          },
          {
            time: new Date('1900-01-01T14:00:46.000Z'),
            position: 25338.497935155963,
          },
          {
            time: new Date('1900-01-01T14:01:02.000Z'),
            position: 26585.73730604492,
          },
          {
            time: new Date('1900-01-01T14:01:14.000Z'),
            position: 27538.84707111232,
          },
          {
            time: new Date('1900-01-01T14:01:24.000Z'),
            position: 28353.034185602537,
          },
          {
            time: new Date('1900-01-01T14:04:01.000Z'),
            position: 41349.750324835055,
          },
          {
            time: new Date('1900-01-01T14:04:48.000Z'),
            position: 45287.18384380568,
          },
          {
            time: new Date('1900-01-01T14:08:23.000Z'),
            position: 63212.01822058594,
          },
          {
            time: new Date('1900-01-01T14:08:31.000Z'),
            position: 63870.69104510256,
          },
          {
            time: new Date('1900-01-01T14:08:49.000Z'),
            position: 65334.839081862076,
          },
          {
            time: new Date('1900-01-01T14:09:01.000Z'),
            position: 66325.77093593446,
          },
          {
            time: new Date('1900-01-01T14:14:24.000Z'),
            position: 93190.965,
          },
          {
            time: new Date('1900-01-01T14:14:51.000Z'),
            position: 95461.12432035248,
          },
          {
            time: new Date('1900-01-01T14:21:58.000Z'),
            position: 130990.965,
          },
          {
            time: new Date('1900-01-01T14:22:24.000Z'),
            position: 133133.25559366634,
          },
          {
            time: new Date('1900-01-01T14:23:07.000Z'),
            position: 136761.33569717835,
          },
          {
            time: new Date('1900-01-01T14:30:52.000Z'),
            position: 175508.57652478074,
          },
          {
            time: new Date('1900-01-01T14:30:59.000Z'),
            position: 176028.74277777784,
          },
          {
            time: new Date('1900-01-01T14:31:05.000Z'),
            position: 176500.4094444445,
          },
          {
            time: new Date('1900-01-01T14:31:13.000Z'),
            position: 177101.29833333337,
          },
          {
            time: new Date('1900-01-01T14:31:21.000Z'),
            position: 177670.18722222224,
          },
          {
            time: new Date('1900-01-01T14:31:29.000Z'),
            position: 178207.07611111112,
          },
          {
            time: new Date('1900-01-01T14:31:37.000Z'),
            position: 178711.965,
          },
          {
            time: new Date('1900-01-01T14:31:57.000Z'),
            position: 179947.2705093627,
          },
          {
            time: new Date('1900-01-01T14:32:11.000Z'),
            position: 180791.56898009698,
          },
          {
            time: new Date('1900-01-01T14:32:25.000Z'),
            position: 181623.81089114814,
          },
          {
            time: new Date('1900-01-01T14:32:49.000Z'),
            position: 183034.1939976445,
          },
          {
            time: new Date('1900-01-01T14:33:09.000Z'),
            position: 184235.50229204967,
          },
          {
            time: new Date('1900-01-01T14:36:36.000Z'),
            position: 196911.8538888888,
          },
          {
            time: new Date('1900-01-01T14:36:44.000Z'),
            position: 197382.96499999994,
          },
          {
            time: new Date('1900-01-01T14:36:48.000Z'),
            position: 197606.5205555555,
          },
          {
            time: new Date('1900-01-01T14:36:54.000Z'),
            position: 197926.85388888884,
          },
          {
            time: new Date('1900-01-01T14:37:02.000Z'),
            position: 198325.96499999997,
          },
          {
            time: new Date('1900-01-01T14:37:10.000Z'),
            position: 198693.0761111111,
          },
          {
            time: new Date('1900-01-01T14:37:18.000Z'),
            position: 199028.18722222222,
          },
          {
            time: new Date('1900-01-01T14:37:29.000Z'),
            position: 199427.96499999994,
          },
          {
            time: new Date('1900-01-01T14:37:35.000Z'),
            position: 199639.63166666662,
          },
          {
            time: new Date('1900-01-01T14:37:43.000Z'),
            position: 199893.85388888887,
          },
          {
            time: new Date('1900-01-01T14:38:06.000Z'),
            position: 200532.607,
          },
          {
            time: new Date('1900-01-01T14:38:12.000Z'),
            position: 200679.607,
          },
          {
            time: new Date('1900-01-01T14:38:18.000Z'),
            position: 200808.607,
          },
          {
            time: new Date('1900-01-01T14:38:24.000Z'),
            position: 200919.607,
          },
          {
            time: new Date('1900-01-01T14:38:32.000Z'),
            position: 201039.607,
          },
          {
            time: new Date('1900-01-01T14:38:38.000Z'),
            position: 201108.607,
          },
          {
            time: new Date('1900-01-01T14:38:46.000Z'),
            position: 201172.607,
          },
          {
            time: new Date('1900-01-01T14:38:52.000Z'),
            position: 201199.607,
          },
          {
            time: new Date('1900-01-01T14:38:59.000Z'),
            position: 201208.607,
          },
        ],
      ],
      routeAspects: [
        {
          signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
          time_start: new Date('1900-01-01T13:50:39.000Z'),
          time_end: new Date('1900-01-01T13:51:16.000Z'),
          position_start: 320.965,
          position_end: 605.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '69ca947c-6667-11e3-81ff-01f464e0362d',
          track_offset: 496,
        },
        {
          signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
          time_start: new Date('1900-01-01T13:51:16.000Z'),
          time_end: new Date('1900-01-01T13:51:45.000Z'),
          position_start: 320.965,
          position_end: 605.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '69ca947c-6667-11e3-81ff-01f464e0362d',
          track_offset: 496,
        },
        {
          signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
          time_start: new Date('1900-01-01T13:51:45.000Z'),
          time_end: new Date('1900-01-01T13:52:33.000Z'),
          position_start: 320.965,
          position_end: 605.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '69ca947c-6667-11e3-81ff-01f464e0362d',
          track_offset: 496,
        },
        {
          signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:51:16.000Z'),
          time_end: new Date('1900-01-01T13:51:33.000Z'),
          position_start: 605.965,
          position_end: 1410.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60c895c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 51,
        },
        {
          signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:51:33.000Z'),
          time_end: new Date('1900-01-01T13:52:33.000Z'),
          position_start: 605.965,
          position_end: 1410.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60c895c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 51,
        },
        {
          signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:52:33.000Z'),
          time_end: new Date('1900-01-01T13:53:08.000Z'),
          position_start: 605.965,
          position_end: 1410.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60c895c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 51,
        },
        {
          signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:51:57.000Z'),
          time_end: new Date('1900-01-01T13:52:21.000Z'),
          position_start: 1410.965,
          position_end: 2157.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '61a60592-6667-11e3-81ff-01f464e0362d',
          track_offset: 358,
        },
        {
          signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:52:21.000Z'),
          time_end: new Date('1900-01-01T13:53:08.000Z'),
          position_start: 1410.965,
          position_end: 2157.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '61a60592-6667-11e3-81ff-01f464e0362d',
          track_offset: 358,
        },
        {
          signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:53:08.000Z'),
          time_end: new Date('1900-01-01T13:53:44.000Z'),
          position_start: 1410.965,
          position_end: 2157.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '61a60592-6667-11e3-81ff-01f464e0362d',
          track_offset: 358,
        },
        {
          signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:52:41.000Z'),
          time_end: new Date('1900-01-01T13:53:00.000Z'),
          position_start: 2157.965,
          position_end: 3139.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '61a460c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 248,
        },
        {
          signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:53:00.000Z'),
          time_end: new Date('1900-01-01T13:53:44.000Z'),
          position_start: 2157.965,
          position_end: 3139.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '61a460c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 248,
        },
        {
          signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:53:44.000Z'),
          time_end: new Date('1900-01-01T13:54:44.000Z'),
          position_start: 2157.965,
          position_end: 3139.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '61a460c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 248,
        },
        {
          signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:53:22.000Z'),
          time_end: new Date('1900-01-01T13:53:36.000Z'),
          position_start: 3139.965,
          position_end: 4890.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '61a465bc-6667-11e3-81ff-01f464e0362d',
          track_offset: 544,
        },
        {
          signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:53:36.000Z'),
          time_end: new Date('1900-01-01T13:54:44.000Z'),
          position_start: 3139.965,
          position_end: 4890.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '61a465bc-6667-11e3-81ff-01f464e0362d',
          track_offset: 544,
        },
        {
          signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:54:44.000Z'),
          time_end: new Date('1900-01-01T13:55:22.000Z'),
          position_start: 3139.965,
          position_end: 4890.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '61a465bc-6667-11e3-81ff-01f464e0362d',
          track_offset: 544,
        },
        {
          signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T13:54:26.000Z'),
          time_end: new Date('1900-01-01T13:54:38.000Z'),
          position_start: 4890.965,
          position_end: 6365.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8b696-6667-11e3-81ff-01f464e0362d',
          track_offset: 1393,
        },
        {
          signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T13:54:38.000Z'),
          time_end: new Date('1900-01-01T13:55:22.000Z'),
          position_start: 4890.965,
          position_end: 6365.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8b696-6667-11e3-81ff-01f464e0362d',
          track_offset: 1393,
        },
        {
          signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T13:55:22.000Z'),
          time_end: new Date('1900-01-01T13:56:15.000Z'),
          position_start: 4890.965,
          position_end: 6365.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8b696-6667-11e3-81ff-01f464e0362d',
          track_offset: 1393,
        },
        {
          signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:55:07.000Z'),
          time_end: new Date('1900-01-01T13:55:17.000Z'),
          position_start: 6365.965,
          position_end: 8655.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 869,
        },
        {
          signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:55:17.000Z'),
          time_end: new Date('1900-01-01T13:56:15.000Z'),
          position_start: 6365.965,
          position_end: 8655.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 869,
        },
        {
          signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:56:15.000Z'),
          time_end: new Date('1900-01-01T13:56:56.000Z'),
          position_start: 6365.965,
          position_end: 8655.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 869,
        },
        {
          signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:56:00.000Z'),
          time_end: new Date('1900-01-01T13:56:10.000Z'),
          position_start: 8655.965,
          position_end: 10695.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 3159,
        },
        {
          signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:56:10.000Z'),
          time_end: new Date('1900-01-01T13:56:56.000Z'),
          position_start: 8655.965,
          position_end: 10695.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 3159,
        },
        {
          signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:56:56.000Z'),
          time_end: new Date('1900-01-01T13:57:42.000Z'),
          position_start: 8655.965,
          position_end: 10695.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 3159,
        },
        {
          signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:56:45.000Z'),
          time_end: new Date('1900-01-01T13:56:53.000Z'),
          position_start: 10695.965,
          position_end: 13220.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 5199,
        },
        {
          signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:56:53.000Z'),
          time_end: new Date('1900-01-01T13:57:42.000Z'),
          position_start: 10695.965,
          position_end: 13220.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 5199,
        },
        {
          signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:57:42.000Z'),
          time_end: new Date('1900-01-01T13:58:20.000Z'),
          position_start: 10695.965,
          position_end: 13220.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 5199,
        },
        {
          signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:57:31.000Z'),
          time_end: new Date('1900-01-01T13:57:38.000Z'),
          position_start: 13220.965,
          position_end: 15353.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
          track_offset: 10,
        },
        {
          signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:57:38.000Z'),
          time_end: new Date('1900-01-01T13:58:20.000Z'),
          position_start: 13220.965,
          position_end: 15353.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
          track_offset: 10,
        },
        {
          signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:31:47.000Z'),
          time_end: new Date('1900-01-01T14:31:53.000Z'),
          position_start: 179935.965,
          position_end: 181568.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
          track_offset: 924,
        },
        {
          signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:31:53.000Z'),
          time_end: new Date('1900-01-01T14:32:24.000Z'),
          position_start: 179935.965,
          position_end: 181568.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
          track_offset: 924,
        },
        {
          signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:32:24.000Z'),
          time_end: new Date('1900-01-01T14:32:59.000Z'),
          position_start: 179935.965,
          position_end: 181568.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
          track_offset: 924,
        },
        {
          signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:32:14.000Z'),
          time_end: new Date('1900-01-01T14:32:21.000Z'),
          position_start: 181568.965,
          position_end: 183628.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
          track_offset: 235,
        },
        {
          signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:32:21.000Z'),
          time_end: new Date('1900-01-01T14:32:59.000Z'),
          position_start: 181568.965,
          position_end: 183628.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
          track_offset: 235,
        },
        {
          signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:32:59.000Z'),
          time_end: new Date('1900-01-01T14:33:26.000Z'),
          position_start: 181568.965,
          position_end: 183628.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
          track_offset: 235,
        },
        {
          signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:32:49.000Z'),
          time_end: new Date('1900-01-01T14:32:56.000Z'),
          position_start: 183628.965,
          position_end: 185298.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 1140,
        },
        {
          signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:32:56.000Z'),
          time_end: new Date('1900-01-01T14:33:26.000Z'),
          position_start: 183628.965,
          position_end: 185298.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 1140,
        },
        {
          signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:33:26.000Z'),
          time_end: new Date('1900-01-01T14:33:54.000Z'),
          position_start: 183628.965,
          position_end: 185298.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 1140,
        },
        {
          signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:33:17.000Z'),
          time_end: new Date('1900-01-01T14:33:23.000Z'),
          position_start: 185298.965,
          position_end: 186988.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 2810,
        },
        {
          signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:33:23.000Z'),
          time_end: new Date('1900-01-01T14:33:54.000Z'),
          position_start: 185298.965,
          position_end: 186988.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 2810,
        },
        {
          signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:33:54.000Z'),
          time_end: new Date('1900-01-01T14:34:21.000Z'),
          position_start: 185298.965,
          position_end: 186988.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 2810,
        },
        {
          signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:33:44.000Z'),
          time_end: new Date('1900-01-01T14:33:51.000Z'),
          position_start: 186988.965,
          position_end: 188618.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 4500,
        },
        {
          signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:33:51.000Z'),
          time_end: new Date('1900-01-01T14:34:21.000Z'),
          position_start: 186988.965,
          position_end: 188618.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 4500,
        },
        {
          signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:34:21.000Z'),
          time_end: new Date('1900-01-01T14:34:48.000Z'),
          position_start: 186988.965,
          position_end: 188618.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 4500,
        },
        {
          signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:34:11.000Z'),
          time_end: new Date('1900-01-01T14:34:17.000Z'),
          position_start: 188618.965,
          position_end: 190262.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 6130,
        },
        {
          signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:34:17.000Z'),
          time_end: new Date('1900-01-01T14:34:48.000Z'),
          position_start: 188618.965,
          position_end: 190262.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 6130,
        },
        {
          signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:34:48.000Z'),
          time_end: new Date('1900-01-01T14:35:15.000Z'),
          position_start: 188618.965,
          position_end: 190262.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 6130,
        },
        {
          signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:34:38.000Z'),
          time_end: new Date('1900-01-01T14:34:44.000Z'),
          position_start: 190262.965,
          position_end: 191951.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca4278-6667-11e3-81ff-01f464e0362d',
          track_offset: 264,
        },
        {
          signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:34:44.000Z'),
          time_end: new Date('1900-01-01T14:35:15.000Z'),
          position_start: 190262.965,
          position_end: 191951.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca4278-6667-11e3-81ff-01f464e0362d',
          track_offset: 264,
        },
        {
          signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:35:15.000Z'),
          time_end: new Date('1900-01-01T14:35:47.000Z'),
          position_start: 190262.965,
          position_end: 191951.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca4278-6667-11e3-81ff-01f464e0362d',
          track_offset: 264,
        },
        {
          signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:35:05.000Z'),
          time_end: new Date('1900-01-01T14:35:12.000Z'),
          position_start: 191951.965,
          position_end: 193883.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 1085,
        },
        {
          signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:35:12.000Z'),
          time_end: new Date('1900-01-01T14:35:47.000Z'),
          position_start: 191951.965,
          position_end: 193883.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 1085,
        },
        {
          signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:35:47.000Z'),
          time_end: new Date('1900-01-01T14:36:19.000Z'),
          position_start: 191951.965,
          position_end: 193883.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 1085,
        },
        {
          signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:35:37.000Z'),
          time_end: new Date('1900-01-01T14:35:44.000Z'),
          position_start: 193883.965,
          position_end: 195838.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 3017,
        },
        {
          signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:35:44.000Z'),
          time_end: new Date('1900-01-01T14:36:19.000Z'),
          position_start: 193883.965,
          position_end: 195838.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 3017,
        },
        {
          signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:36:19.000Z'),
          time_end: new Date('1900-01-01T14:36:46.000Z'),
          position_start: 193883.965,
          position_end: 195838.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 3017,
        },
        {
          signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:36:09.000Z'),
          time_end: new Date('1900-01-01T14:36:16.000Z'),
          position_start: 195838.965,
          position_end: 197501.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 4972,
        },
        {
          signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:36:16.000Z'),
          time_end: new Date('1900-01-01T14:36:46.000Z'),
          position_start: 195838.965,
          position_end: 197501.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 4972,
        },
        {
          signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:36:46.000Z'),
          time_end: new Date('1900-01-01T14:37:20.000Z'),
          position_start: 195838.965,
          position_end: 197501.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 4972,
        },
        {
          signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:36:36.000Z'),
          time_end: new Date('1900-01-01T14:36:43.000Z'),
          position_start: 197501.965,
          position_end: 199088.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 6635,
        },
        {
          signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:36:43.000Z'),
          time_end: new Date('1900-01-01T14:37:20.000Z'),
          position_start: 197501.965,
          position_end: 199088.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 6635,
        },
        {
          signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:37:20.000Z'),
          time_end: new Date('1900-01-01T14:37:46.000Z'),
          position_start: 197501.965,
          position_end: 199088.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 6635,
        },
        {
          signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:37:06.000Z'),
          time_end: new Date('1900-01-01T14:37:15.000Z'),
          position_start: 199088.965,
          position_end: 199992.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 8222,
        },
        {
          signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:37:15.000Z'),
          time_end: new Date('1900-01-01T14:37:46.000Z'),
          position_start: 199088.965,
          position_end: 199992.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 8222,
        },
        {
          signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:37:46.000Z'),
          time_end: new Date('1900-01-01T14:38:11.000Z'),
          position_start: 199088.965,
          position_end: 199992.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 8222,
        },
        {
          signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:37:28.000Z'),
          time_end: new Date('1900-01-01T14:37:39.000Z'),
          position_start: 199992.965,
          position_end: 200671.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
          track_offset: 684,
        },
        {
          signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:37:39.000Z'),
          time_end: new Date('1900-01-01T14:38:11.000Z'),
          position_start: 199992.965,
          position_end: 200671.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
          track_offset: 684,
        },
        {
          signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:38:11.000Z'),
          time_end: new Date('1900-01-01T14:38:59.000Z'),
          position_start: 199992.965,
          position_end: 200671.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
          track_offset: 684,
        },
        {
          signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:37:49.000Z'),
          time_end: new Date('1900-01-01T14:38:03.000Z'),
          position_start: 200671.965,
          position_end: 201657.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
          track_offset: 12,
        },
        {
          signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:38:03.000Z'),
          time_end: new Date('1900-01-01T14:38:59.000Z'),
          position_start: 200671.965,
          position_end: 201657.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
          track_offset: 12,
        },
        {
          signal_id: 'b564cfd6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T13:50:39.000Z'),
          time_end: new Date('1900-01-01T14:38:59.000Z'),
          position_start: 201657.965,
          position_end: 201657.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '6058b958-6667-11e3-81ff-01f464e0362d',
          track_offset: 705,
        },
      ],
      signalAspects: [],
      speed: [
        {
          time: new Date('1900-01-01T13:50:39.000Z'),
          position: 0,
          speed: 0,
        },
        {
          time: new Date('1900-01-01T13:50:41.000Z'),
          position: 0.9490586448983088,
          speed: 0.9490586448983088,
        },
        {
          time: new Date('1900-01-01T13:50:43.000Z'),
          position: 3.7876080685882414,
          speed: 1.8894907787916235,
        },
        {
          time: new Date('1900-01-01T13:50:47.000Z'),
          position: 15.08768165223028,
          speed: 3.7585662853925057,
        },
        {
          time: new Date('1900-01-01T13:50:51.000Z'),
          position: 33.83214516120702,
          speed: 5.6116489504209675,
        },
        {
          time: new Date('1900-01-01T13:50:57.000Z'),
          position: 75.76573617868836,
          speed: 8.360738040262225,
        },
        {
          time: new Date('1900-01-01T13:51:01.000Z'),
          position: 112.836826916906,
          speed: 10.17270700575389,
        },
        {
          time: new Date('1900-01-01T13:51:07.000Z'),
          position: 181.96120792333537,
          speed: 12.86480037753732,
        },
        {
          time: new Date('1900-01-01T13:51:15.000Z'),
          position: 308.55995765996323,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T13:51:48.000Z'),
          position: 855.965,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T13:51:51.000Z'),
          position: 908.6938467914624,
          speed: 17.94572180176421,
        },
        {
          time: new Date('1900-01-01T13:51:54.000Z'),
          position: 952.965,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T13:52:36.000Z'),
          position: 1660.965,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T13:52:48.000Z'),
          position: 1887.858671857618,
          speed: 21.056336905724773,
        },
        {
          time: new Date('1900-01-01T13:52:58.000Z'),
          position: 2113.090781464639,
          speed: 23.80534114707529,
        },
        {
          time: new Date('1900-01-01T13:53:10.000Z'),
          position: 2413.029828495464,
          speed: 26.105668045905404,
        },
        {
          time: new Date('1900-01-01T13:53:31.000Z'),
          position: 2996.3655202844907,
          speed: 29.641178784176407,
        },
        {
          time: new Date('1900-01-01T13:53:40.000Z'),
          position: 3249.965,
          speed: 25,
        },
        {
          time: new Date('1900-01-01T13:53:55.000Z'),
          position: 3616.965,
          speed: 25,
        },
        {
          time: new Date('1900-01-01T13:54:25.000Z'),
          position: 4459.229607497612,
          speed: 31.345374805946133,
        },
        {
          time: new Date('1900-01-01T13:54:41.000Z'),
          position: 4987.250326566449,
          speed: 34.61553198154361,
        },
        {
          time: new Date('1900-01-01T13:54:55.000Z'),
          position: 5490.174913149777,
          speed: 37.17209736732895,
        },
        {
          time: new Date('1900-01-01T13:55:09.000Z'),
          position: 6026.6744400508705,
          speed: 39.45240892712816,
        },
        {
          time: new Date('1900-01-01T13:55:21.000Z'),
          position: 6521.178532726996,
          speed: 43.07577255246863,
        },
        {
          time: new Date('1900-01-01T13:55:25.000Z'),
          position: 6693.960154849802,
          speed: 43.33322615807421,
        },
        {
          time: new Date('1900-01-01T13:55:33.000Z'),
          position: 7046.075111813276,
          speed: 44.70812670813125,
        },
        {
          time: new Date('1900-01-01T13:55:37.000Z'),
          position: 7225.23599945501,
          speed: 44.77339358281161,
        },
        {
          time: new Date('1900-01-01T13:55:53.000Z'),
          position: 7932.902880120726,
          speed: 43.69624472410094,
        },
        {
          time: new Date('1900-01-01T13:56:13.000Z'),
          position: 8783.682799773613,
          speed: 41.324123750709546,
        },
        {
          time: new Date('1900-01-01T13:56:19.000Z'),
          position: 9036.004387683512,
          speed: 42.89585277574626,
        },
        {
          time: new Date('1900-01-01T13:56:31.000Z'),
          position: 9578.5172191259,
          speed: 47.55163379646402,
        },
        {
          time: new Date('1900-01-01T13:56:47.000Z'),
          position: 10380.54788310116,
          speed: 52.69311822784173,
        },
        {
          time: new Date('1900-01-01T13:56:54.000Z'),
          position: 10761.627312665774,
          speed: 55.55555555555556,
        },
        {
          time: new Date('1900-01-01T13:58:18.000Z'),
          position: 15453.965,
          speed: 55.55555555555556,
        },
        {
          time: new Date('1900-01-01T13:58:32.000Z'),
          position: 16263.167336376571,
          speed: 59.85825428880899,
        },
        {
          time: new Date('1900-01-01T13:58:40.000Z'),
          position: 16748.723176299554,
          speed: 61.38572431306721,
        },
        {
          time: new Date('1900-01-01T13:59:00.000Z'),
          position: 17999.134634225047,
          speed: 63.69031321436226,
        },
        {
          time: new Date('1900-01-01T13:59:14.000Z'),
          position: 18895.395244128296,
          speed: 64.48409205077189,
        },
        {
          time: new Date('1900-01-01T13:59:20.000Z'),
          position: 19286.141310948067,
          speed: 65.7013819681295,
        },
        {
          time: new Date('1900-01-01T13:59:42.000Z'),
          position: 20767.50609335596,
          speed: 68.96061864834742,
        },
        {
          time: new Date('1900-01-01T14:00:02.000Z'),
          position: 22189.116288063826,
          speed: 73.16914241504898,
        },
        {
          time: new Date('1900-01-01T14:00:20.000Z'),
          position: 23537.4561097713,
          speed: 76.59368700768825,
        },
        {
          time: new Date('1900-01-01T14:00:26.000Z'),
          position: 23999.409845542636,
          speed: 77.21262710092336,
        },
        {
          time: new Date('1900-01-01T14:00:34.000Z'),
          position: 24614.388639609148,
          speed: 76.54905821591642,
        },
        {
          time: new Date('1900-01-01T14:00:50.000Z'),
          position: 25848.712308372487,
          speed: 77.81157209750988,
        },
        {
          time: new Date('1900-01-01T14:01:00.000Z'),
          position: 26629.081230660693,
          speed: 78.22486444596254,
        },
        {
          time: new Date('1900-01-01T14:01:18.000Z'),
          position: 28062.013071366036,
          speed: 81.07716031674254,
        },
        {
          time: new Date('1900-01-01T14:01:27.000Z'),
          position: 28724.57556097535,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:02:02.000Z'),
          position: 31709.6308858811,
          speed: 83.33255254776554,
        },
        {
          time: new Date('1900-01-01T14:02:10.000Z'),
          position: 32373.97423797496,
          speed: 82.84657929799457,
        },
        {
          time: new Date('1900-01-01T14:02:15.000Z'),
          position: 32745.1422452447,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:02:47.000Z'),
          position: 35441.63166666664,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:02:59.000Z'),
          position: 36436.43850406896,
          speed: 82.46245470354208,
        },
        {
          time: new Date('1900-01-01T14:03:07.000Z'),
          position: 37068.449156007664,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:03:55.000Z'),
          position: 41050.63042815859,
          speed: 83.33209482526631,
        },
        {
          time: new Date('1900-01-01T14:04:05.000Z'),
          position: 41881.54119684637,
          speed: 82.85385166361458,
        },
        {
          time: new Date('1900-01-01T14:04:09.000Z'),
          position: 42213.107803883555,
          speed: 82.99070178839779,
        },
        {
          time: new Date('1900-01-01T14:04:15.000Z'),
          position: 42709.14184618783,
          speed: 82.33330657037375,
        },
        {
          time: new Date('1900-01-01T14:04:19.000Z'),
          position: 43038.745036132226,
          speed: 82.5128013855045,
        },
        {
          time: new Date('1900-01-01T14:04:37.000Z'),
          position: 44518.880928441264,
          speed: 81.9430736672955,
        },
        {
          time: new Date('1900-01-01T14:04:45.000Z'),
          position: 45176.816922214144,
          speed: 82.6780265594408,
        },
        {
          time: new Date('1900-01-01T14:04:48.000Z'),
          position: 45487.18384380568,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:08:21.000Z'),
          position: 63245.63166666665,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:08:35.000Z'),
          position: 64395.74223491244,
          speed: 80.90874120181111,
        },
        {
          time: new Date('1900-01-01T14:08:49.000Z'),
          position: 65534.83908186208,
          speed: 81.87944083610552,
        },
        {
          time: new Date('1900-01-01T14:09:02.000Z'),
          position: 66559.3299787296,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:14:24.000Z'),
          position: 93390.965,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:14:38.000Z'),
          position: 94544.84906853344,
          speed: 81.3434987537168,
        },
        {
          time: new Date('1900-01-01T14:14:51.000Z'),
          position: 95661.12432035248,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:17:45.000Z'),
          position: 110117.29833333335,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:17:57.000Z'),
          position: 111112.8984723236,
          speed: 82.65687277733876,
        },
        {
          time: new Date('1900-01-01T14:18:03.000Z'),
          position: 111614.85804368171,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:21:58.000Z'),
          position: 131190.965,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:22:12.000Z'),
          position: 132346.46010255828,
          speed: 81.53146243137134,
        },
        {
          time: new Date('1900-01-01T14:22:27.000Z'),
          position: 133592.0894357146,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:22:54.000Z'),
          position: 135859.63166666662,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:23:00.000Z'),
          position: 136357.82622933082,
          speed: 82.6938108810291,
        },
        {
          time: new Date('1900-01-01T14:23:07.000Z'),
          position: 136961.33569717835,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:28:00.000Z'),
          position: 161338.29833333325,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:28:08.000Z'),
          position: 162003.15432985823,
          speed: 82.9128855540673,
        },
        {
          time: new Date('1900-01-01T14:28:12.000Z'),
          position: 162328.99181158727,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:30:52.000Z'),
          position: 175641.2977278311,
          speed: 83.33272783120943,
        },
        {
          time: new Date('1900-01-01T14:30:52.000Z'),
          position: 175708.57652478074,
          speed: 83.2943958286144,
        },
        {
          time: new Date('1900-01-01T14:30:57.000Z'),
          position: 176067.52055555562,
          speed: 81.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:31:13.000Z'),
          position: 177301.29833333337,
          speed: 73.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:31:25.000Z'),
          position: 178142.63166666668,
          speed: 67.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:31:37.000Z'),
          position: 178911.965,
          speed: 61.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:31:53.000Z'),
          position: 179903.68796172203,
          speed: 61.05629505542252,
        },
        {
          time: new Date('1900-01-01T14:32:35.000Z'),
          position: 182410.6124384856,
          speed: 58.3752119619226,
        },
        {
          time: new Date('1900-01-01T14:33:14.000Z'),
          position: 184715.50716255856,
          speed: 61.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:36:36.000Z'),
          position: 197084.7427777777,
          speed: 61.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:36:46.000Z'),
          position: 197695.74277777772,
          speed: 55.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:36:58.000Z'),
          position: 198330.4094444444,
          speed: 49.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:37:08.000Z'),
          position: 198804.2983333333,
          speed: 44.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:37:20.000Z'),
          position: 199306.965,
          speed: 38.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:37:25.000Z'),
          position: 199468.2242592592,
          speed: 38.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:37:35.000Z'),
          position: 199839.63166666665,
          speed: 33.77777777777778,
        },
        {
          time: new Date('1900-01-01T14:37:47.000Z'),
          position: 200208.965,
          speed: 27.77777777777778,
        },
        {
          time: new Date('1900-01-01T14:38:02.000Z'),
          position: 200637.0020617284,
          speed: 27.77777777777778,
        },
        {
          time: new Date('1900-01-01T14:38:10.000Z'),
          position: 200832.607,
          speed: 24,
        },
        {
          time: new Date('1900-01-01T14:38:16.000Z'),
          position: 200967.607,
          speed: 21,
        },
        {
          time: new Date('1900-01-01T14:38:22.000Z'),
          position: 201084.607,
          speed: 18,
        },
        {
          time: new Date('1900-01-01T14:38:30.000Z'),
          position: 201212.607,
          speed: 14,
        },
        {
          time: new Date('1900-01-01T14:38:36.000Z'),
          position: 201287.607,
          speed: 11,
        },
        {
          time: new Date('1900-01-01T14:38:40.000Z'),
          position: 201327.607,
          speed: 9,
        },
        {
          time: new Date('1900-01-01T14:38:44.000Z'),
          position: 201359.607,
          speed: 7,
        },
        {
          time: new Date('1900-01-01T14:38:50.000Z'),
          position: 201392.607,
          speed: 4,
        },
        {
          time: new Date('1900-01-01T14:38:54.000Z'),
          position: 201404.607,
          speed: 2,
        },
        {
          time: new Date('1900-01-01T14:38:56.000Z'),
          position: 201407.607,
          speed: 1,
        },
        {
          time: new Date('1900-01-01T14:38:59.000Z'),
          position: 201408.607,
          speed: 0,
        },
      ],
    },
    {
      id: 11,
      name: 'sample 3',
      headPosition: [
        [
          {
            time: new Date('1900-01-01T14:05:39.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:05:47.000Z'),
            position: 15.087681652230287,
          },
          {
            time: new Date('1900-01-01T14:05:55.000Z'),
            position: 59.95650969166121,
          },
          {
            time: new Date('1900-01-01T14:06:03.000Z'),
            position: 134.0825421380268,
          },
          {
            time: new Date('1900-01-01T14:06:11.000Z'),
            position: 236.98839247875625,
          },
          {
            time: new Date('1900-01-01T14:07:36.000Z'),
            position: 1660.9650000000001,
          },
          {
            time: new Date('1900-01-01T14:07:42.000Z'),
            position: 1767.7780072292762,
          },
          {
            time: new Date('1900-01-01T14:07:50.000Z'),
            position: 1930.6174571559138,
          },
          {
            time: new Date('1900-01-01T14:08:00.000Z'),
            position: 2161.1275570966345,
          },
          {
            time: new Date('1900-01-01T14:08:10.000Z'),
            position: 2413.0298284954642,
          },
          {
            time: new Date('1900-01-01T14:08:22.000Z'),
            position: 2738.1398383195615,
          },
          {
            time: new Date('1900-01-01T14:08:36.000Z'),
            position: 3145.965,
          },
          {
            time: new Date('1900-01-01T14:09:01.000Z'),
            position: 3770.858012400591,
          },
          {
            time: new Date('1900-01-01T14:09:15.000Z'),
            position: 4156.964371844142,
          },
          {
            time: new Date('1900-01-01T14:09:25.000Z'),
            position: 4459.229607497612,
          },
          {
            time: new Date('1900-01-01T14:09:37.000Z'),
            position: 4850.376521303067,
          },
          {
            time: new Date('1900-01-01T14:09:49.000Z'),
            position: 5270.281282169671,
          },
          {
            time: new Date('1900-01-01T14:10:01.000Z'),
            position: 5716.242002875245,
          },
          {
            time: new Date('1900-01-01T14:10:11.000Z'),
            position: 6106.035980221415,
          },
          {
            time: new Date('1900-01-01T14:10:19.000Z'),
            position: 6435.579634345027,
          },
          {
            time: new Date('1900-01-01T14:10:29.000Z'),
            position: 6868.595781383138,
          },
          {
            time: new Date('1900-01-01T14:10:55.000Z'),
            position: 8020.071253348365,
          },
          {
            time: new Date('1900-01-01T14:11:23.000Z'),
            position: 9210.531491201365,
          },
          {
            time: new Date('1900-01-01T14:11:29.000Z'),
            position: 9484.128166707702,
          },
          {
            time: new Date('1900-01-01T14:11:35.000Z'),
            position: 9771.392110422634,
          },
          {
            time: new Date('1900-01-01T14:11:43.000Z'),
            position: 10172.427180640114,
          },
          {
            time: new Date('1900-01-01T14:11:49.000Z'),
            position: 10486.693547932831,
          },
          {
            time: new Date('1900-01-01T14:13:18.000Z'),
            position: 15453.965,
          },
          {
            time: new Date('1900-01-01T14:13:24.000Z'),
            position: 15793.311759016024,
          },
          {
            time: new Date('1900-01-01T14:13:30.000Z'),
            position: 16143.99757989964,
          },
          {
            time: new Date('1900-01-01T14:13:40.000Z'),
            position: 16748.723176299554,
          },
          {
            time: new Date('1900-01-01T14:13:50.000Z'),
            position: 17368.41050165773,
          },
          {
            time: new Date('1900-01-01T14:14:12.000Z'),
            position: 18766.6763033138,
          },
          {
            time: new Date('1900-01-01T14:14:20.000Z'),
            position: 19286.141310948067,
          },
          {
            time: new Date('1900-01-01T14:14:28.000Z'),
            position: 19816.618864989814,
          },
          {
            time: new Date('1900-01-01T14:14:44.000Z'),
            position: 20905.824840111123,
          },
          {
            time: new Date('1900-01-01T14:14:52.000Z'),
            position: 21467.64995775713,
          },
          {
            time: new Date('1900-01-01T14:15:02.000Z'),
            position: 22189.116288063826,
          },
          {
            time: new Date('1900-01-01T14:15:10.000Z'),
            position: 22780.758499968604,
          },
          {
            time: new Date('1900-01-01T14:15:20.000Z'),
            position: 23537.4561097713,
          },
          {
            time: new Date('1900-01-01T14:15:46.000Z'),
            position: 25538.497935155963,
          },
          {
            time: new Date('1900-01-01T14:16:02.000Z'),
            position: 26785.73730604492,
          },
          {
            time: new Date('1900-01-01T14:16:14.000Z'),
            position: 27738.84707111232,
          },
          {
            time: new Date('1900-01-01T14:16:24.000Z'),
            position: 28553.034185602537,
          },
          {
            time: new Date('1900-01-01T14:19:01.000Z'),
            position: 41549.750324835055,
          },
          {
            time: new Date('1900-01-01T14:19:48.000Z'),
            position: 45487.18384380568,
          },
          {
            time: new Date('1900-01-01T14:23:23.000Z'),
            position: 63412.01822058594,
          },
          {
            time: new Date('1900-01-01T14:23:31.000Z'),
            position: 64070.69104510256,
          },
          {
            time: new Date('1900-01-01T14:23:49.000Z'),
            position: 65534.839081862076,
          },
          {
            time: new Date('1900-01-01T14:24:01.000Z'),
            position: 66525.77093593446,
          },
          {
            time: new Date('1900-01-01T14:29:24.000Z'),
            position: 93390.965,
          },
          {
            time: new Date('1900-01-01T14:29:51.000Z'),
            position: 95661.12432035248,
          },
          {
            time: new Date('1900-01-01T14:36:58.000Z'),
            position: 131190.965,
          },
          {
            time: new Date('1900-01-01T14:37:24.000Z'),
            position: 133333.25559366634,
          },
          {
            time: new Date('1900-01-01T14:38:07.000Z'),
            position: 136961.33569717835,
          },
          {
            time: new Date('1900-01-01T14:45:52.000Z'),
            position: 175708.57652478074,
          },
          {
            time: new Date('1900-01-01T14:45:59.000Z'),
            position: 176228.74277777784,
          },
          {
            time: new Date('1900-01-01T14:46:05.000Z'),
            position: 176700.4094444445,
          },
          {
            time: new Date('1900-01-01T14:46:13.000Z'),
            position: 177301.29833333337,
          },
          {
            time: new Date('1900-01-01T14:46:21.000Z'),
            position: 177870.18722222224,
          },
          {
            time: new Date('1900-01-01T14:46:29.000Z'),
            position: 178407.07611111112,
          },
          {
            time: new Date('1900-01-01T14:46:37.000Z'),
            position: 178911.965,
          },
          {
            time: new Date('1900-01-01T14:46:57.000Z'),
            position: 180147.2705093627,
          },
          {
            time: new Date('1900-01-01T14:47:11.000Z'),
            position: 180991.56898009698,
          },
          {
            time: new Date('1900-01-01T14:47:25.000Z'),
            position: 181823.81089114814,
          },
          {
            time: new Date('1900-01-01T14:47:49.000Z'),
            position: 183234.1939976445,
          },
          {
            time: new Date('1900-01-01T14:48:09.000Z'),
            position: 184435.50229204967,
          },
          {
            time: new Date('1900-01-01T14:51:36.000Z'),
            position: 197111.8538888888,
          },
          {
            time: new Date('1900-01-01T14:51:44.000Z'),
            position: 197582.96499999994,
          },
          {
            time: new Date('1900-01-01T14:51:48.000Z'),
            position: 197806.5205555555,
          },
          {
            time: new Date('1900-01-01T14:51:54.000Z'),
            position: 198126.85388888884,
          },
          {
            time: new Date('1900-01-01T14:52:02.000Z'),
            position: 198525.96499999997,
          },
          {
            time: new Date('1900-01-01T14:52:10.000Z'),
            position: 198893.0761111111,
          },
          {
            time: new Date('1900-01-01T14:52:18.000Z'),
            position: 199228.18722222222,
          },
          {
            time: new Date('1900-01-01T14:52:29.000Z'),
            position: 199627.96499999994,
          },
          {
            time: new Date('1900-01-01T14:52:35.000Z'),
            position: 199839.63166666662,
          },
          {
            time: new Date('1900-01-01T14:52:43.000Z'),
            position: 200093.85388888887,
          },
          {
            time: new Date('1900-01-01T14:53:06.000Z'),
            position: 200732.607,
          },
          {
            time: new Date('1900-01-01T14:53:12.000Z'),
            position: 200879.607,
          },
          {
            time: new Date('1900-01-01T14:53:18.000Z'),
            position: 201008.607,
          },
          {
            time: new Date('1900-01-01T14:53:24.000Z'),
            position: 201119.607,
          },
          {
            time: new Date('1900-01-01T14:53:32.000Z'),
            position: 201239.607,
          },
          {
            time: new Date('1900-01-01T14:53:38.000Z'),
            position: 201308.607,
          },
          {
            time: new Date('1900-01-01T14:53:46.000Z'),
            position: 201372.607,
          },
          {
            time: new Date('1900-01-01T14:53:52.000Z'),
            position: 201399.607,
          },
          {
            time: new Date('1900-01-01T14:53:59.000Z'),
            position: 201408.607,
          },
        ],
      ],
      tailPosition: [
        [
          {
            time: new Date('1900-01-01T14:05:39.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:05:47.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:05:55.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:06:03.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:06:11.000Z'),
            position: 36.98839247875625,
          },
          {
            time: new Date('1900-01-01T14:07:36.000Z'),
            position: 1460.9650000000001,
          },
          {
            time: new Date('1900-01-01T14:07:42.000Z'),
            position: 1567.7780072292762,
          },
          {
            time: new Date('1900-01-01T14:07:50.000Z'),
            position: 1730.6174571559138,
          },
          {
            time: new Date('1900-01-01T14:08:00.000Z'),
            position: 1961.1275570966345,
          },
          {
            time: new Date('1900-01-01T14:08:10.000Z'),
            position: 2213.0298284954642,
          },
          {
            time: new Date('1900-01-01T14:08:22.000Z'),
            position: 2538.1398383195615,
          },
          {
            time: new Date('1900-01-01T14:08:36.000Z'),
            position: 2945.965,
          },
          {
            time: new Date('1900-01-01T14:09:01.000Z'),
            position: 3570.858012400591,
          },
          {
            time: new Date('1900-01-01T14:09:15.000Z'),
            position: 3956.964371844142,
          },
          {
            time: new Date('1900-01-01T14:09:25.000Z'),
            position: 4259.229607497612,
          },
          {
            time: new Date('1900-01-01T14:09:37.000Z'),
            position: 4650.376521303067,
          },
          {
            time: new Date('1900-01-01T14:09:49.000Z'),
            position: 5070.281282169671,
          },
          {
            time: new Date('1900-01-01T14:10:01.000Z'),
            position: 5516.242002875245,
          },
          {
            time: new Date('1900-01-01T14:10:11.000Z'),
            position: 5906.035980221415,
          },
          {
            time: new Date('1900-01-01T14:10:19.000Z'),
            position: 6235.579634345027,
          },
          {
            time: new Date('1900-01-01T14:10:29.000Z'),
            position: 6668.595781383138,
          },
          {
            time: new Date('1900-01-01T14:10:55.000Z'),
            position: 7820.071253348365,
          },
          {
            time: new Date('1900-01-01T14:11:23.000Z'),
            position: 9010.531491201365,
          },
          {
            time: new Date('1900-01-01T14:11:29.000Z'),
            position: 9284.128166707702,
          },
          {
            time: new Date('1900-01-01T14:11:35.000Z'),
            position: 9571.392110422634,
          },
          {
            time: new Date('1900-01-01T14:11:43.000Z'),
            position: 9972.427180640114,
          },
          {
            time: new Date('1900-01-01T14:11:49.000Z'),
            position: 10286.693547932831,
          },
          {
            time: new Date('1900-01-01T14:13:18.000Z'),
            position: 15253.965,
          },
          {
            time: new Date('1900-01-01T14:13:24.000Z'),
            position: 15593.311759016024,
          },
          {
            time: new Date('1900-01-01T14:13:30.000Z'),
            position: 15943.99757989964,
          },
          {
            time: new Date('1900-01-01T14:13:40.000Z'),
            position: 16548.723176299554,
          },
          {
            time: new Date('1900-01-01T14:13:50.000Z'),
            position: 17168.41050165773,
          },
          {
            time: new Date('1900-01-01T14:14:12.000Z'),
            position: 18566.6763033138,
          },
          {
            time: new Date('1900-01-01T14:14:20.000Z'),
            position: 19086.141310948067,
          },
          {
            time: new Date('1900-01-01T14:14:28.000Z'),
            position: 19616.618864989814,
          },
          {
            time: new Date('1900-01-01T14:14:44.000Z'),
            position: 20705.824840111123,
          },
          {
            time: new Date('1900-01-01T14:14:52.000Z'),
            position: 21267.64995775713,
          },
          {
            time: new Date('1900-01-01T14:15:02.000Z'),
            position: 21989.116288063826,
          },
          {
            time: new Date('1900-01-01T14:15:10.000Z'),
            position: 22580.758499968604,
          },
          {
            time: new Date('1900-01-01T14:15:20.000Z'),
            position: 23337.4561097713,
          },
          {
            time: new Date('1900-01-01T14:15:46.000Z'),
            position: 25338.497935155963,
          },
          {
            time: new Date('1900-01-01T14:16:02.000Z'),
            position: 26585.73730604492,
          },
          {
            time: new Date('1900-01-01T14:16:14.000Z'),
            position: 27538.84707111232,
          },
          {
            time: new Date('1900-01-01T14:16:24.000Z'),
            position: 28353.034185602537,
          },
          {
            time: new Date('1900-01-01T14:19:01.000Z'),
            position: 41349.750324835055,
          },
          {
            time: new Date('1900-01-01T14:19:48.000Z'),
            position: 45287.18384380568,
          },
          {
            time: new Date('1900-01-01T14:23:23.000Z'),
            position: 63212.01822058594,
          },
          {
            time: new Date('1900-01-01T14:23:31.000Z'),
            position: 63870.69104510256,
          },
          {
            time: new Date('1900-01-01T14:23:49.000Z'),
            position: 65334.839081862076,
          },
          {
            time: new Date('1900-01-01T14:24:01.000Z'),
            position: 66325.77093593446,
          },
          {
            time: new Date('1900-01-01T14:29:24.000Z'),
            position: 93190.965,
          },
          {
            time: new Date('1900-01-01T14:29:51.000Z'),
            position: 95461.12432035248,
          },
          {
            time: new Date('1900-01-01T14:36:58.000Z'),
            position: 130990.965,
          },
          {
            time: new Date('1900-01-01T14:37:24.000Z'),
            position: 133133.25559366634,
          },
          {
            time: new Date('1900-01-01T14:38:07.000Z'),
            position: 136761.33569717835,
          },
          {
            time: new Date('1900-01-01T14:45:52.000Z'),
            position: 175508.57652478074,
          },
          {
            time: new Date('1900-01-01T14:45:59.000Z'),
            position: 176028.74277777784,
          },
          {
            time: new Date('1900-01-01T14:46:05.000Z'),
            position: 176500.4094444445,
          },
          {
            time: new Date('1900-01-01T14:46:13.000Z'),
            position: 177101.29833333337,
          },
          {
            time: new Date('1900-01-01T14:46:21.000Z'),
            position: 177670.18722222224,
          },
          {
            time: new Date('1900-01-01T14:46:29.000Z'),
            position: 178207.07611111112,
          },
          {
            time: new Date('1900-01-01T14:46:37.000Z'),
            position: 178711.965,
          },
          {
            time: new Date('1900-01-01T14:46:57.000Z'),
            position: 179947.2705093627,
          },
          {
            time: new Date('1900-01-01T14:47:11.000Z'),
            position: 180791.56898009698,
          },
          {
            time: new Date('1900-01-01T14:47:25.000Z'),
            position: 181623.81089114814,
          },
          {
            time: new Date('1900-01-01T14:47:49.000Z'),
            position: 183034.1939976445,
          },
          {
            time: new Date('1900-01-01T14:48:09.000Z'),
            position: 184235.50229204967,
          },
          {
            time: new Date('1900-01-01T14:51:36.000Z'),
            position: 196911.8538888888,
          },
          {
            time: new Date('1900-01-01T14:51:44.000Z'),
            position: 197382.96499999994,
          },
          {
            time: new Date('1900-01-01T14:51:48.000Z'),
            position: 197606.5205555555,
          },
          {
            time: new Date('1900-01-01T14:51:54.000Z'),
            position: 197926.85388888884,
          },
          {
            time: new Date('1900-01-01T14:52:02.000Z'),
            position: 198325.96499999997,
          },
          {
            time: new Date('1900-01-01T14:52:10.000Z'),
            position: 198693.0761111111,
          },
          {
            time: new Date('1900-01-01T14:52:18.000Z'),
            position: 199028.18722222222,
          },
          {
            time: new Date('1900-01-01T14:52:29.000Z'),
            position: 199427.96499999994,
          },
          {
            time: new Date('1900-01-01T14:52:35.000Z'),
            position: 199639.63166666662,
          },
          {
            time: new Date('1900-01-01T14:52:43.000Z'),
            position: 199893.85388888887,
          },
          {
            time: new Date('1900-01-01T14:53:06.000Z'),
            position: 200532.607,
          },
          {
            time: new Date('1900-01-01T14:53:12.000Z'),
            position: 200679.607,
          },
          {
            time: new Date('1900-01-01T14:53:18.000Z'),
            position: 200808.607,
          },
          {
            time: new Date('1900-01-01T14:53:24.000Z'),
            position: 200919.607,
          },
          {
            time: new Date('1900-01-01T14:53:32.000Z'),
            position: 201039.607,
          },
          {
            time: new Date('1900-01-01T14:53:38.000Z'),
            position: 201108.607,
          },
          {
            time: new Date('1900-01-01T14:53:46.000Z'),
            position: 201172.607,
          },
          {
            time: new Date('1900-01-01T14:53:52.000Z'),
            position: 201199.607,
          },
          {
            time: new Date('1900-01-01T14:53:59.000Z'),
            position: 201208.607,
          },
        ],
      ],
      routeAspects: [
        {
          signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
          time_start: new Date('1900-01-01T14:05:39.000Z'),
          time_end: new Date('1900-01-01T14:06:16.000Z'),
          position_start: 320.965,
          position_end: 605.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '69ca947c-6667-11e3-81ff-01f464e0362d',
          track_offset: 496,
        },
        {
          signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
          time_start: new Date('1900-01-01T14:06:16.000Z'),
          time_end: new Date('1900-01-01T14:06:45.000Z'),
          position_start: 320.965,
          position_end: 605.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '69ca947c-6667-11e3-81ff-01f464e0362d',
          track_offset: 496,
        },
        {
          signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
          time_start: new Date('1900-01-01T14:06:45.000Z'),
          time_end: new Date('1900-01-01T14:07:33.000Z'),
          position_start: 320.965,
          position_end: 605.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '69ca947c-6667-11e3-81ff-01f464e0362d',
          track_offset: 496,
        },
        {
          signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:06:16.000Z'),
          time_end: new Date('1900-01-01T14:06:33.000Z'),
          position_start: 605.965,
          position_end: 1410.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60c895c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 51,
        },
        {
          signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:06:33.000Z'),
          time_end: new Date('1900-01-01T14:07:33.000Z'),
          position_start: 605.965,
          position_end: 1410.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60c895c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 51,
        },
        {
          signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:07:33.000Z'),
          time_end: new Date('1900-01-01T14:08:08.000Z'),
          position_start: 605.965,
          position_end: 1410.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60c895c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 51,
        },
        {
          signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:06:57.000Z'),
          time_end: new Date('1900-01-01T14:07:21.000Z'),
          position_start: 1410.965,
          position_end: 2157.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '61a60592-6667-11e3-81ff-01f464e0362d',
          track_offset: 358,
        },
        {
          signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:07:21.000Z'),
          time_end: new Date('1900-01-01T14:08:08.000Z'),
          position_start: 1410.965,
          position_end: 2157.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '61a60592-6667-11e3-81ff-01f464e0362d',
          track_offset: 358,
        },
        {
          signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:08:08.000Z'),
          time_end: new Date('1900-01-01T14:08:44.000Z'),
          position_start: 1410.965,
          position_end: 2157.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '61a60592-6667-11e3-81ff-01f464e0362d',
          track_offset: 358,
        },
        {
          signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:07:41.000Z'),
          time_end: new Date('1900-01-01T14:08:00.000Z'),
          position_start: 2157.965,
          position_end: 3139.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '61a460c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 248,
        },
        {
          signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:08:00.000Z'),
          time_end: new Date('1900-01-01T14:08:44.000Z'),
          position_start: 2157.965,
          position_end: 3139.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '61a460c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 248,
        },
        {
          signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:08:44.000Z'),
          time_end: new Date('1900-01-01T14:09:44.000Z'),
          position_start: 2157.965,
          position_end: 3139.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '61a460c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 248,
        },
        {
          signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:08:22.000Z'),
          time_end: new Date('1900-01-01T14:08:36.000Z'),
          position_start: 3139.965,
          position_end: 4890.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '61a465bc-6667-11e3-81ff-01f464e0362d',
          track_offset: 544,
        },
        {
          signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:08:36.000Z'),
          time_end: new Date('1900-01-01T14:09:44.000Z'),
          position_start: 3139.965,
          position_end: 4890.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '61a465bc-6667-11e3-81ff-01f464e0362d',
          track_offset: 544,
        },
        {
          signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:09:44.000Z'),
          time_end: new Date('1900-01-01T14:10:22.000Z'),
          position_start: 3139.965,
          position_end: 4890.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '61a465bc-6667-11e3-81ff-01f464e0362d',
          track_offset: 544,
        },
        {
          signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:09:26.000Z'),
          time_end: new Date('1900-01-01T14:09:38.000Z'),
          position_start: 4890.965,
          position_end: 6365.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8b696-6667-11e3-81ff-01f464e0362d',
          track_offset: 1393,
        },
        {
          signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:09:38.000Z'),
          time_end: new Date('1900-01-01T14:10:22.000Z'),
          position_start: 4890.965,
          position_end: 6365.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8b696-6667-11e3-81ff-01f464e0362d',
          track_offset: 1393,
        },
        {
          signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:10:22.000Z'),
          time_end: new Date('1900-01-01T14:11:15.000Z'),
          position_start: 4890.965,
          position_end: 6365.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8b696-6667-11e3-81ff-01f464e0362d',
          track_offset: 1393,
        },
        {
          signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:10:07.000Z'),
          time_end: new Date('1900-01-01T14:10:17.000Z'),
          position_start: 6365.965,
          position_end: 8655.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 869,
        },
        {
          signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:10:17.000Z'),
          time_end: new Date('1900-01-01T14:11:15.000Z'),
          position_start: 6365.965,
          position_end: 8655.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 869,
        },
        {
          signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:11:15.000Z'),
          time_end: new Date('1900-01-01T14:11:56.000Z'),
          position_start: 6365.965,
          position_end: 8655.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 869,
        },
        {
          signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:11:00.000Z'),
          time_end: new Date('1900-01-01T14:11:10.000Z'),
          position_start: 8655.965,
          position_end: 10695.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 3159,
        },
        {
          signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:11:10.000Z'),
          time_end: new Date('1900-01-01T14:11:56.000Z'),
          position_start: 8655.965,
          position_end: 10695.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 3159,
        },
        {
          signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:11:56.000Z'),
          time_end: new Date('1900-01-01T14:12:42.000Z'),
          position_start: 8655.965,
          position_end: 10695.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 3159,
        },
        {
          signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:11:45.000Z'),
          time_end: new Date('1900-01-01T14:11:53.000Z'),
          position_start: 10695.965,
          position_end: 13220.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 5199,
        },
        {
          signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:11:53.000Z'),
          time_end: new Date('1900-01-01T14:12:42.000Z'),
          position_start: 10695.965,
          position_end: 13220.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 5199,
        },
        {
          signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:12:42.000Z'),
          time_end: new Date('1900-01-01T14:13:20.000Z'),
          position_start: 10695.965,
          position_end: 13220.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 5199,
        },
        {
          signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:12:31.000Z'),
          time_end: new Date('1900-01-01T14:12:38.000Z'),
          position_start: 13220.965,
          position_end: 15353.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
          track_offset: 10,
        },
        {
          signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:12:38.000Z'),
          time_end: new Date('1900-01-01T14:13:20.000Z'),
          position_start: 13220.965,
          position_end: 15353.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
          track_offset: 10,
        },
        {
          signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:46:47.000Z'),
          time_end: new Date('1900-01-01T14:46:53.000Z'),
          position_start: 179935.965,
          position_end: 181568.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
          track_offset: 924,
        },
        {
          signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:46:53.000Z'),
          time_end: new Date('1900-01-01T14:47:24.000Z'),
          position_start: 179935.965,
          position_end: 181568.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
          track_offset: 924,
        },
        {
          signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:47:24.000Z'),
          time_end: new Date('1900-01-01T14:47:59.000Z'),
          position_start: 179935.965,
          position_end: 181568.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
          track_offset: 924,
        },
        {
          signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:47:14.000Z'),
          time_end: new Date('1900-01-01T14:47:21.000Z'),
          position_start: 181568.965,
          position_end: 183628.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
          track_offset: 235,
        },
        {
          signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:47:21.000Z'),
          time_end: new Date('1900-01-01T14:47:59.000Z'),
          position_start: 181568.965,
          position_end: 183628.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
          track_offset: 235,
        },
        {
          signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:47:59.000Z'),
          time_end: new Date('1900-01-01T14:48:26.000Z'),
          position_start: 181568.965,
          position_end: 183628.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
          track_offset: 235,
        },
        {
          signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:47:49.000Z'),
          time_end: new Date('1900-01-01T14:47:56.000Z'),
          position_start: 183628.965,
          position_end: 185298.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 1140,
        },
        {
          signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:47:56.000Z'),
          time_end: new Date('1900-01-01T14:48:26.000Z'),
          position_start: 183628.965,
          position_end: 185298.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 1140,
        },
        {
          signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:48:26.000Z'),
          time_end: new Date('1900-01-01T14:48:54.000Z'),
          position_start: 183628.965,
          position_end: 185298.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 1140,
        },
        {
          signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:48:17.000Z'),
          time_end: new Date('1900-01-01T14:48:23.000Z'),
          position_start: 185298.965,
          position_end: 186988.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 2810,
        },
        {
          signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:48:23.000Z'),
          time_end: new Date('1900-01-01T14:48:54.000Z'),
          position_start: 185298.965,
          position_end: 186988.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 2810,
        },
        {
          signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:48:54.000Z'),
          time_end: new Date('1900-01-01T14:49:21.000Z'),
          position_start: 185298.965,
          position_end: 186988.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 2810,
        },
        {
          signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:48:44.000Z'),
          time_end: new Date('1900-01-01T14:48:51.000Z'),
          position_start: 186988.965,
          position_end: 188618.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 4500,
        },
        {
          signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:48:51.000Z'),
          time_end: new Date('1900-01-01T14:49:21.000Z'),
          position_start: 186988.965,
          position_end: 188618.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 4500,
        },
        {
          signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:49:21.000Z'),
          time_end: new Date('1900-01-01T14:49:48.000Z'),
          position_start: 186988.965,
          position_end: 188618.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 4500,
        },
        {
          signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:49:11.000Z'),
          time_end: new Date('1900-01-01T14:49:17.000Z'),
          position_start: 188618.965,
          position_end: 190262.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 6130,
        },
        {
          signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:49:17.000Z'),
          time_end: new Date('1900-01-01T14:49:48.000Z'),
          position_start: 188618.965,
          position_end: 190262.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 6130,
        },
        {
          signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:49:48.000Z'),
          time_end: new Date('1900-01-01T14:50:15.000Z'),
          position_start: 188618.965,
          position_end: 190262.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 6130,
        },
        {
          signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:49:38.000Z'),
          time_end: new Date('1900-01-01T14:49:44.000Z'),
          position_start: 190262.965,
          position_end: 191951.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca4278-6667-11e3-81ff-01f464e0362d',
          track_offset: 264,
        },
        {
          signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:49:44.000Z'),
          time_end: new Date('1900-01-01T14:50:15.000Z'),
          position_start: 190262.965,
          position_end: 191951.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca4278-6667-11e3-81ff-01f464e0362d',
          track_offset: 264,
        },
        {
          signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:50:15.000Z'),
          time_end: new Date('1900-01-01T14:50:47.000Z'),
          position_start: 190262.965,
          position_end: 191951.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca4278-6667-11e3-81ff-01f464e0362d',
          track_offset: 264,
        },
        {
          signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:50:05.000Z'),
          time_end: new Date('1900-01-01T14:50:12.000Z'),
          position_start: 191951.965,
          position_end: 193883.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 1085,
        },
        {
          signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:50:12.000Z'),
          time_end: new Date('1900-01-01T14:50:47.000Z'),
          position_start: 191951.965,
          position_end: 193883.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 1085,
        },
        {
          signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:50:47.000Z'),
          time_end: new Date('1900-01-01T14:51:19.000Z'),
          position_start: 191951.965,
          position_end: 193883.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 1085,
        },
        {
          signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:50:37.000Z'),
          time_end: new Date('1900-01-01T14:50:44.000Z'),
          position_start: 193883.965,
          position_end: 195838.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 3017,
        },
        {
          signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:50:44.000Z'),
          time_end: new Date('1900-01-01T14:51:19.000Z'),
          position_start: 193883.965,
          position_end: 195838.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 3017,
        },
        {
          signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:51:19.000Z'),
          time_end: new Date('1900-01-01T14:51:46.000Z'),
          position_start: 193883.965,
          position_end: 195838.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 3017,
        },
        {
          signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:51:09.000Z'),
          time_end: new Date('1900-01-01T14:51:16.000Z'),
          position_start: 195838.965,
          position_end: 197501.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 4972,
        },
        {
          signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:51:16.000Z'),
          time_end: new Date('1900-01-01T14:51:46.000Z'),
          position_start: 195838.965,
          position_end: 197501.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 4972,
        },
        {
          signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:51:46.000Z'),
          time_end: new Date('1900-01-01T14:52:20.000Z'),
          position_start: 195838.965,
          position_end: 197501.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 4972,
        },
        {
          signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:51:36.000Z'),
          time_end: new Date('1900-01-01T14:51:43.000Z'),
          position_start: 197501.965,
          position_end: 199088.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 6635,
        },
        {
          signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:51:43.000Z'),
          time_end: new Date('1900-01-01T14:52:20.000Z'),
          position_start: 197501.965,
          position_end: 199088.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 6635,
        },
        {
          signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:52:20.000Z'),
          time_end: new Date('1900-01-01T14:52:46.000Z'),
          position_start: 197501.965,
          position_end: 199088.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 6635,
        },
        {
          signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:52:06.000Z'),
          time_end: new Date('1900-01-01T14:52:15.000Z'),
          position_start: 199088.965,
          position_end: 199992.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 8222,
        },
        {
          signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:52:15.000Z'),
          time_end: new Date('1900-01-01T14:52:46.000Z'),
          position_start: 199088.965,
          position_end: 199992.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 8222,
        },
        {
          signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:52:46.000Z'),
          time_end: new Date('1900-01-01T14:53:11.000Z'),
          position_start: 199088.965,
          position_end: 199992.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 8222,
        },
        {
          signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:52:28.000Z'),
          time_end: new Date('1900-01-01T14:52:39.000Z'),
          position_start: 199992.965,
          position_end: 200671.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
          track_offset: 684,
        },
        {
          signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:52:39.000Z'),
          time_end: new Date('1900-01-01T14:53:11.000Z'),
          position_start: 199992.965,
          position_end: 200671.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
          track_offset: 684,
        },
        {
          signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:53:11.000Z'),
          time_end: new Date('1900-01-01T14:53:59.000Z'),
          position_start: 199992.965,
          position_end: 200671.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
          track_offset: 684,
        },
        {
          signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:52:49.000Z'),
          time_end: new Date('1900-01-01T14:53:03.000Z'),
          position_start: 200671.965,
          position_end: 201657.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
          track_offset: 12,
        },
        {
          signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:53:03.000Z'),
          time_end: new Date('1900-01-01T14:53:59.000Z'),
          position_start: 200671.965,
          position_end: 201657.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
          track_offset: 12,
        },
        {
          signal_id: 'b564cfd6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:05:39.000Z'),
          time_end: new Date('1900-01-01T14:53:59.000Z'),
          position_start: 201657.965,
          position_end: 201657.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '6058b958-6667-11e3-81ff-01f464e0362d',
          track_offset: 705,
        },
      ],
      signalAspects: [],
      speed: [
        {
          time: new Date('1900-01-01T14:05:39.000Z'),
          position: 0,
          speed: 0,
        },
        {
          time: new Date('1900-01-01T14:05:41.000Z'),
          position: 0.9490586448983088,
          speed: 0.9490586448983088,
        },
        {
          time: new Date('1900-01-01T14:05:43.000Z'),
          position: 3.7876080685882414,
          speed: 1.8894907787916235,
        },
        {
          time: new Date('1900-01-01T14:05:47.000Z'),
          position: 15.08768165223028,
          speed: 3.7585662853925057,
        },
        {
          time: new Date('1900-01-01T14:05:51.000Z'),
          position: 33.83214516120702,
          speed: 5.6116489504209675,
        },
        {
          time: new Date('1900-01-01T14:05:57.000Z'),
          position: 75.76573617868836,
          speed: 8.360738040262225,
        },
        {
          time: new Date('1900-01-01T14:06:01.000Z'),
          position: 112.836826916906,
          speed: 10.17270700575389,
        },
        {
          time: new Date('1900-01-01T14:06:07.000Z'),
          position: 181.96120792333537,
          speed: 12.86480037753732,
        },
        {
          time: new Date('1900-01-01T14:06:15.000Z'),
          position: 308.55995765996323,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T14:06:48.000Z'),
          position: 855.965,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T14:06:51.000Z'),
          position: 908.6938467914624,
          speed: 17.94572180176421,
        },
        {
          time: new Date('1900-01-01T14:06:54.000Z'),
          position: 952.965,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T14:07:36.000Z'),
          position: 1660.965,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T14:07:48.000Z'),
          position: 1887.858671857618,
          speed: 21.056336905724773,
        },
        {
          time: new Date('1900-01-01T14:07:58.000Z'),
          position: 2113.090781464639,
          speed: 23.80534114707529,
        },
        {
          time: new Date('1900-01-01T14:08:10.000Z'),
          position: 2413.029828495464,
          speed: 26.105668045905404,
        },
        {
          time: new Date('1900-01-01T14:08:31.000Z'),
          position: 2996.3655202844907,
          speed: 29.641178784176407,
        },
        {
          time: new Date('1900-01-01T14:08:40.000Z'),
          position: 3249.965,
          speed: 25,
        },
        {
          time: new Date('1900-01-01T14:08:55.000Z'),
          position: 3616.965,
          speed: 25,
        },
        {
          time: new Date('1900-01-01T14:09:25.000Z'),
          position: 4459.229607497612,
          speed: 31.345374805946133,
        },
        {
          time: new Date('1900-01-01T14:09:41.000Z'),
          position: 4987.250326566449,
          speed: 34.61553198154361,
        },
        {
          time: new Date('1900-01-01T14:09:55.000Z'),
          position: 5490.174913149777,
          speed: 37.17209736732895,
        },
        {
          time: new Date('1900-01-01T14:10:09.000Z'),
          position: 6026.6744400508705,
          speed: 39.45240892712816,
        },
        {
          time: new Date('1900-01-01T14:10:21.000Z'),
          position: 6521.178532726996,
          speed: 43.07577255246863,
        },
        {
          time: new Date('1900-01-01T14:10:25.000Z'),
          position: 6693.960154849802,
          speed: 43.33322615807421,
        },
        {
          time: new Date('1900-01-01T14:10:33.000Z'),
          position: 7046.075111813276,
          speed: 44.70812670813125,
        },
        {
          time: new Date('1900-01-01T14:10:37.000Z'),
          position: 7225.23599945501,
          speed: 44.77339358281161,
        },
        {
          time: new Date('1900-01-01T14:10:53.000Z'),
          position: 7932.902880120726,
          speed: 43.69624472410094,
        },
        {
          time: new Date('1900-01-01T14:11:13.000Z'),
          position: 8783.682799773613,
          speed: 41.324123750709546,
        },
        {
          time: new Date('1900-01-01T14:11:19.000Z'),
          position: 9036.004387683512,
          speed: 42.89585277574626,
        },
        {
          time: new Date('1900-01-01T14:11:31.000Z'),
          position: 9578.5172191259,
          speed: 47.55163379646402,
        },
        {
          time: new Date('1900-01-01T14:11:47.000Z'),
          position: 10380.54788310116,
          speed: 52.69311822784173,
        },
        {
          time: new Date('1900-01-01T14:11:54.000Z'),
          position: 10761.627312665774,
          speed: 55.55555555555556,
        },
        {
          time: new Date('1900-01-01T14:13:18.000Z'),
          position: 15453.965,
          speed: 55.55555555555556,
        },
        {
          time: new Date('1900-01-01T14:13:32.000Z'),
          position: 16263.167336376571,
          speed: 59.85825428880899,
        },
        {
          time: new Date('1900-01-01T14:13:40.000Z'),
          position: 16748.723176299554,
          speed: 61.38572431306721,
        },
        {
          time: new Date('1900-01-01T14:14:00.000Z'),
          position: 17999.134634225047,
          speed: 63.69031321436226,
        },
        {
          time: new Date('1900-01-01T14:14:14.000Z'),
          position: 18895.395244128296,
          speed: 64.48409205077189,
        },
        {
          time: new Date('1900-01-01T14:14:20.000Z'),
          position: 19286.141310948067,
          speed: 65.7013819681295,
        },
        {
          time: new Date('1900-01-01T14:14:42.000Z'),
          position: 20767.50609335596,
          speed: 68.96061864834742,
        },
        {
          time: new Date('1900-01-01T14:15:02.000Z'),
          position: 22189.116288063826,
          speed: 73.16914241504898,
        },
        {
          time: new Date('1900-01-01T14:15:20.000Z'),
          position: 23537.4561097713,
          speed: 76.59368700768825,
        },
        {
          time: new Date('1900-01-01T14:15:26.000Z'),
          position: 23999.409845542636,
          speed: 77.21262710092336,
        },
        {
          time: new Date('1900-01-01T14:15:34.000Z'),
          position: 24614.388639609148,
          speed: 76.54905821591642,
        },
        {
          time: new Date('1900-01-01T14:15:50.000Z'),
          position: 25848.712308372487,
          speed: 77.81157209750988,
        },
        {
          time: new Date('1900-01-01T14:16:00.000Z'),
          position: 26629.081230660693,
          speed: 78.22486444596254,
        },
        {
          time: new Date('1900-01-01T14:16:18.000Z'),
          position: 28062.013071366036,
          speed: 81.07716031674254,
        },
        {
          time: new Date('1900-01-01T14:16:27.000Z'),
          position: 28724.57556097535,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:17:02.000Z'),
          position: 31709.6308858811,
          speed: 83.33255254776554,
        },
        {
          time: new Date('1900-01-01T14:17:10.000Z'),
          position: 32373.97423797496,
          speed: 82.84657929799457,
        },
        {
          time: new Date('1900-01-01T14:17:15.000Z'),
          position: 32745.1422452447,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:17:47.000Z'),
          position: 35441.63166666664,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:17:59.000Z'),
          position: 36436.43850406896,
          speed: 82.46245470354208,
        },
        {
          time: new Date('1900-01-01T14:18:07.000Z'),
          position: 37068.449156007664,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:18:55.000Z'),
          position: 41050.63042815859,
          speed: 83.33209482526631,
        },
        {
          time: new Date('1900-01-01T14:19:05.000Z'),
          position: 41881.54119684637,
          speed: 82.85385166361458,
        },
        {
          time: new Date('1900-01-01T14:19:09.000Z'),
          position: 42213.107803883555,
          speed: 82.99070178839779,
        },
        {
          time: new Date('1900-01-01T14:19:15.000Z'),
          position: 42709.14184618783,
          speed: 82.33330657037375,
        },
        {
          time: new Date('1900-01-01T14:19:19.000Z'),
          position: 43038.745036132226,
          speed: 82.5128013855045,
        },
        {
          time: new Date('1900-01-01T14:19:37.000Z'),
          position: 44518.880928441264,
          speed: 81.9430736672955,
        },
        {
          time: new Date('1900-01-01T14:19:45.000Z'),
          position: 45176.816922214144,
          speed: 82.6780265594408,
        },
        {
          time: new Date('1900-01-01T14:19:48.000Z'),
          position: 45487.18384380568,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:23:21.000Z'),
          position: 63245.63166666665,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:23:35.000Z'),
          position: 64395.74223491244,
          speed: 80.90874120181111,
        },
        {
          time: new Date('1900-01-01T14:23:49.000Z'),
          position: 65534.83908186208,
          speed: 81.87944083610552,
        },
        {
          time: new Date('1900-01-01T14:24:02.000Z'),
          position: 66559.3299787296,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:29:24.000Z'),
          position: 93390.965,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:29:38.000Z'),
          position: 94544.84906853344,
          speed: 81.3434987537168,
        },
        {
          time: new Date('1900-01-01T14:29:51.000Z'),
          position: 95661.12432035248,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:32:45.000Z'),
          position: 110117.29833333335,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:32:57.000Z'),
          position: 111112.8984723236,
          speed: 82.65687277733876,
        },
        {
          time: new Date('1900-01-01T14:33:03.000Z'),
          position: 111614.85804368171,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:36:58.000Z'),
          position: 131190.965,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:37:12.000Z'),
          position: 132346.46010255828,
          speed: 81.53146243137134,
        },
        {
          time: new Date('1900-01-01T14:37:27.000Z'),
          position: 133592.0894357146,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:37:54.000Z'),
          position: 135859.63166666662,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:38:00.000Z'),
          position: 136357.82622933082,
          speed: 82.6938108810291,
        },
        {
          time: new Date('1900-01-01T14:38:07.000Z'),
          position: 136961.33569717835,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:43:00.000Z'),
          position: 161338.29833333325,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:43:08.000Z'),
          position: 162003.15432985823,
          speed: 82.9128855540673,
        },
        {
          time: new Date('1900-01-01T14:43:12.000Z'),
          position: 162328.99181158727,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:45:52.000Z'),
          position: 175641.2977278311,
          speed: 83.33272783120943,
        },
        {
          time: new Date('1900-01-01T14:45:52.000Z'),
          position: 175708.57652478074,
          speed: 83.2943958286144,
        },
        {
          time: new Date('1900-01-01T14:45:57.000Z'),
          position: 176067.52055555562,
          speed: 81.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:46:13.000Z'),
          position: 177301.29833333337,
          speed: 73.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:46:25.000Z'),
          position: 178142.63166666668,
          speed: 67.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:46:37.000Z'),
          position: 178911.965,
          speed: 61.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:46:53.000Z'),
          position: 179903.68796172203,
          speed: 61.05629505542252,
        },
        {
          time: new Date('1900-01-01T14:47:35.000Z'),
          position: 182410.6124384856,
          speed: 58.3752119619226,
        },
        {
          time: new Date('1900-01-01T14:48:14.000Z'),
          position: 184715.50716255856,
          speed: 61.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:51:36.000Z'),
          position: 197084.7427777777,
          speed: 61.11111111111111,
        },
        {
          time: new Date('1900-01-01T14:51:46.000Z'),
          position: 197695.74277777772,
          speed: 55.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:51:58.000Z'),
          position: 198330.4094444444,
          speed: 49.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:52:08.000Z'),
          position: 198804.2983333333,
          speed: 44.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:52:20.000Z'),
          position: 199306.965,
          speed: 38.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:52:25.000Z'),
          position: 199468.2242592592,
          speed: 38.888888888888886,
        },
        {
          time: new Date('1900-01-01T14:52:35.000Z'),
          position: 199839.63166666665,
          speed: 33.77777777777778,
        },
        {
          time: new Date('1900-01-01T14:52:47.000Z'),
          position: 200208.965,
          speed: 27.77777777777778,
        },
        {
          time: new Date('1900-01-01T14:53:02.000Z'),
          position: 200637.0020617284,
          speed: 27.77777777777778,
        },
        {
          time: new Date('1900-01-01T14:53:10.000Z'),
          position: 200832.607,
          speed: 24,
        },
        {
          time: new Date('1900-01-01T14:53:16.000Z'),
          position: 200967.607,
          speed: 21,
        },
        {
          time: new Date('1900-01-01T14:53:22.000Z'),
          position: 201084.607,
          speed: 18,
        },
        {
          time: new Date('1900-01-01T14:53:30.000Z'),
          position: 201212.607,
          speed: 14,
        },
        {
          time: new Date('1900-01-01T14:53:36.000Z'),
          position: 201287.607,
          speed: 11,
        },
        {
          time: new Date('1900-01-01T14:53:40.000Z'),
          position: 201327.607,
          speed: 9,
        },
        {
          time: new Date('1900-01-01T14:53:44.000Z'),
          position: 201359.607,
          speed: 7,
        },
        {
          time: new Date('1900-01-01T14:53:50.000Z'),
          position: 201392.607,
          speed: 4,
        },
        {
          time: new Date('1900-01-01T14:53:54.000Z'),
          position: 201404.607,
          speed: 2,
        },
        {
          time: new Date('1900-01-01T14:53:56.000Z'),
          position: 201407.607,
          speed: 1,
        },
        {
          time: new Date('1900-01-01T14:53:59.000Z'),
          position: 201408.607,
          speed: 0,
        },
      ],
    },
    {
      id: 12,
      name: 'sample 5',
      headPosition: [
        [
          {
            time: new Date('1900-01-01T14:20:39.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:20:47.000Z'),
            position: 15.087681652230287,
          },
          {
            time: new Date('1900-01-01T14:20:55.000Z'),
            position: 59.95650969166121,
          },
          {
            time: new Date('1900-01-01T14:21:03.000Z'),
            position: 134.0825421380268,
          },
          {
            time: new Date('1900-01-01T14:21:11.000Z'),
            position: 236.98839247875625,
          },
          {
            time: new Date('1900-01-01T14:22:36.000Z'),
            position: 1660.9650000000001,
          },
          {
            time: new Date('1900-01-01T14:22:42.000Z'),
            position: 1767.7780072292762,
          },
          {
            time: new Date('1900-01-01T14:22:50.000Z'),
            position: 1930.6174571559138,
          },
          {
            time: new Date('1900-01-01T14:23:00.000Z'),
            position: 2161.1275570966345,
          },
          {
            time: new Date('1900-01-01T14:23:10.000Z'),
            position: 2413.0298284954642,
          },
          {
            time: new Date('1900-01-01T14:23:22.000Z'),
            position: 2738.1398383195615,
          },
          {
            time: new Date('1900-01-01T14:23:36.000Z'),
            position: 3145.965,
          },
          {
            time: new Date('1900-01-01T14:24:01.000Z'),
            position: 3770.858012400591,
          },
          {
            time: new Date('1900-01-01T14:24:15.000Z'),
            position: 4156.964371844142,
          },
          {
            time: new Date('1900-01-01T14:24:25.000Z'),
            position: 4459.229607497612,
          },
          {
            time: new Date('1900-01-01T14:24:37.000Z'),
            position: 4850.376521303067,
          },
          {
            time: new Date('1900-01-01T14:24:49.000Z'),
            position: 5270.281282169671,
          },
          {
            time: new Date('1900-01-01T14:25:01.000Z'),
            position: 5716.242002875245,
          },
          {
            time: new Date('1900-01-01T14:25:11.000Z'),
            position: 6106.035980221415,
          },
          {
            time: new Date('1900-01-01T14:25:19.000Z'),
            position: 6435.579634345027,
          },
          {
            time: new Date('1900-01-01T14:25:29.000Z'),
            position: 6868.595781383138,
          },
          {
            time: new Date('1900-01-01T14:25:55.000Z'),
            position: 8020.071253348365,
          },
          {
            time: new Date('1900-01-01T14:26:23.000Z'),
            position: 9210.531491201365,
          },
          {
            time: new Date('1900-01-01T14:26:29.000Z'),
            position: 9484.128166707702,
          },
          {
            time: new Date('1900-01-01T14:26:35.000Z'),
            position: 9771.392110422634,
          },
          {
            time: new Date('1900-01-01T14:26:43.000Z'),
            position: 10172.427180640114,
          },
          {
            time: new Date('1900-01-01T14:26:49.000Z'),
            position: 10486.693547932831,
          },
          {
            time: new Date('1900-01-01T14:28:18.000Z'),
            position: 15453.965,
          },
          {
            time: new Date('1900-01-01T14:28:24.000Z'),
            position: 15793.311759016024,
          },
          {
            time: new Date('1900-01-01T14:28:30.000Z'),
            position: 16143.99757989964,
          },
          {
            time: new Date('1900-01-01T14:28:40.000Z'),
            position: 16748.723176299554,
          },
          {
            time: new Date('1900-01-01T14:28:50.000Z'),
            position: 17368.41050165773,
          },
          {
            time: new Date('1900-01-01T14:29:12.000Z'),
            position: 18766.6763033138,
          },
          {
            time: new Date('1900-01-01T14:29:20.000Z'),
            position: 19286.141310948067,
          },
          {
            time: new Date('1900-01-01T14:29:28.000Z'),
            position: 19816.618864989814,
          },
          {
            time: new Date('1900-01-01T14:29:44.000Z'),
            position: 20905.824840111123,
          },
          {
            time: new Date('1900-01-01T14:29:52.000Z'),
            position: 21467.64995775713,
          },
          {
            time: new Date('1900-01-01T14:30:02.000Z'),
            position: 22189.116288063826,
          },
          {
            time: new Date('1900-01-01T14:30:10.000Z'),
            position: 22780.758499968604,
          },
          {
            time: new Date('1900-01-01T14:30:20.000Z'),
            position: 23537.4561097713,
          },
          {
            time: new Date('1900-01-01T14:30:46.000Z'),
            position: 25538.497935155963,
          },
          {
            time: new Date('1900-01-01T14:31:02.000Z'),
            position: 26785.73730604492,
          },
          {
            time: new Date('1900-01-01T14:31:14.000Z'),
            position: 27738.84707111232,
          },
          {
            time: new Date('1900-01-01T14:31:24.000Z'),
            position: 28553.034185602537,
          },
          {
            time: new Date('1900-01-01T14:34:01.000Z'),
            position: 41549.750324835055,
          },
          {
            time: new Date('1900-01-01T14:34:48.000Z'),
            position: 45487.18384380568,
          },
          {
            time: new Date('1900-01-01T14:38:23.000Z'),
            position: 63412.01822058594,
          },
          {
            time: new Date('1900-01-01T14:38:31.000Z'),
            position: 64070.69104510256,
          },
          {
            time: new Date('1900-01-01T14:38:49.000Z'),
            position: 65534.839081862076,
          },
          {
            time: new Date('1900-01-01T14:39:01.000Z'),
            position: 66525.77093593446,
          },
          {
            time: new Date('1900-01-01T14:44:24.000Z'),
            position: 93390.965,
          },
          {
            time: new Date('1900-01-01T14:44:51.000Z'),
            position: 95661.12432035248,
          },
          {
            time: new Date('1900-01-01T14:51:58.000Z'),
            position: 131190.965,
          },
          {
            time: new Date('1900-01-01T14:52:24.000Z'),
            position: 133333.25559366634,
          },
          {
            time: new Date('1900-01-01T14:53:07.000Z'),
            position: 136961.33569717835,
          },
          {
            time: new Date('1900-01-01T15:00:52.000Z'),
            position: 175708.57652478074,
          },
          {
            time: new Date('1900-01-01T15:00:59.000Z'),
            position: 176228.74277777784,
          },
          {
            time: new Date('1900-01-01T15:01:05.000Z'),
            position: 176700.4094444445,
          },
          {
            time: new Date('1900-01-01T15:01:13.000Z'),
            position: 177301.29833333337,
          },
          {
            time: new Date('1900-01-01T15:01:21.000Z'),
            position: 177870.18722222224,
          },
          {
            time: new Date('1900-01-01T15:01:29.000Z'),
            position: 178407.07611111112,
          },
          {
            time: new Date('1900-01-01T15:01:37.000Z'),
            position: 178911.965,
          },
          {
            time: new Date('1900-01-01T15:01:57.000Z'),
            position: 180147.2705093627,
          },
          {
            time: new Date('1900-01-01T15:02:11.000Z'),
            position: 180991.56898009698,
          },
          {
            time: new Date('1900-01-01T15:02:25.000Z'),
            position: 181823.81089114814,
          },
          {
            time: new Date('1900-01-01T15:02:49.000Z'),
            position: 183234.1939976445,
          },
          {
            time: new Date('1900-01-01T15:03:09.000Z'),
            position: 184435.50229204967,
          },
          {
            time: new Date('1900-01-01T15:06:36.000Z'),
            position: 197111.8538888888,
          },
          {
            time: new Date('1900-01-01T15:06:44.000Z'),
            position: 197582.96499999994,
          },
          {
            time: new Date('1900-01-01T15:06:48.000Z'),
            position: 197806.5205555555,
          },
          {
            time: new Date('1900-01-01T15:06:54.000Z'),
            position: 198126.85388888884,
          },
          {
            time: new Date('1900-01-01T15:07:02.000Z'),
            position: 198525.96499999997,
          },
          {
            time: new Date('1900-01-01T15:07:10.000Z'),
            position: 198893.0761111111,
          },
          {
            time: new Date('1900-01-01T15:07:18.000Z'),
            position: 199228.18722222222,
          },
          {
            time: new Date('1900-01-01T15:07:29.000Z'),
            position: 199627.96499999994,
          },
          {
            time: new Date('1900-01-01T15:07:35.000Z'),
            position: 199839.63166666662,
          },
          {
            time: new Date('1900-01-01T15:07:43.000Z'),
            position: 200093.85388888887,
          },
          {
            time: new Date('1900-01-01T15:08:06.000Z'),
            position: 200732.607,
          },
          {
            time: new Date('1900-01-01T15:08:12.000Z'),
            position: 200879.607,
          },
          {
            time: new Date('1900-01-01T15:08:18.000Z'),
            position: 201008.607,
          },
          {
            time: new Date('1900-01-01T15:08:24.000Z'),
            position: 201119.607,
          },
          {
            time: new Date('1900-01-01T15:08:32.000Z'),
            position: 201239.607,
          },
          {
            time: new Date('1900-01-01T15:08:38.000Z'),
            position: 201308.607,
          },
          {
            time: new Date('1900-01-01T15:08:46.000Z'),
            position: 201372.607,
          },
          {
            time: new Date('1900-01-01T15:08:52.000Z'),
            position: 201399.607,
          },
          {
            time: new Date('1900-01-01T15:08:59.000Z'),
            position: 201408.607,
          },
        ],
      ],
      tailPosition: [
        [
          {
            time: new Date('1900-01-01T14:20:39.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:20:47.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:20:55.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:21:03.000Z'),
            position: 0,
          },
          {
            time: new Date('1900-01-01T14:21:11.000Z'),
            position: 36.98839247875625,
          },
          {
            time: new Date('1900-01-01T14:22:36.000Z'),
            position: 1460.9650000000001,
          },
          {
            time: new Date('1900-01-01T14:22:42.000Z'),
            position: 1567.7780072292762,
          },
          {
            time: new Date('1900-01-01T14:22:50.000Z'),
            position: 1730.6174571559138,
          },
          {
            time: new Date('1900-01-01T14:23:00.000Z'),
            position: 1961.1275570966345,
          },
          {
            time: new Date('1900-01-01T14:23:10.000Z'),
            position: 2213.0298284954642,
          },
          {
            time: new Date('1900-01-01T14:23:22.000Z'),
            position: 2538.1398383195615,
          },
          {
            time: new Date('1900-01-01T14:23:36.000Z'),
            position: 2945.965,
          },
          {
            time: new Date('1900-01-01T14:24:01.000Z'),
            position: 3570.858012400591,
          },
          {
            time: new Date('1900-01-01T14:24:15.000Z'),
            position: 3956.964371844142,
          },
          {
            time: new Date('1900-01-01T14:24:25.000Z'),
            position: 4259.229607497612,
          },
          {
            time: new Date('1900-01-01T14:24:37.000Z'),
            position: 4650.376521303067,
          },
          {
            time: new Date('1900-01-01T14:24:49.000Z'),
            position: 5070.281282169671,
          },
          {
            time: new Date('1900-01-01T14:25:01.000Z'),
            position: 5516.242002875245,
          },
          {
            time: new Date('1900-01-01T14:25:11.000Z'),
            position: 5906.035980221415,
          },
          {
            time: new Date('1900-01-01T14:25:19.000Z'),
            position: 6235.579634345027,
          },
          {
            time: new Date('1900-01-01T14:25:29.000Z'),
            position: 6668.595781383138,
          },
          {
            time: new Date('1900-01-01T14:25:55.000Z'),
            position: 7820.071253348365,
          },
          {
            time: new Date('1900-01-01T14:26:23.000Z'),
            position: 9010.531491201365,
          },
          {
            time: new Date('1900-01-01T14:26:29.000Z'),
            position: 9284.128166707702,
          },
          {
            time: new Date('1900-01-01T14:26:35.000Z'),
            position: 9571.392110422634,
          },
          {
            time: new Date('1900-01-01T14:26:43.000Z'),
            position: 9972.427180640114,
          },
          {
            time: new Date('1900-01-01T14:26:49.000Z'),
            position: 10286.693547932831,
          },
          {
            time: new Date('1900-01-01T14:28:18.000Z'),
            position: 15253.965,
          },
          {
            time: new Date('1900-01-01T14:28:24.000Z'),
            position: 15593.311759016024,
          },
          {
            time: new Date('1900-01-01T14:28:30.000Z'),
            position: 15943.99757989964,
          },
          {
            time: new Date('1900-01-01T14:28:40.000Z'),
            position: 16548.723176299554,
          },
          {
            time: new Date('1900-01-01T14:28:50.000Z'),
            position: 17168.41050165773,
          },
          {
            time: new Date('1900-01-01T14:29:12.000Z'),
            position: 18566.6763033138,
          },
          {
            time: new Date('1900-01-01T14:29:20.000Z'),
            position: 19086.141310948067,
          },
          {
            time: new Date('1900-01-01T14:29:28.000Z'),
            position: 19616.618864989814,
          },
          {
            time: new Date('1900-01-01T14:29:44.000Z'),
            position: 20705.824840111123,
          },
          {
            time: new Date('1900-01-01T14:29:52.000Z'),
            position: 21267.64995775713,
          },
          {
            time: new Date('1900-01-01T14:30:02.000Z'),
            position: 21989.116288063826,
          },
          {
            time: new Date('1900-01-01T14:30:10.000Z'),
            position: 22580.758499968604,
          },
          {
            time: new Date('1900-01-01T14:30:20.000Z'),
            position: 23337.4561097713,
          },
          {
            time: new Date('1900-01-01T14:30:46.000Z'),
            position: 25338.497935155963,
          },
          {
            time: new Date('1900-01-01T14:31:02.000Z'),
            position: 26585.73730604492,
          },
          {
            time: new Date('1900-01-01T14:31:14.000Z'),
            position: 27538.84707111232,
          },
          {
            time: new Date('1900-01-01T14:31:24.000Z'),
            position: 28353.034185602537,
          },
          {
            time: new Date('1900-01-01T14:34:01.000Z'),
            position: 41349.750324835055,
          },
          {
            time: new Date('1900-01-01T14:34:48.000Z'),
            position: 45287.18384380568,
          },
          {
            time: new Date('1900-01-01T14:38:23.000Z'),
            position: 63212.01822058594,
          },
          {
            time: new Date('1900-01-01T14:38:31.000Z'),
            position: 63870.69104510256,
          },
          {
            time: new Date('1900-01-01T14:38:49.000Z'),
            position: 65334.839081862076,
          },
          {
            time: new Date('1900-01-01T14:39:01.000Z'),
            position: 66325.77093593446,
          },
          {
            time: new Date('1900-01-01T14:44:24.000Z'),
            position: 93190.965,
          },
          {
            time: new Date('1900-01-01T14:44:51.000Z'),
            position: 95461.12432035248,
          },
          {
            time: new Date('1900-01-01T14:51:58.000Z'),
            position: 130990.965,
          },
          {
            time: new Date('1900-01-01T14:52:24.000Z'),
            position: 133133.25559366634,
          },
          {
            time: new Date('1900-01-01T14:53:07.000Z'),
            position: 136761.33569717835,
          },
          {
            time: new Date('1900-01-01T15:00:52.000Z'),
            position: 175508.57652478074,
          },
          {
            time: new Date('1900-01-01T15:00:59.000Z'),
            position: 176028.74277777784,
          },
          {
            time: new Date('1900-01-01T15:01:05.000Z'),
            position: 176500.4094444445,
          },
          {
            time: new Date('1900-01-01T15:01:13.000Z'),
            position: 177101.29833333337,
          },
          {
            time: new Date('1900-01-01T15:01:21.000Z'),
            position: 177670.18722222224,
          },
          {
            time: new Date('1900-01-01T15:01:29.000Z'),
            position: 178207.07611111112,
          },
          {
            time: new Date('1900-01-01T15:01:37.000Z'),
            position: 178711.965,
          },
          {
            time: new Date('1900-01-01T15:01:57.000Z'),
            position: 179947.2705093627,
          },
          {
            time: new Date('1900-01-01T15:02:11.000Z'),
            position: 180791.56898009698,
          },
          {
            time: new Date('1900-01-01T15:02:25.000Z'),
            position: 181623.81089114814,
          },
          {
            time: new Date('1900-01-01T15:02:49.000Z'),
            position: 183034.1939976445,
          },
          {
            time: new Date('1900-01-01T15:03:09.000Z'),
            position: 184235.50229204967,
          },
          {
            time: new Date('1900-01-01T15:06:36.000Z'),
            position: 196911.8538888888,
          },
          {
            time: new Date('1900-01-01T15:06:44.000Z'),
            position: 197382.96499999994,
          },
          {
            time: new Date('1900-01-01T15:06:48.000Z'),
            position: 197606.5205555555,
          },
          {
            time: new Date('1900-01-01T15:06:54.000Z'),
            position: 197926.85388888884,
          },
          {
            time: new Date('1900-01-01T15:07:02.000Z'),
            position: 198325.96499999997,
          },
          {
            time: new Date('1900-01-01T15:07:10.000Z'),
            position: 198693.0761111111,
          },
          {
            time: new Date('1900-01-01T15:07:18.000Z'),
            position: 199028.18722222222,
          },
          {
            time: new Date('1900-01-01T15:07:29.000Z'),
            position: 199427.96499999994,
          },
          {
            time: new Date('1900-01-01T15:07:35.000Z'),
            position: 199639.63166666662,
          },
          {
            time: new Date('1900-01-01T15:07:43.000Z'),
            position: 199893.85388888887,
          },
          {
            time: new Date('1900-01-01T15:08:06.000Z'),
            position: 200532.607,
          },
          {
            time: new Date('1900-01-01T15:08:12.000Z'),
            position: 200679.607,
          },
          {
            time: new Date('1900-01-01T15:08:18.000Z'),
            position: 200808.607,
          },
          {
            time: new Date('1900-01-01T15:08:24.000Z'),
            position: 200919.607,
          },
          {
            time: new Date('1900-01-01T15:08:32.000Z'),
            position: 201039.607,
          },
          {
            time: new Date('1900-01-01T15:08:38.000Z'),
            position: 201108.607,
          },
          {
            time: new Date('1900-01-01T15:08:46.000Z'),
            position: 201172.607,
          },
          {
            time: new Date('1900-01-01T15:08:52.000Z'),
            position: 201199.607,
          },
          {
            time: new Date('1900-01-01T15:08:59.000Z'),
            position: 201208.607,
          },
        ],
      ],
      routeAspects: [
        {
          signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
          time_start: new Date('1900-01-01T14:20:39.000Z'),
          time_end: new Date('1900-01-01T14:21:16.000Z'),
          position_start: 320.965,
          position_end: 605.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '69ca947c-6667-11e3-81ff-01f464e0362d',
          track_offset: 496,
        },
        {
          signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
          time_start: new Date('1900-01-01T14:21:16.000Z'),
          time_end: new Date('1900-01-01T14:21:45.000Z'),
          position_start: 320.965,
          position_end: 605.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '69ca947c-6667-11e3-81ff-01f464e0362d',
          track_offset: 496,
        },
        {
          signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
          time_start: new Date('1900-01-01T14:21:45.000Z'),
          time_end: new Date('1900-01-01T14:22:33.000Z'),
          position_start: 320.965,
          position_end: 605.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '69ca947c-6667-11e3-81ff-01f464e0362d',
          track_offset: 496,
        },
        {
          signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:21:16.000Z'),
          time_end: new Date('1900-01-01T14:21:33.000Z'),
          position_start: 605.965,
          position_end: 1410.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60c895c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 51,
        },
        {
          signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:21:33.000Z'),
          time_end: new Date('1900-01-01T14:22:33.000Z'),
          position_start: 605.965,
          position_end: 1410.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60c895c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 51,
        },
        {
          signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:22:33.000Z'),
          time_end: new Date('1900-01-01T14:23:08.000Z'),
          position_start: 605.965,
          position_end: 1410.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60c895c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 51,
        },
        {
          signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:21:57.000Z'),
          time_end: new Date('1900-01-01T14:22:21.000Z'),
          position_start: 1410.965,
          position_end: 2157.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '61a60592-6667-11e3-81ff-01f464e0362d',
          track_offset: 358,
        },
        {
          signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:22:21.000Z'),
          time_end: new Date('1900-01-01T14:23:08.000Z'),
          position_start: 1410.965,
          position_end: 2157.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '61a60592-6667-11e3-81ff-01f464e0362d',
          track_offset: 358,
        },
        {
          signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:23:08.000Z'),
          time_end: new Date('1900-01-01T14:23:44.000Z'),
          position_start: 1410.965,
          position_end: 2157.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '61a60592-6667-11e3-81ff-01f464e0362d',
          track_offset: 358,
        },
        {
          signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:22:41.000Z'),
          time_end: new Date('1900-01-01T14:23:00.000Z'),
          position_start: 2157.965,
          position_end: 3139.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '61a460c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 248,
        },
        {
          signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:23:00.000Z'),
          time_end: new Date('1900-01-01T14:23:44.000Z'),
          position_start: 2157.965,
          position_end: 3139.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '61a460c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 248,
        },
        {
          signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:23:44.000Z'),
          time_end: new Date('1900-01-01T14:24:44.000Z'),
          position_start: 2157.965,
          position_end: 3139.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '61a460c8-6667-11e3-81ff-01f464e0362d',
          track_offset: 248,
        },
        {
          signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:23:22.000Z'),
          time_end: new Date('1900-01-01T14:23:36.000Z'),
          position_start: 3139.965,
          position_end: 4890.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '61a465bc-6667-11e3-81ff-01f464e0362d',
          track_offset: 544,
        },
        {
          signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:23:36.000Z'),
          time_end: new Date('1900-01-01T14:24:44.000Z'),
          position_start: 3139.965,
          position_end: 4890.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '61a465bc-6667-11e3-81ff-01f464e0362d',
          track_offset: 544,
        },
        {
          signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:24:44.000Z'),
          time_end: new Date('1900-01-01T14:25:22.000Z'),
          position_start: 3139.965,
          position_end: 4890.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '61a465bc-6667-11e3-81ff-01f464e0362d',
          track_offset: 544,
        },
        {
          signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:24:26.000Z'),
          time_end: new Date('1900-01-01T14:24:38.000Z'),
          position_start: 4890.965,
          position_end: 6365.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8b696-6667-11e3-81ff-01f464e0362d',
          track_offset: 1393,
        },
        {
          signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:24:38.000Z'),
          time_end: new Date('1900-01-01T14:25:22.000Z'),
          position_start: 4890.965,
          position_end: 6365.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8b696-6667-11e3-81ff-01f464e0362d',
          track_offset: 1393,
        },
        {
          signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T14:25:22.000Z'),
          time_end: new Date('1900-01-01T14:26:15.000Z'),
          position_start: 4890.965,
          position_end: 6365.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8b696-6667-11e3-81ff-01f464e0362d',
          track_offset: 1393,
        },
        {
          signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:25:07.000Z'),
          time_end: new Date('1900-01-01T14:25:17.000Z'),
          position_start: 6365.965,
          position_end: 8655.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 869,
        },
        {
          signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:25:17.000Z'),
          time_end: new Date('1900-01-01T14:26:15.000Z'),
          position_start: 6365.965,
          position_end: 8655.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 869,
        },
        {
          signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:26:15.000Z'),
          time_end: new Date('1900-01-01T14:26:56.000Z'),
          position_start: 6365.965,
          position_end: 8655.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 869,
        },
        {
          signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:26:00.000Z'),
          time_end: new Date('1900-01-01T14:26:10.000Z'),
          position_start: 8655.965,
          position_end: 10695.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 3159,
        },
        {
          signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:26:10.000Z'),
          time_end: new Date('1900-01-01T14:26:56.000Z'),
          position_start: 8655.965,
          position_end: 10695.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 3159,
        },
        {
          signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:26:56.000Z'),
          time_end: new Date('1900-01-01T14:27:42.000Z'),
          position_start: 8655.965,
          position_end: 10695.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 3159,
        },
        {
          signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:26:45.000Z'),
          time_end: new Date('1900-01-01T14:26:53.000Z'),
          position_start: 10695.965,
          position_end: 13220.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 5199,
        },
        {
          signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:26:53.000Z'),
          time_end: new Date('1900-01-01T14:27:42.000Z'),
          position_start: 10695.965,
          position_end: 13220.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 5199,
        },
        {
          signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:27:42.000Z'),
          time_end: new Date('1900-01-01T14:28:20.000Z'),
          position_start: 10695.965,
          position_end: 13220.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
          track_offset: 5199,
        },
        {
          signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:27:31.000Z'),
          time_end: new Date('1900-01-01T14:27:38.000Z'),
          position_start: 13220.965,
          position_end: 15353.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
          track_offset: 10,
        },
        {
          signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:27:38.000Z'),
          time_end: new Date('1900-01-01T14:28:20.000Z'),
          position_start: 13220.965,
          position_end: 15353.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
          track_offset: 10,
        },
        {
          signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:01:47.000Z'),
          time_end: new Date('1900-01-01T15:01:53.000Z'),
          position_start: 179935.965,
          position_end: 181568.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
          track_offset: 924,
        },
        {
          signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:01:53.000Z'),
          time_end: new Date('1900-01-01T15:02:24.000Z'),
          position_start: 179935.965,
          position_end: 181568.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
          track_offset: 924,
        },
        {
          signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:02:24.000Z'),
          time_end: new Date('1900-01-01T15:02:59.000Z'),
          position_start: 179935.965,
          position_end: 181568.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
          track_offset: 924,
        },
        {
          signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:02:14.000Z'),
          time_end: new Date('1900-01-01T15:02:21.000Z'),
          position_start: 181568.965,
          position_end: 183628.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
          track_offset: 235,
        },
        {
          signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:02:21.000Z'),
          time_end: new Date('1900-01-01T15:02:59.000Z'),
          position_start: 181568.965,
          position_end: 183628.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
          track_offset: 235,
        },
        {
          signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:02:59.000Z'),
          time_end: new Date('1900-01-01T15:03:26.000Z'),
          position_start: 181568.965,
          position_end: 183628.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
          track_offset: 235,
        },
        {
          signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:02:49.000Z'),
          time_end: new Date('1900-01-01T15:02:56.000Z'),
          position_start: 183628.965,
          position_end: 185298.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 1140,
        },
        {
          signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:02:56.000Z'),
          time_end: new Date('1900-01-01T15:03:26.000Z'),
          position_start: 183628.965,
          position_end: 185298.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 1140,
        },
        {
          signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:03:26.000Z'),
          time_end: new Date('1900-01-01T15:03:54.000Z'),
          position_start: 183628.965,
          position_end: 185298.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 1140,
        },
        {
          signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:03:17.000Z'),
          time_end: new Date('1900-01-01T15:03:23.000Z'),
          position_start: 185298.965,
          position_end: 186988.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 2810,
        },
        {
          signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:03:23.000Z'),
          time_end: new Date('1900-01-01T15:03:54.000Z'),
          position_start: 185298.965,
          position_end: 186988.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 2810,
        },
        {
          signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:03:54.000Z'),
          time_end: new Date('1900-01-01T15:04:21.000Z'),
          position_start: 185298.965,
          position_end: 186988.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 2810,
        },
        {
          signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:03:44.000Z'),
          time_end: new Date('1900-01-01T15:03:51.000Z'),
          position_start: 186988.965,
          position_end: 188618.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 4500,
        },
        {
          signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:03:51.000Z'),
          time_end: new Date('1900-01-01T15:04:21.000Z'),
          position_start: 186988.965,
          position_end: 188618.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 4500,
        },
        {
          signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:04:21.000Z'),
          time_end: new Date('1900-01-01T15:04:48.000Z'),
          position_start: 186988.965,
          position_end: 188618.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 4500,
        },
        {
          signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T15:04:11.000Z'),
          time_end: new Date('1900-01-01T15:04:17.000Z'),
          position_start: 188618.965,
          position_end: 190262.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 6130,
        },
        {
          signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T15:04:17.000Z'),
          time_end: new Date('1900-01-01T15:04:48.000Z'),
          position_start: 188618.965,
          position_end: 190262.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 6130,
        },
        {
          signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
          time_start: new Date('1900-01-01T15:04:48.000Z'),
          time_end: new Date('1900-01-01T15:05:15.000Z'),
          position_start: 188618.965,
          position_end: 190262.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca365e-6667-11e3-81ff-01f464e0362d',
          track_offset: 6130,
        },
        {
          signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:04:38.000Z'),
          time_end: new Date('1900-01-01T15:04:44.000Z'),
          position_start: 190262.965,
          position_end: 191951.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca4278-6667-11e3-81ff-01f464e0362d',
          track_offset: 264,
        },
        {
          signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:04:44.000Z'),
          time_end: new Date('1900-01-01T15:05:15.000Z'),
          position_start: 190262.965,
          position_end: 191951.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca4278-6667-11e3-81ff-01f464e0362d',
          track_offset: 264,
        },
        {
          signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:05:15.000Z'),
          time_end: new Date('1900-01-01T15:05:47.000Z'),
          position_start: 190262.965,
          position_end: 191951.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca4278-6667-11e3-81ff-01f464e0362d',
          track_offset: 264,
        },
        {
          signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:05:05.000Z'),
          time_end: new Date('1900-01-01T15:05:12.000Z'),
          position_start: 191951.965,
          position_end: 193883.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 1085,
        },
        {
          signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:05:12.000Z'),
          time_end: new Date('1900-01-01T15:05:47.000Z'),
          position_start: 191951.965,
          position_end: 193883.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 1085,
        },
        {
          signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:05:47.000Z'),
          time_end: new Date('1900-01-01T15:06:19.000Z'),
          position_start: 191951.965,
          position_end: 193883.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 1085,
        },
        {
          signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:05:37.000Z'),
          time_end: new Date('1900-01-01T15:05:44.000Z'),
          position_start: 193883.965,
          position_end: 195838.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 3017,
        },
        {
          signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:05:44.000Z'),
          time_end: new Date('1900-01-01T15:06:19.000Z'),
          position_start: 193883.965,
          position_end: 195838.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 3017,
        },
        {
          signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:06:19.000Z'),
          time_end: new Date('1900-01-01T15:06:46.000Z'),
          position_start: 193883.965,
          position_end: 195838.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 3017,
        },
        {
          signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:06:09.000Z'),
          time_end: new Date('1900-01-01T15:06:16.000Z'),
          position_start: 195838.965,
          position_end: 197501.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 4972,
        },
        {
          signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:06:16.000Z'),
          time_end: new Date('1900-01-01T15:06:46.000Z'),
          position_start: 195838.965,
          position_end: 197501.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 4972,
        },
        {
          signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:06:46.000Z'),
          time_end: new Date('1900-01-01T15:07:20.000Z'),
          position_start: 195838.965,
          position_end: 197501.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 4972,
        },
        {
          signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:06:36.000Z'),
          time_end: new Date('1900-01-01T15:06:43.000Z'),
          position_start: 197501.965,
          position_end: 199088.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 6635,
        },
        {
          signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:06:43.000Z'),
          time_end: new Date('1900-01-01T15:07:20.000Z'),
          position_start: 197501.965,
          position_end: 199088.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 6635,
        },
        {
          signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:07:20.000Z'),
          time_end: new Date('1900-01-01T15:07:46.000Z'),
          position_start: 197501.965,
          position_end: 199088.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 6635,
        },
        {
          signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:07:06.000Z'),
          time_end: new Date('1900-01-01T15:07:15.000Z'),
          position_start: 199088.965,
          position_end: 199992.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 8222,
        },
        {
          signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:07:15.000Z'),
          time_end: new Date('1900-01-01T15:07:46.000Z'),
          position_start: 199088.965,
          position_end: 199992.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 8222,
        },
        {
          signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:07:46.000Z'),
          time_end: new Date('1900-01-01T15:08:11.000Z'),
          position_start: 199088.965,
          position_end: 199992.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
          track_offset: 8222,
        },
        {
          signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:07:28.000Z'),
          time_end: new Date('1900-01-01T15:07:39.000Z'),
          position_start: 199992.965,
          position_end: 200671.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
          track_offset: 684,
        },
        {
          signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:07:39.000Z'),
          time_end: new Date('1900-01-01T15:08:11.000Z'),
          position_start: 199992.965,
          position_end: 200671.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
          track_offset: 684,
        },
        {
          signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:08:11.000Z'),
          time_end: new Date('1900-01-01T15:08:59.000Z'),
          position_start: 199992.965,
          position_end: 200671.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
          track_offset: 684,
        },
        {
          signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:07:49.000Z'),
          time_end: new Date('1900-01-01T15:08:03.000Z'),
          position_start: 200671.965,
          position_end: 201657.965,
          color: 'rgba(0, 255, 0, 255)',
          blinking: false,
          aspect_label: 'VL',
          track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
          track_offset: 12,
        },
        {
          signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T15:08:03.000Z'),
          time_end: new Date('1900-01-01T15:08:59.000Z'),
          position_start: 200671.965,
          position_end: 201657.965,
          color: 'rgba(255, 0, 0, 255)',
          blinking: false,
          aspect_label: 'S',
          track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
          track_offset: 12,
        },
        {
          signal_id: 'b564cfd6-4964-11e4-9bff-012064e0362d',
          time_start: new Date('1900-01-01T14:20:39.000Z'),
          time_end: new Date('1900-01-01T15:08:59.000Z'),
          position_start: 201657.965,
          position_end: 201657.965,
          color: 'rgba(255, 255, 0, 255)',
          blinking: false,
          aspect_label: 'A',
          track: '6058b958-6667-11e3-81ff-01f464e0362d',
          track_offset: 705,
        },
      ],
      signalAspects: [],
      speed: [
        {
          time: new Date('1900-01-01T14:20:39.000Z'),
          position: 0,
          speed: 0,
        },
        {
          time: new Date('1900-01-01T14:20:41.000Z'),
          position: 0.9490586448983088,
          speed: 0.9490586448983088,
        },
        {
          time: new Date('1900-01-01T14:20:43.000Z'),
          position: 3.7876080685882414,
          speed: 1.8894907787916235,
        },
        {
          time: new Date('1900-01-01T14:20:47.000Z'),
          position: 15.08768165223028,
          speed: 3.7585662853925057,
        },
        {
          time: new Date('1900-01-01T14:20:51.000Z'),
          position: 33.83214516120702,
          speed: 5.6116489504209675,
        },
        {
          time: new Date('1900-01-01T14:20:57.000Z'),
          position: 75.76573617868836,
          speed: 8.360738040262225,
        },
        {
          time: new Date('1900-01-01T14:21:01.000Z'),
          position: 112.836826916906,
          speed: 10.17270700575389,
        },
        {
          time: new Date('1900-01-01T14:21:07.000Z'),
          position: 181.96120792333537,
          speed: 12.86480037753732,
        },
        {
          time: new Date('1900-01-01T14:21:15.000Z'),
          position: 308.55995765996323,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T14:21:48.000Z'),
          position: 855.965,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T14:21:51.000Z'),
          position: 908.6938467914624,
          speed: 17.94572180176421,
        },
        {
          time: new Date('1900-01-01T14:21:54.000Z'),
          position: 952.965,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T14:22:36.000Z'),
          position: 1660.965,
          speed: 16.666666666666668,
        },
        {
          time: new Date('1900-01-01T14:22:48.000Z'),
          position: 1887.858671857618,
          speed: 21.056336905724773,
        },
        {
          time: new Date('1900-01-01T14:22:58.000Z'),
          position: 2113.090781464639,
          speed: 23.80534114707529,
        },
        {
          time: new Date('1900-01-01T14:23:10.000Z'),
          position: 2413.029828495464,
          speed: 26.105668045905404,
        },
        {
          time: new Date('1900-01-01T14:23:31.000Z'),
          position: 2996.3655202844907,
          speed: 29.641178784176407,
        },
        {
          time: new Date('1900-01-01T14:23:40.000Z'),
          position: 3249.965,
          speed: 25,
        },
        {
          time: new Date('1900-01-01T14:23:55.000Z'),
          position: 3616.965,
          speed: 25,
        },
        {
          time: new Date('1900-01-01T14:24:25.000Z'),
          position: 4459.229607497612,
          speed: 31.345374805946133,
        },
        {
          time: new Date('1900-01-01T14:24:41.000Z'),
          position: 4987.250326566449,
          speed: 34.61553198154361,
        },
        {
          time: new Date('1900-01-01T14:24:55.000Z'),
          position: 5490.174913149777,
          speed: 37.17209736732895,
        },
        {
          time: new Date('1900-01-01T14:25:09.000Z'),
          position: 6026.6744400508705,
          speed: 39.45240892712816,
        },
        {
          time: new Date('1900-01-01T14:25:21.000Z'),
          position: 6521.178532726996,
          speed: 43.07577255246863,
        },
        {
          time: new Date('1900-01-01T14:25:25.000Z'),
          position: 6693.960154849802,
          speed: 43.33322615807421,
        },
        {
          time: new Date('1900-01-01T14:25:33.000Z'),
          position: 7046.075111813276,
          speed: 44.70812670813125,
        },
        {
          time: new Date('1900-01-01T14:25:37.000Z'),
          position: 7225.23599945501,
          speed: 44.77339358281161,
        },
        {
          time: new Date('1900-01-01T14:25:53.000Z'),
          position: 7932.902880120726,
          speed: 43.69624472410094,
        },
        {
          time: new Date('1900-01-01T14:26:13.000Z'),
          position: 8783.682799773613,
          speed: 41.324123750709546,
        },
        {
          time: new Date('1900-01-01T14:26:19.000Z'),
          position: 9036.004387683512,
          speed: 42.89585277574626,
        },
        {
          time: new Date('1900-01-01T14:26:31.000Z'),
          position: 9578.5172191259,
          speed: 47.55163379646402,
        },
        {
          time: new Date('1900-01-01T14:26:47.000Z'),
          position: 10380.54788310116,
          speed: 52.69311822784173,
        },
        {
          time: new Date('1900-01-01T14:26:54.000Z'),
          position: 10761.627312665774,
          speed: 55.55555555555556,
        },
        {
          time: new Date('1900-01-01T14:28:18.000Z'),
          position: 15453.965,
          speed: 55.55555555555556,
        },
        {
          time: new Date('1900-01-01T14:28:32.000Z'),
          position: 16263.167336376571,
          speed: 59.85825428880899,
        },
        {
          time: new Date('1900-01-01T14:28:40.000Z'),
          position: 16748.723176299554,
          speed: 61.38572431306721,
        },
        {
          time: new Date('1900-01-01T14:29:00.000Z'),
          position: 17999.134634225047,
          speed: 63.69031321436226,
        },
        {
          time: new Date('1900-01-01T14:29:14.000Z'),
          position: 18895.395244128296,
          speed: 64.48409205077189,
        },
        {
          time: new Date('1900-01-01T14:29:20.000Z'),
          position: 19286.141310948067,
          speed: 65.7013819681295,
        },
        {
          time: new Date('1900-01-01T14:29:42.000Z'),
          position: 20767.50609335596,
          speed: 68.96061864834742,
        },
        {
          time: new Date('1900-01-01T14:30:02.000Z'),
          position: 22189.116288063826,
          speed: 73.16914241504898,
        },
        {
          time: new Date('1900-01-01T14:30:20.000Z'),
          position: 23537.4561097713,
          speed: 76.59368700768825,
        },
        {
          time: new Date('1900-01-01T14:30:26.000Z'),
          position: 23999.409845542636,
          speed: 77.21262710092336,
        },
        {
          time: new Date('1900-01-01T14:30:34.000Z'),
          position: 24614.388639609148,
          speed: 76.54905821591642,
        },
        {
          time: new Date('1900-01-01T14:30:50.000Z'),
          position: 25848.712308372487,
          speed: 77.81157209750988,
        },
        {
          time: new Date('1900-01-01T14:31:00.000Z'),
          position: 26629.081230660693,
          speed: 78.22486444596254,
        },
        {
          time: new Date('1900-01-01T14:31:18.000Z'),
          position: 28062.013071366036,
          speed: 81.07716031674254,
        },
        {
          time: new Date('1900-01-01T14:31:27.000Z'),
          position: 28724.57556097535,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:32:02.000Z'),
          position: 31709.6308858811,
          speed: 83.33255254776554,
        },
        {
          time: new Date('1900-01-01T14:32:10.000Z'),
          position: 32373.97423797496,
          speed: 82.84657929799457,
        },
        {
          time: new Date('1900-01-01T14:32:15.000Z'),
          position: 32745.1422452447,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:32:47.000Z'),
          position: 35441.63166666664,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:32:59.000Z'),
          position: 36436.43850406896,
          speed: 82.46245470354208,
        },
        {
          time: new Date('1900-01-01T14:33:07.000Z'),
          position: 37068.449156007664,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:33:55.000Z'),
          position: 41050.63042815859,
          speed: 83.33209482526631,
        },
        {
          time: new Date('1900-01-01T14:34:05.000Z'),
          position: 41881.54119684637,
          speed: 82.85385166361458,
        },
        {
          time: new Date('1900-01-01T14:34:09.000Z'),
          position: 42213.107803883555,
          speed: 82.99070178839779,
        },
        {
          time: new Date('1900-01-01T14:34:15.000Z'),
          position: 42709.14184618783,
          speed: 82.33330657037375,
        },
        {
          time: new Date('1900-01-01T14:34:19.000Z'),
          position: 43038.745036132226,
          speed: 82.5128013855045,
        },
        {
          time: new Date('1900-01-01T14:34:37.000Z'),
          position: 44518.880928441264,
          speed: 81.9430736672955,
        },
        {
          time: new Date('1900-01-01T14:34:45.000Z'),
          position: 45176.816922214144,
          speed: 82.6780265594408,
        },
        {
          time: new Date('1900-01-01T14:34:48.000Z'),
          position: 45487.18384380568,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:38:21.000Z'),
          position: 63245.63166666665,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:38:35.000Z'),
          position: 64395.74223491244,
          speed: 80.90874120181111,
        },
        {
          time: new Date('1900-01-01T14:38:49.000Z'),
          position: 65534.83908186208,
          speed: 81.87944083610552,
        },
        {
          time: new Date('1900-01-01T14:39:02.000Z'),
          position: 66559.3299787296,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:44:24.000Z'),
          position: 93390.965,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:44:38.000Z'),
          position: 94544.84906853344,
          speed: 81.3434987537168,
        },
        {
          time: new Date('1900-01-01T14:44:51.000Z'),
          position: 95661.12432035248,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:47:45.000Z'),
          position: 110117.29833333335,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:47:57.000Z'),
          position: 111112.8984723236,
          speed: 82.65687277733876,
        },
        {
          time: new Date('1900-01-01T14:48:03.000Z'),
          position: 111614.85804368171,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:51:58.000Z'),
          position: 131190.965,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:52:12.000Z'),
          position: 132346.46010255828,
          speed: 81.53146243137134,
        },
        {
          time: new Date('1900-01-01T14:52:27.000Z'),
          position: 133592.0894357146,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:52:54.000Z'),
          position: 135859.63166666662,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:53:00.000Z'),
          position: 136357.82622933082,
          speed: 82.6938108810291,
        },
        {
          time: new Date('1900-01-01T14:53:07.000Z'),
          position: 136961.33569717835,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:58:00.000Z'),
          position: 161338.29833333325,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T14:58:08.000Z'),
          position: 162003.15432985823,
          speed: 82.9128855540673,
        },
        {
          time: new Date('1900-01-01T14:58:12.000Z'),
          position: 162328.99181158727,
          speed: 83.33333333333333,
        },
        {
          time: new Date('1900-01-01T15:00:52.000Z'),
          position: 175641.2977278311,
          speed: 83.33272783120943,
        },
        {
          time: new Date('1900-01-01T15:00:52.000Z'),
          position: 175708.57652478074,
          speed: 83.2943958286144,
        },
        {
          time: new Date('1900-01-01T15:00:57.000Z'),
          position: 176067.52055555562,
          speed: 81.11111111111111,
        },
        {
          time: new Date('1900-01-01T15:01:13.000Z'),
          position: 177301.29833333337,
          speed: 73.11111111111111,
        },
        {
          time: new Date('1900-01-01T15:01:25.000Z'),
          position: 178142.63166666668,
          speed: 67.11111111111111,
        },
        {
          time: new Date('1900-01-01T15:01:37.000Z'),
          position: 178911.965,
          speed: 61.11111111111111,
        },
        {
          time: new Date('1900-01-01T15:01:53.000Z'),
          position: 179903.68796172203,
          speed: 61.05629505542252,
        },
        {
          time: new Date('1900-01-01T15:02:35.000Z'),
          position: 182410.6124384856,
          speed: 58.3752119619226,
        },
        {
          time: new Date('1900-01-01T15:03:14.000Z'),
          position: 184715.50716255856,
          speed: 61.11111111111111,
        },
        {
          time: new Date('1900-01-01T15:06:36.000Z'),
          position: 197084.7427777777,
          speed: 61.11111111111111,
        },
        {
          time: new Date('1900-01-01T15:06:46.000Z'),
          position: 197695.74277777772,
          speed: 55.888888888888886,
        },
        {
          time: new Date('1900-01-01T15:06:58.000Z'),
          position: 198330.4094444444,
          speed: 49.888888888888886,
        },
        {
          time: new Date('1900-01-01T15:07:08.000Z'),
          position: 198804.2983333333,
          speed: 44.888888888888886,
        },
        {
          time: new Date('1900-01-01T15:07:20.000Z'),
          position: 199306.965,
          speed: 38.888888888888886,
        },
        {
          time: new Date('1900-01-01T15:07:25.000Z'),
          position: 199468.2242592592,
          speed: 38.888888888888886,
        },
        {
          time: new Date('1900-01-01T15:07:35.000Z'),
          position: 199839.63166666665,
          speed: 33.77777777777778,
        },
        {
          time: new Date('1900-01-01T15:07:47.000Z'),
          position: 200208.965,
          speed: 27.77777777777778,
        },
        {
          time: new Date('1900-01-01T15:08:02.000Z'),
          position: 200637.0020617284,
          speed: 27.77777777777778,
        },
        {
          time: new Date('1900-01-01T15:08:10.000Z'),
          position: 200832.607,
          speed: 24,
        },
        {
          time: new Date('1900-01-01T15:08:16.000Z'),
          position: 200967.607,
          speed: 21,
        },
        {
          time: new Date('1900-01-01T15:08:22.000Z'),
          position: 201084.607,
          speed: 18,
        },
        {
          time: new Date('1900-01-01T15:08:30.000Z'),
          position: 201212.607,
          speed: 14,
        },
        {
          time: new Date('1900-01-01T15:08:36.000Z'),
          position: 201287.607,
          speed: 11,
        },
        {
          time: new Date('1900-01-01T15:08:40.000Z'),
          position: 201327.607,
          speed: 9,
        },
        {
          time: new Date('1900-01-01T15:08:44.000Z'),
          position: 201359.607,
          speed: 7,
        },
        {
          time: new Date('1900-01-01T15:08:50.000Z'),
          position: 201392.607,
          speed: 4,
        },
        {
          time: new Date('1900-01-01T15:08:54.000Z'),
          position: 201404.607,
          speed: 2,
        },
        {
          time: new Date('1900-01-01T15:08:56.000Z'),
          position: 201407.607,
          speed: 1,
        },
        {
          time: new Date('1900-01-01T15:08:59.000Z'),
          position: 201408.607,
          speed: 0,
        },
      ],
    },
  ],
  departureArrivalTimes: [
    {
      id: 10,
      labels: [],
      train_name: 'sample 1',
      path_id: 4,
      path_length: 201408.607,
      mechanical_energy_consumed: {
        base: 12083466761.106243,
      },
      departure_time: 50400,
      arrival_time: 53300.26030786709,
      stops_count: 0,
      duration: 2900.2603078670872,
      speed_limit_tags: 'Aucune composition',
    },
    {
      id: 11,
      labels: [],
      train_name: 'sample 3',
      path_id: 4,
      path_length: 201408.607,
      mechanical_energy_consumed: {
        base: 12083466761.106243,
      },
      departure_time: 51300,
      arrival_time: 54200.26030786709,
      stops_count: 0,
      duration: 2900.2603078670872,
      speed_limit_tags: 'Aucune composition',
    },
    {
      id: 12,
      labels: [],
      train_name: 'sample 5',
      path_id: 4,
      path_length: 201408.607,
      mechanical_energy_consumed: {
        base: 12083466761.106243,
      },
      departure_time: 52200,
      arrival_time: 55100.26030786709,
      stops_count: 0,
      duration: 2900.2603078670872,
      speed_limit_tags: 'Aucune composition',
    },
  ],
  displaySimulation: true,
  simulation: {
    past: [
      {
        trains: [],
      },
    ],
    present: {
      trains: [
        {
          id: 10,
          labels: [],
          path: 4,
          name: 'sample 1',
          vmax: [
            {
              position: 0,
              speed: 16.666666666666668,
            },
            {
              position: 320.96500000000003,
              speed: 16.666666666666668,
            },
            {
              position: 320.96500000000003,
              speed: 16.666666666666668,
            },
            {
              position: 394.965,
              speed: 16.666666666666668,
            },
            {
              position: 394.965,
              speed: 16.666666666666668,
            },
            {
              position: 420.965,
              speed: 16.666666666666668,
            },
            {
              position: 420.965,
              speed: 16.666666666666668,
            },
            {
              position: 477.965,
              speed: 16.666666666666668,
            },
            {
              position: 477.965,
              speed: 16.666666666666668,
            },
            {
              position: 511.965,
              speed: 16.666666666666668,
            },
            {
              position: 511.965,
              speed: 16.666666666666668,
            },
            {
              position: 551.965,
              speed: 16.666666666666668,
            },
            {
              position: 551.965,
              speed: 16.666666666666668,
            },
            {
              position: 554.965,
              speed: 16.666666666666668,
            },
            {
              position: 554.965,
              speed: 16.666666666666668,
            },
            {
              position: 605.965,
              speed: 16.666666666666668,
            },
            {
              position: 605.965,
              speed: 25,
            },
            {
              position: 637.965,
              speed: 25,
            },
            {
              position: 637.965,
              speed: 25,
            },
            {
              position: 677.965,
              speed: 25,
            },
            {
              position: 677.965,
              speed: 25,
            },
            {
              position: 756.965,
              speed: 25,
            },
            {
              position: 756.965,
              speed: 25,
            },
            {
              position: 802.965,
              speed: 25,
            },
            {
              position: 802.965,
              speed: 25,
            },
            {
              position: 838.965,
              speed: 25,
            },
            {
              position: 838.965,
              speed: 25,
            },
            {
              position: 892.965,
              speed: 25,
            },
            {
              position: 892.965,
              speed: 25,
            },
            {
              position: 951.965,
              speed: 25,
            },
            {
              position: 951.965,
              speed: 30.555555555555554,
            },
            {
              position: 982.965,
              speed: 30.555555555555554,
            },
            {
              position: 982.965,
              speed: 30.555555555555554,
            },
            {
              position: 1052.965,
              speed: 30.555555555555554,
            },
            {
              position: 1052.965,
              speed: 16.666666666666668,
            },
            {
              position: 1066.965,
              speed: 16.666666666666668,
            },
            {
              position: 1066.965,
              speed: 16.666666666666668,
            },
            {
              position: 1410.965,
              speed: 16.666666666666668,
            },
            {
              position: 1410.965,
              speed: 25,
            },
            {
              position: 1425.965,
              speed: 25,
            },
            {
              position: 1425.965,
              speed: 25,
            },
            {
              position: 1724.965,
              speed: 25,
            },
            {
              position: 1724.965,
              speed: 36.11111111111111,
            },
            {
              position: 1772.965,
              speed: 36.11111111111111,
            },
            {
              position: 1772.965,
              speed: 41.666666666666664,
            },
            {
              position: 1780.965,
              speed: 41.666666666666664,
            },
            {
              position: 1780.965,
              speed: 41.666666666666664,
            },
            {
              position: 1909.965,
              speed: 41.666666666666664,
            },
            {
              position: 1909.965,
              speed: 41.666666666666664,
            },
            {
              position: 2157.965,
              speed: 41.666666666666664,
            },
            {
              position: 2157.965,
              speed: 41.666666666666664,
            },
            {
              position: 2595.965,
              speed: 41.666666666666664,
            },
            {
              position: 2595.965,
              speed: 41.666666666666664,
            },
            {
              position: 3139.965,
              speed: 41.666666666666664,
            },
            {
              position: 3139.965,
              speed: 41.666666666666664,
            },
            {
              position: 3349.965,
              speed: 41.666666666666664,
            },
            {
              position: 3349.965,
              speed: 25,
            },
            {
              position: 3366.965,
              speed: 25,
            },
            {
              position: 3366.965,
              speed: 41.666666666666664,
            },
            {
              position: 3367.965,
              speed: 41.666666666666664,
            },
            {
              position: 3367.965,
              speed: 41.666666666666664,
            },
            {
              position: 3494.965,
              speed: 41.666666666666664,
            },
            {
              position: 3494.965,
              speed: 41.666666666666664,
            },
            {
              position: 3497.965,
              speed: 41.666666666666664,
            },
            {
              position: 3497.965,
              speed: 41.666666666666664,
            },
            {
              position: 3625.965,
              speed: 41.666666666666664,
            },
            {
              position: 3625.965,
              speed: 41.666666666666664,
            },
            {
              position: 4890.965,
              speed: 41.666666666666664,
            },
            {
              position: 4890.965,
              speed: 41.666666666666664,
            },
            {
              position: 4975.965,
              speed: 41.666666666666664,
            },
            {
              position: 4975.965,
              speed: 55.55555555555556,
            },
            {
              position: 5496.965,
              speed: 55.55555555555556,
            },
            {
              position: 5496.965,
              speed: 55.55555555555556,
            },
            {
              position: 6365.965,
              speed: 55.55555555555556,
            },
            {
              position: 6365.965,
              speed: 55.55555555555556,
            },
            {
              position: 7591.965,
              speed: 55.55555555555556,
            },
            {
              position: 7591.965,
              speed: 55.55555555555556,
            },
            {
              position: 10695.965,
              speed: 55.55555555555556,
            },
            {
              position: 10695.965,
              speed: 55.55555555555556,
            },
            {
              position: 11201.965,
              speed: 55.55555555555556,
            },
            {
              position: 11201.965,
              speed: 55.55555555555556,
            },
            {
              position: 11281.965,
              speed: 55.55555555555556,
            },
            {
              position: 11281.965,
              speed: 55.55555555555556,
            },
            {
              position: 12870.965,
              speed: 55.55555555555556,
            },
            {
              position: 12870.965,
              speed: 55.55555555555556,
            },
            {
              position: 12880.965,
              speed: 55.55555555555556,
            },
            {
              position: 12880.965,
              speed: 55.55555555555556,
            },
            {
              position: 12955.965,
              speed: 55.55555555555556,
            },
            {
              position: 12955.965,
              speed: 55.55555555555556,
            },
            {
              position: 13210.965,
              speed: 55.55555555555556,
            },
            {
              position: 13210.965,
              speed: 55.55555555555556,
            },
            {
              position: 13220.965,
              speed: 55.55555555555556,
            },
            {
              position: 13220.965,
              speed: 55.55555555555556,
            },
            {
              position: 13301.965,
              speed: 55.55555555555556,
            },
            {
              position: 13301.965,
              speed: 55.55555555555556,
            },
            {
              position: 13319.965,
              speed: 55.55555555555556,
            },
            {
              position: 13319.965,
              speed: 55.55555555555556,
            },
            {
              position: 13741.965,
              speed: 55.55555555555556,
            },
            {
              position: 13741.965,
              speed: 55.55555555555556,
            },
            {
              position: 14140.965,
              speed: 55.55555555555556,
            },
            {
              position: 14140.965,
              speed: 55.55555555555556,
            },
            {
              position: 15203.965,
              speed: 55.55555555555556,
            },
            {
              position: 15203.965,
              speed: 61.11111111111111,
            },
            {
              position: 15353.965,
              speed: 61.11111111111111,
            },
            {
              position: 15353.965,
              speed: 75,
            },
            {
              position: 15365.965,
              speed: 75,
            },
            {
              position: 15365.965,
              speed: 83.33333333333333,
            },
            {
              position: 17246.965,
              speed: 83.33333333333333,
            },
            {
              position: 17246.965,
              speed: 83.33333333333333,
            },
            {
              position: 18895.965,
              speed: 83.33333333333333,
            },
            {
              position: 18895.965,
              speed: 83.33333333333333,
            },
            {
              position: 20763.965,
              speed: 83.33333333333333,
            },
            {
              position: 20763.965,
              speed: 83.33333333333333,
            },
            {
              position: 22909.965,
              speed: 83.33333333333333,
            },
            {
              position: 22909.965,
              speed: 83.33333333333333,
            },
            {
              position: 24630.965,
              speed: 83.33333333333333,
            },
            {
              position: 24630.965,
              speed: 83.33333333333333,
            },
            {
              position: 25414.965,
              speed: 83.33333333333333,
            },
            {
              position: 25414.965,
              speed: 83.33333333333333,
            },
            {
              position: 25494.965,
              speed: 83.33333333333333,
            },
            {
              position: 25494.965,
              speed: 83.33333333333333,
            },
            {
              position: 25768.965,
              speed: 83.33333333333333,
            },
            {
              position: 25768.965,
              speed: 83.33333333333333,
            },
            {
              position: 26965.965,
              speed: 83.33333333333333,
            },
            {
              position: 26965.965,
              speed: 83.33333333333333,
            },
            {
              position: 27028.965,
              speed: 83.33333333333333,
            },
            {
              position: 27028.965,
              speed: 83.33333333333333,
            },
            {
              position: 31122.965,
              speed: 83.33333333333333,
            },
            {
              position: 31122.965,
              speed: 83.33333333333333,
            },
            {
              position: 33524.965,
              speed: 83.33333333333333,
            },
            {
              position: 33524.965,
              speed: 83.33333333333333,
            },
            {
              position: 35697.965,
              speed: 83.33333333333333,
            },
            {
              position: 35697.965,
              speed: 83.33333333333333,
            },
            {
              position: 40073.965,
              speed: 83.33333333333333,
            },
            {
              position: 40073.965,
              speed: 83.33333333333333,
            },
            {
              position: 42824.965,
              speed: 83.33333333333333,
            },
            {
              position: 42824.965,
              speed: 83.33333333333333,
            },
            {
              position: 43318.965,
              speed: 83.33333333333333,
            },
            {
              position: 43318.965,
              speed: 83.33333333333333,
            },
            {
              position: 43950.965,
              speed: 83.33333333333333,
            },
            {
              position: 43950.965,
              speed: 83.33333333333333,
            },
            {
              position: 45287.965,
              speed: 83.33333333333333,
            },
            {
              position: 45287.965,
              speed: 83.33333333333333,
            },
            {
              position: 47558.965,
              speed: 83.33333333333333,
            },
            {
              position: 47558.965,
              speed: 83.33333333333333,
            },
            {
              position: 49678.965,
              speed: 83.33333333333333,
            },
            {
              position: 49678.965,
              speed: 83.33333333333333,
            },
            {
              position: 51800.965,
              speed: 83.33333333333333,
            },
            {
              position: 51800.965,
              speed: 83.33333333333333,
            },
            {
              position: 53887.965,
              speed: 83.33333333333333,
            },
            {
              position: 53887.965,
              speed: 83.33333333333333,
            },
            {
              position: 55490.965,
              speed: 83.33333333333333,
            },
            {
              position: 55490.965,
              speed: 83.33333333333333,
            },
            {
              position: 55975.965,
              speed: 83.33333333333333,
            },
            {
              position: 55975.965,
              speed: 83.33333333333333,
            },
            {
              position: 60045.965,
              speed: 83.33333333333333,
            },
            {
              position: 60045.965,
              speed: 83.33333333333333,
            },
            {
              position: 62328.965,
              speed: 83.33333333333333,
            },
            {
              position: 62328.965,
              speed: 83.33333333333333,
            },
            {
              position: 64579.965,
              speed: 83.33333333333333,
            },
            {
              position: 64579.965,
              speed: 83.33333333333333,
            },
            {
              position: 65809.965,
              speed: 83.33333333333333,
            },
            {
              position: 65809.965,
              speed: 83.33333333333333,
            },
            {
              position: 66069.965,
              speed: 83.33333333333333,
            },
            {
              position: 66069.965,
              speed: 83.33333333333333,
            },
            {
              position: 66344.965,
              speed: 83.33333333333333,
            },
            {
              position: 66344.965,
              speed: 83.33333333333333,
            },
            {
              position: 66384.965,
              speed: 83.33333333333333,
            },
            {
              position: 66384.965,
              speed: 83.33333333333333,
            },
            {
              position: 66538.965,
              speed: 83.33333333333333,
            },
            {
              position: 66538.965,
              speed: 83.33333333333333,
            },
            {
              position: 67146.965,
              speed: 83.33333333333333,
            },
            {
              position: 67146.965,
              speed: 83.33333333333333,
            },
            {
              position: 67194.965,
              speed: 83.33333333333333,
            },
            {
              position: 67194.965,
              speed: 83.33333333333333,
            },
            {
              position: 67349.965,
              speed: 83.33333333333333,
            },
            {
              position: 67349.965,
              speed: 83.33333333333333,
            },
            {
              position: 67389.965,
              speed: 83.33333333333333,
            },
            {
              position: 67389.965,
              speed: 83.33333333333333,
            },
            {
              position: 67664.965,
              speed: 83.33333333333333,
            },
            {
              position: 67664.965,
              speed: 83.33333333333333,
            },
            {
              position: 69177.965,
              speed: 83.33333333333333,
            },
            {
              position: 69177.965,
              speed: 83.33333333333333,
            },
            {
              position: 71344.965,
              speed: 83.33333333333333,
            },
            {
              position: 71344.965,
              speed: 83.33333333333333,
            },
            {
              position: 73511.965,
              speed: 83.33333333333333,
            },
            {
              position: 73511.965,
              speed: 83.33333333333333,
            },
            {
              position: 75663.965,
              speed: 83.33333333333333,
            },
            {
              position: 75663.965,
              speed: 83.33333333333333,
            },
            {
              position: 77852.965,
              speed: 83.33333333333333,
            },
            {
              position: 77852.965,
              speed: 83.33333333333333,
            },
            {
              position: 80001.965,
              speed: 83.33333333333333,
            },
            {
              position: 80001.965,
              speed: 83.33333333333333,
            },
            {
              position: 82179.965,
              speed: 83.33333333333333,
            },
            {
              position: 82179.965,
              speed: 83.33333333333333,
            },
            {
              position: 84345.965,
              speed: 83.33333333333333,
            },
            {
              position: 84345.965,
              speed: 83.33333333333333,
            },
            {
              position: 86513.965,
              speed: 83.33333333333333,
            },
            {
              position: 86513.965,
              speed: 83.33333333333333,
            },
            {
              position: 88680.965,
              speed: 83.33333333333333,
            },
            {
              position: 88680.965,
              speed: 83.33333333333333,
            },
            {
              position: 90845.965,
              speed: 83.33333333333333,
            },
            {
              position: 90845.965,
              speed: 83.33333333333333,
            },
            {
              position: 91607.965,
              speed: 83.33333333333333,
            },
            {
              position: 91607.965,
              speed: 83.33333333333333,
            },
            {
              position: 92236.965,
              speed: 83.33333333333333,
            },
            {
              position: 92236.965,
              speed: 83.33333333333333,
            },
            {
              position: 92937.965,
              speed: 83.33333333333333,
            },
            {
              position: 92937.965,
              speed: 83.33333333333333,
            },
            {
              position: 95023.965,
              speed: 83.33333333333333,
            },
            {
              position: 95023.965,
              speed: 83.33333333333333,
            },
            {
              position: 97273.965,
              speed: 83.33333333333333,
            },
            {
              position: 97273.965,
              speed: 83.33333333333333,
            },
            {
              position: 99525.965,
              speed: 83.33333333333333,
            },
            {
              position: 99525.965,
              speed: 83.33333333333333,
            },
            {
              position: 101777.965,
              speed: 83.33333333333333,
            },
            {
              position: 101777.965,
              speed: 83.33333333333333,
            },
            {
              position: 104018.965,
              speed: 83.33333333333333,
            },
            {
              position: 104018.965,
              speed: 83.33333333333333,
            },
            {
              position: 106281.965,
              speed: 83.33333333333333,
            },
            {
              position: 106281.965,
              speed: 83.33333333333333,
            },
            {
              position: 108533.965,
              speed: 83.33333333333333,
            },
            {
              position: 108533.965,
              speed: 83.33333333333333,
            },
            {
              position: 111188.965,
              speed: 83.33333333333333,
            },
            {
              position: 111188.965,
              speed: 83.33333333333333,
            },
            {
              position: 112626.965,
              speed: 83.33333333333333,
            },
            {
              position: 112626.965,
              speed: 83.33333333333333,
            },
            {
              position: 113559.965,
              speed: 83.33333333333333,
            },
            {
              position: 113559.965,
              speed: 83.33333333333333,
            },
            {
              position: 114221.965,
              speed: 83.33333333333333,
            },
            {
              position: 114221.965,
              speed: 83.33333333333333,
            },
            {
              position: 115729.965,
              speed: 83.33333333333333,
            },
            {
              position: 115729.965,
              speed: 83.33333333333333,
            },
            {
              position: 117865.965,
              speed: 83.33333333333333,
            },
            {
              position: 117865.965,
              speed: 83.33333333333333,
            },
            {
              position: 120019.965,
              speed: 83.33333333333333,
            },
            {
              position: 120019.965,
              speed: 83.33333333333333,
            },
            {
              position: 124073.965,
              speed: 83.33333333333333,
            },
            {
              position: 124073.965,
              speed: 83.33333333333333,
            },
            {
              position: 126210.965,
              speed: 83.33333333333333,
            },
            {
              position: 126210.965,
              speed: 83.33333333333333,
            },
            {
              position: 128143.965,
              speed: 83.33333333333333,
            },
            {
              position: 128143.965,
              speed: 83.33333333333333,
            },
            {
              position: 129638.965,
              speed: 83.33333333333333,
            },
            {
              position: 129638.965,
              speed: 83.33333333333333,
            },
            {
              position: 130644.965,
              speed: 83.33333333333333,
            },
            {
              position: 130644.965,
              speed: 83.33333333333333,
            },
            {
              position: 130900.965,
              speed: 83.33333333333333,
            },
            {
              position: 130900.965,
              speed: 83.33333333333333,
            },
            {
              position: 132862.965,
              speed: 83.33333333333333,
            },
            {
              position: 132862.965,
              speed: 83.33333333333333,
            },
            {
              position: 132865.965,
              speed: 83.33333333333333,
            },
            {
              position: 132865.965,
              speed: 83.33333333333333,
            },
            {
              position: 132942.965,
              speed: 83.33333333333333,
            },
            {
              position: 132942.965,
              speed: 83.33333333333333,
            },
            {
              position: 133377.965,
              speed: 83.33333333333333,
            },
            {
              position: 133377.965,
              speed: 83.33333333333333,
            },
            {
              position: 133457.965,
              speed: 83.33333333333333,
            },
            {
              position: 133457.965,
              speed: 83.33333333333333,
            },
            {
              position: 134942.965,
              speed: 83.33333333333333,
            },
            {
              position: 134942.965,
              speed: 83.33333333333333,
            },
            {
              position: 137363.965,
              speed: 83.33333333333333,
            },
            {
              position: 137363.965,
              speed: 83.33333333333333,
            },
            {
              position: 139603.965,
              speed: 83.33333333333333,
            },
            {
              position: 139603.965,
              speed: 83.33333333333333,
            },
            {
              position: 141935.965,
              speed: 83.33333333333333,
            },
            {
              position: 141935.965,
              speed: 83.33333333333333,
            },
            {
              position: 144265.965,
              speed: 83.33333333333333,
            },
            {
              position: 144265.965,
              speed: 83.33333333333333,
            },
            {
              position: 146602.965,
              speed: 83.33333333333333,
            },
            {
              position: 146602.965,
              speed: 83.33333333333333,
            },
            {
              position: 148279.965,
              speed: 83.33333333333333,
            },
            {
              position: 148279.965,
              speed: 83.33333333333333,
            },
            {
              position: 148319.965,
              speed: 83.33333333333333,
            },
            {
              position: 148319.965,
              speed: 83.33333333333333,
            },
            {
              position: 148945.965,
              speed: 83.33333333333333,
            },
            {
              position: 148945.965,
              speed: 83.33333333333333,
            },
            {
              position: 149283.965,
              speed: 83.33333333333333,
            },
            {
              position: 149283.965,
              speed: 83.33333333333333,
            },
            {
              position: 149323.965,
              speed: 83.33333333333333,
            },
            {
              position: 149323.965,
              speed: 83.33333333333333,
            },
            {
              position: 151085.965,
              speed: 83.33333333333333,
            },
            {
              position: 151085.965,
              speed: 83.33333333333333,
            },
            {
              position: 153316.965,
              speed: 83.33333333333333,
            },
            {
              position: 153316.965,
              speed: 83.33333333333333,
            },
            {
              position: 155693.965,
              speed: 83.33333333333333,
            },
            {
              position: 155693.965,
              speed: 83.33333333333333,
            },
            {
              position: 157928.965,
              speed: 83.33333333333333,
            },
            {
              position: 157928.965,
              speed: 83.33333333333333,
            },
            {
              position: 159754.965,
              speed: 83.33333333333333,
            },
            {
              position: 159754.965,
              speed: 83.33333333333333,
            },
            {
              position: 161590.965,
              speed: 83.33333333333333,
            },
            {
              position: 161590.965,
              speed: 83.33333333333333,
            },
            {
              position: 163491.965,
              speed: 83.33333333333333,
            },
            {
              position: 163491.965,
              speed: 83.33333333333333,
            },
            {
              position: 166348.965,
              speed: 83.33333333333333,
            },
            {
              position: 166348.965,
              speed: 83.33333333333333,
            },
            {
              position: 168818.965,
              speed: 83.33333333333333,
            },
            {
              position: 168818.965,
              speed: 83.33333333333333,
            },
            {
              position: 170892.965,
              speed: 83.33333333333333,
            },
            {
              position: 170892.965,
              speed: 83.33333333333333,
            },
            {
              position: 172121.965,
              speed: 83.33333333333333,
            },
            {
              position: 172121.965,
              speed: 83.33333333333333,
            },
            {
              position: 172201.965,
              speed: 83.33333333333333,
            },
            {
              position: 172201.965,
              speed: 83.33333333333333,
            },
            {
              position: 173001.965,
              speed: 83.33333333333333,
            },
            {
              position: 173001.965,
              speed: 83.33333333333333,
            },
            {
              position: 175240.965,
              speed: 83.33333333333333,
            },
            {
              position: 175240.965,
              speed: 83.33333333333333,
            },
            {
              position: 177510.965,
              speed: 83.33333333333333,
            },
            {
              position: 177510.965,
              speed: 83.33333333333333,
            },
            {
              position: 178970.965,
              speed: 83.33333333333333,
            },
            {
              position: 178970.965,
              speed: 83.33333333333333,
            },
            {
              position: 179011.965,
              speed: 83.33333333333333,
            },
            {
              position: 179011.965,
              speed: 61.11111111111111,
            },
            {
              position: 179935.965,
              speed: 61.11111111111111,
            },
            {
              position: 179935.965,
              speed: 61.11111111111111,
            },
            {
              position: 181333.965,
              speed: 61.11111111111111,
            },
            {
              position: 181333.965,
              speed: 61.11111111111111,
            },
            {
              position: 181568.965,
              speed: 61.11111111111111,
            },
            {
              position: 181568.965,
              speed: 61.11111111111111,
            },
            {
              position: 181688.965,
              speed: 61.11111111111111,
            },
            {
              position: 181688.965,
              speed: 61.11111111111111,
            },
            {
              position: 181898.965,
              speed: 61.11111111111111,
            },
            {
              position: 181898.965,
              speed: 61.11111111111111,
            },
            {
              position: 182191.965,
              speed: 61.11111111111111,
            },
            {
              position: 182191.965,
              speed: 61.11111111111111,
            },
            {
              position: 182260.965,
              speed: 61.11111111111111,
            },
            {
              position: 182260.965,
              speed: 61.11111111111111,
            },
            {
              position: 182488.965,
              speed: 61.11111111111111,
            },
            {
              position: 182488.965,
              speed: 61.11111111111111,
            },
            {
              position: 185298.965,
              speed: 61.11111111111111,
            },
            {
              position: 185298.965,
              speed: 61.11111111111111,
            },
            {
              position: 188618.965,
              speed: 61.11111111111111,
            },
            {
              position: 188618.965,
              speed: 61.11111111111111,
            },
            {
              position: 189798.965,
              speed: 61.11111111111111,
            },
            {
              position: 189798.965,
              speed: 61.11111111111111,
            },
            {
              position: 189998.965,
              speed: 61.11111111111111,
            },
            {
              position: 189998.965,
              speed: 61.11111111111111,
            },
            {
              position: 190262.965,
              speed: 61.11111111111111,
            },
            {
              position: 190262.965,
              speed: 61.11111111111111,
            },
            {
              position: 190396.965,
              speed: 61.11111111111111,
            },
            {
              position: 190396.965,
              speed: 61.11111111111111,
            },
            {
              position: 190866.965,
              speed: 61.11111111111111,
            },
            {
              position: 190866.965,
              speed: 61.11111111111111,
            },
            {
              position: 191951.965,
              speed: 61.11111111111111,
            },
            {
              position: 191951.965,
              speed: 61.11111111111111,
            },
            {
              position: 199088.965,
              speed: 61.11111111111111,
            },
            {
              position: 199088.965,
              speed: 61.11111111111111,
            },
            {
              position: 199294.965,
              speed: 61.11111111111111,
            },
            {
              position: 199294.965,
              speed: 61.11111111111111,
            },
            {
              position: 199308.965,
              speed: 61.11111111111111,
            },
            {
              position: 199308.965,
              speed: 61.11111111111111,
            },
            {
              position: 199406.965,
              speed: 61.11111111111111,
            },
            {
              position: 199406.965,
              speed: 38.888888888888886,
            },
            {
              position: 199505.965,
              speed: 38.888888888888886,
            },
            {
              position: 199505.965,
              speed: 44.44444444444444,
            },
            {
              position: 199992.965,
              speed: 44.44444444444444,
            },
            {
              position: 199992.965,
              speed: 44.44444444444444,
            },
            {
              position: 200175.965,
              speed: 44.44444444444444,
            },
            {
              position: 200175.965,
              speed: 44.44444444444444,
            },
            {
              position: 200186.965,
              speed: 44.44444444444444,
            },
            {
              position: 200186.965,
              speed: 44.44444444444444,
            },
            {
              position: 200230.965,
              speed: 44.44444444444444,
            },
            {
              position: 200230.965,
              speed: 44.44444444444444,
            },
            {
              position: 200308.965,
              speed: 44.44444444444444,
            },
            {
              position: 200308.965,
              speed: 27.77777777777778,
            },
            {
              position: 200434.965,
              speed: 27.77777777777778,
            },
            {
              position: 200434.965,
              speed: 27.77777777777778,
            },
            {
              position: 200659.965,
              speed: 27.77777777777778,
            },
            {
              position: 200659.965,
              speed: 27.77777777777778,
            },
            {
              position: 200671.965,
              speed: 27.77777777777778,
            },
            {
              position: 200671.965,
              speed: 27.77777777777778,
            },
            {
              position: 200683.965,
              speed: 27.77777777777778,
            },
            {
              position: 200683.965,
              speed: 27.77777777777778,
            },
            {
              position: 200754.965,
              speed: 27.77777777777778,
            },
            {
              position: 200754.965,
              speed: 27.77777777777778,
            },
            {
              position: 200952.965,
              speed: 27.77777777777778,
            },
            {
              position: 200952.965,
              speed: 27.77777777777778,
            },
            {
              position: 201408.607,
              speed: 27.77777777777778,
            },
          ],
          slopes: [
            {
              gradient: 0,
              position: 0,
            },
            {
              gradient: 0,
              position: 551.965,
            },
            {
              gradient: 7.7,
              position: 551.965,
            },
            {
              gradient: 7.7,
              position: 565.965,
            },
            {
              gradient: 4.1,
              position: 565.965,
            },
            {
              gradient: 4.1,
              position: 637.965,
            },
            {
              gradient: 0,
              position: 637.965,
            },
            {
              gradient: 0,
              position: 802.965,
            },
            {
              gradient: 3.3,
              position: 802.965,
            },
            {
              gradient: 3.3,
              position: 892.965,
            },
            {
              gradient: 0,
              position: 892.965,
            },
            {
              gradient: 0,
              position: 1365.965,
            },
            {
              gradient: 8.4,
              position: 1365.965,
            },
            {
              gradient: 8.4,
              position: 1565.965,
            },
            {
              gradient: 4.2,
              position: 1565.965,
            },
            {
              gradient: 4.2,
              position: 1724.965,
            },
            {
              gradient: 0,
              position: 1724.965,
            },
            {
              gradient: 0,
              position: 1772.965,
            },
            {
              gradient: 5,
              position: 1772.965,
            },
            {
              gradient: 5,
              position: 1905.965,
            },
            {
              gradient: 9.3,
              position: 1905.965,
            },
            {
              gradient: 9.3,
              position: 2015.965,
            },
            {
              gradient: 11.5,
              position: 2015.965,
            },
            {
              gradient: 11.5,
              position: 2487.965,
            },
            {
              gradient: 11.3,
              position: 2487.965,
            },
            {
              gradient: 11.3,
              position: 2776.965,
            },
            {
              gradient: 0,
              position: 2776.965,
            },
            {
              gradient: 0,
              position: 2891.965,
            },
            {
              gradient: 7.1,
              position: 2891.965,
            },
            {
              gradient: 7.1,
              position: 3157.965,
            },
            {
              gradient: 10,
              position: 3157.965,
            },
            {
              gradient: 10,
              position: 3367.965,
            },
            {
              gradient: 0,
              position: 3367.965,
            },
            {
              gradient: 0,
              position: 3494.965,
            },
            {
              gradient: 10,
              position: 3494.965,
            },
            {
              gradient: 10,
              position: 3892.965,
            },
            {
              gradient: 1.1,
              position: 3892.965,
            },
            {
              gradient: 1.1,
              position: 4144.965,
            },
            {
              gradient: 0.4,
              position: 4144.965,
            },
            {
              gradient: 0.4,
              position: 4429.965,
            },
            {
              gradient: 0.9,
              position: 4429.965,
            },
            {
              gradient: 0.9,
              position: 4706.965,
            },
            {
              gradient: 0.3,
              position: 4706.965,
            },
            {
              gradient: 0.3,
              position: 5034.965,
            },
            {
              gradient: 1.1,
              position: 5034.965,
            },
            {
              gradient: 1.1,
              position: 5571.965,
            },
            {
              gradient: 1.6,
              position: 5571.965,
            },
            {
              gradient: 1.6,
              position: 5743.965,
            },
            {
              gradient: 2,
              position: 5743.965,
            },
            {
              gradient: 2,
              position: 5775.965,
            },
            {
              gradient: 0,
              position: 5775.965,
            },
            {
              gradient: 0,
              position: 5993.965,
            },
            {
              gradient: -20,
              position: 5993.965,
            },
            {
              gradient: -20,
              position: 6460.965,
            },
            {
              gradient: 0,
              position: 6460.965,
            },
            {
              gradient: 0,
              position: 6557.965,
            },
            {
              gradient: -25,
              position: 6557.965,
            },
            {
              gradient: -25,
              position: 6991.965,
            },
            {
              gradient: 0,
              position: 6991.965,
            },
            {
              gradient: 0,
              position: 7273.965,
            },
            {
              gradient: 3,
              position: 7273.965,
            },
            {
              gradient: 3,
              position: 7702.965,
            },
            {
              gradient: 0,
              position: 7702.965,
            },
            {
              gradient: 0,
              position: 7920.965,
            },
            {
              gradient: 25,
              position: 7920.965,
            },
            {
              gradient: 25,
              position: 8029.965,
            },
            {
              gradient: 0,
              position: 8029.965,
            },
            {
              gradient: 0,
              position: 8209.965,
            },
            {
              gradient: 7,
              position: 8209.965,
            },
            {
              gradient: 7,
              position: 8331.965,
            },
            {
              gradient: 0,
              position: 8331.965,
            },
            {
              gradient: 0,
              position: 8457.965,
            },
            {
              gradient: 16,
              position: 8457.965,
            },
            {
              gradient: 16,
              position: 8877.965,
            },
            {
              gradient: 0,
              position: 8877.965,
            },
            {
              gradient: 0,
              position: 9189.965,
            },
            {
              gradient: -10,
              position: 9189.965,
            },
            {
              gradient: -10,
              position: 9332.965,
            },
            {
              gradient: 0,
              position: 9332.965,
            },
            {
              gradient: 0,
              position: 9490.965,
            },
            {
              gradient: 3,
              position: 9490.965,
            },
            {
              gradient: 3,
              position: 9782.965,
            },
            {
              gradient: 0,
              position: 9782.965,
            },
            {
              gradient: 0,
              position: 9848.965,
            },
            {
              gradient: 8.5,
              position: 9848.965,
            },
            {
              gradient: 8.5,
              position: 9978.965,
            },
            {
              gradient: 0,
              position: 9978.965,
            },
            {
              gradient: 0,
              position: 10346.965,
            },
            {
              gradient: -14.5,
              position: 10346.965,
            },
            {
              gradient: -14.5,
              position: 10618.965,
            },
            {
              gradient: 0,
              position: 10618.965,
            },
            {
              gradient: 0,
              position: 10690.965,
            },
            {
              gradient: -10,
              position: 10690.965,
            },
            {
              gradient: -10,
              position: 11647.965,
            },
            {
              gradient: 0,
              position: 11647.965,
            },
            {
              gradient: 0,
              position: 11759.965,
            },
            {
              gradient: -3.1,
              position: 11759.965,
            },
            {
              gradient: -3.1,
              position: 12015.965,
            },
            {
              gradient: 0,
              position: 12015.965,
            },
            {
              gradient: 0,
              position: 12115.965,
            },
            {
              gradient: 2,
              position: 12115.965,
            },
            {
              gradient: 2,
              position: 12358.965,
            },
            {
              gradient: 0,
              position: 12358.965,
            },
            {
              gradient: 0,
              position: 12502.965,
            },
            {
              gradient: 14,
              position: 12502.965,
            },
            {
              gradient: 14,
              position: 13084.965,
            },
            {
              gradient: 0,
              position: 13084.965,
            },
            {
              gradient: 0,
              position: 13258.965,
            },
            {
              gradient: -0.5,
              position: 13258.965,
            },
            {
              gradient: -0.5,
              position: 14550.965,
            },
            {
              gradient: 0,
              position: 14550.965,
            },
            {
              gradient: 0,
              position: 14724.965,
            },
            {
              gradient: -15,
              position: 14724.965,
            },
            {
              gradient: -15,
              position: 14886.965,
            },
            {
              gradient: 0,
              position: 14886.965,
            },
            {
              gradient: 0,
              position: 14976.965,
            },
            {
              gradient: -12,
              position: 14976.965,
            },
            {
              gradient: -12,
              position: 15383.965,
            },
            {
              gradient: 0,
              position: 15383.965,
            },
            {
              gradient: 0,
              position: 15479.965,
            },
            {
              gradient: -4,
              position: 15479.965,
            },
            {
              gradient: -4,
              position: 15854.965,
            },
            {
              gradient: 0,
              position: 15854.965,
            },
            {
              gradient: 0,
              position: 15944.965,
            },
            {
              gradient: -1,
              position: 15944.965,
            },
            {
              gradient: -1,
              position: 16126.965,
            },
            {
              gradient: 0,
              position: 16126.965,
            },
            {
              gradient: 0,
              position: 16322.965,
            },
            {
              gradient: 13,
              position: 16322.965,
            },
            {
              gradient: 13,
              position: 16557.965,
            },
            {
              gradient: 0,
              position: 16557.965,
            },
            {
              gradient: 0,
              position: 16637.965,
            },
            {
              gradient: 15,
              position: 16637.965,
            },
            {
              gradient: 15,
              position: 17659.965,
            },
            {
              gradient: 0,
              position: 17659.965,
            },
            {
              gradient: 0,
              position: 17784.965,
            },
            {
              gradient: 20,
              position: 17784.965,
            },
            {
              gradient: 20,
              position: 18035.965,
            },
            {
              gradient: 20.6,
              position: 18035.965,
            },
            {
              gradient: 20.6,
              position: 18135.965,
            },
            {
              gradient: 20,
              position: 18135.965,
            },
            {
              gradient: 20,
              position: 18743.965,
            },
            {
              gradient: 0,
              position: 18743.965,
            },
            {
              gradient: 0,
              position: 19068.965,
            },
            {
              gradient: 7,
              position: 19068.965,
            },
            {
              gradient: 7,
              position: 20600.965,
            },
            {
              gradient: 0,
              position: 20600.965,
            },
            {
              gradient: 0,
              position: 20850.965,
            },
            {
              gradient: -3,
              position: 20850.965,
            },
            {
              gradient: -3,
              position: 23000.965,
            },
            {
              gradient: 0,
              position: 23000.965,
            },
            {
              gradient: 0,
              position: 23080.965,
            },
            {
              gradient: -6.2,
              position: 23080.965,
            },
            {
              gradient: -6.2,
              position: 23311.965,
            },
            {
              gradient: 0,
              position: 23311.965,
            },
            {
              gradient: 0,
              position: 23811.965,
            },
            {
              gradient: 25,
              position: 23811.965,
            },
            {
              gradient: 25,
              position: 24561.965,
            },
            {
              gradient: 0,
              position: 24561.965,
            },
            {
              gradient: 0,
              position: 24831.965,
            },
            {
              gradient: 11.5,
              position: 24831.965,
            },
            {
              gradient: 11.5,
              position: 25494.965,
            },
            {
              gradient: 0,
              position: 25494.965,
            },
            {
              gradient: 0,
              position: 25768.965,
            },
            {
              gradient: 11.5,
              position: 25768.965,
            },
            {
              gradient: 11.5,
              position: 26573.965,
            },
            {
              gradient: 0,
              position: 26573.965,
            },
            {
              gradient: 0,
              position: 26869.965,
            },
            {
              gradient: -7,
              position: 26869.965,
            },
            {
              gradient: -7,
              position: 27033.965,
            },
            {
              gradient: 0,
              position: 27033.965,
            },
            {
              gradient: 0,
              position: 27113.965,
            },
            {
              gradient: -5,
              position: 27113.965,
            },
            {
              gradient: -5,
              position: 27806.965,
            },
            {
              gradient: 0,
              position: 27806.965,
            },
            {
              gradient: 0,
              position: 28046.965,
            },
            {
              gradient: -20,
              position: 28046.965,
            },
            {
              gradient: -20,
              position: 28759.965,
            },
            {
              gradient: 0,
              position: 28759.965,
            },
            {
              gradient: 0,
              position: 28884.965,
            },
            {
              gradient: -25,
              position: 28884.965,
            },
            {
              gradient: -25,
              position: 29483.965,
            },
            {
              gradient: 0,
              position: 29483.965,
            },
            {
              gradient: 0,
              position: 29623.965,
            },
            {
              gradient: -18,
              position: 29623.965,
            },
            {
              gradient: -18,
              position: 30558.965,
            },
            {
              gradient: 0,
              position: 30558.965,
            },
            {
              gradient: 0,
              position: 31508.965,
            },
            {
              gradient: 20,
              position: 31508.965,
            },
            {
              gradient: 20,
              position: 32233.965,
            },
            {
              gradient: 0,
              position: 32233.965,
            },
            {
              gradient: 0,
              position: 32808.965,
            },
            {
              gradient: -3,
              position: 32808.965,
            },
            {
              gradient: -3,
              position: 34958.965,
            },
            {
              gradient: 0,
              position: 34958.965,
            },
            {
              gradient: 0,
              position: 35326.965,
            },
            {
              gradient: 20,
              position: 35326.965,
            },
            {
              gradient: 20,
              position: 35523.965,
            },
            {
              gradient: 0,
              position: 35523.965,
            },
            {
              gradient: 0,
              position: 35603.965,
            },
            {
              gradient: 25,
              position: 35603.965,
            },
            {
              gradient: 25,
              position: 36252.965,
            },
            {
              gradient: 0,
              position: 36252.965,
            },
            {
              gradient: 0,
              position: 37052.965,
            },
            {
              gradient: -25,
              position: 37052.965,
            },
            {
              gradient: -25,
              position: 38579.965,
            },
            {
              gradient: 0,
              position: 38579.965,
            },
            {
              gradient: 0,
              position: 39129.965,
            },
            {
              gradient: -3,
              position: 39129.965,
            },
            {
              gradient: -3,
              position: 39846.965,
            },
            {
              gradient: 0,
              position: 39846.965,
            },
            {
              gradient: 0,
              position: 39946.965,
            },
            {
              gradient: 1,
              position: 39946.965,
            },
            {
              gradient: 1,
              position: 40421.965,
            },
            {
              gradient: 0,
              position: 40421.965,
            },
            {
              gradient: 0,
              position: 40821.965,
            },
            {
              gradient: 17,
              position: 40821.965,
            },
            {
              gradient: 17,
              position: 41905.965,
            },
            {
              gradient: 0,
              position: 41905.965,
            },
            {
              gradient: 0,
              position: 42105.965,
            },
            {
              gradient: 25,
              position: 42105.965,
            },
            {
              gradient: 25,
              position: 42670.965,
            },
            {
              gradient: 0,
              position: 42670.965,
            },
            {
              gradient: 0,
              position: 42895.965,
            },
            {
              gradient: 16,
              position: 42895.965,
            },
            {
              gradient: 16,
              position: 44526.965,
            },
            {
              gradient: 0,
              position: 44526.965,
            },
            {
              gradient: 0,
              position: 45201.965,
            },
            {
              gradient: -11,
              position: 45201.965,
            },
            {
              gradient: -11,
              position: 46232.965,
            },
            {
              gradient: -10,
              position: 46232.965,
            },
            {
              gradient: -10,
              position: 46837.965,
            },
            {
              gradient: 0,
              position: 46837.965,
            },
            {
              gradient: 0,
              position: 47437.965,
            },
            {
              gradient: 14,
              position: 47437.965,
            },
            {
              gradient: 14,
              position: 47904.965,
            },
            {
              gradient: 0,
              position: 47904.965,
            },
            {
              gradient: 0,
              position: 48379.965,
            },
            {
              gradient: -5,
              position: 48379.965,
            },
            {
              gradient: -5,
              position: 48864.965,
            },
            {
              gradient: 0,
              position: 48864.965,
            },
            {
              gradient: 0,
              position: 49014.965,
            },
            {
              gradient: 1,
              position: 49014.965,
            },
            {
              gradient: 1,
              position: 50045.965,
            },
            {
              gradient: 0,
              position: 50045.965,
            },
            {
              gradient: 0,
              position: 50255.965,
            },
            {
              gradient: 16,
              position: 50255.965,
            },
            {
              gradient: 16,
              position: 50435.965,
            },
            {
              gradient: 0,
              position: 50435.965,
            },
            {
              gradient: 0,
              position: 50931.965,
            },
            {
              gradient: -15,
              position: 50931.965,
            },
            {
              gradient: -15,
              position: 51445.965,
            },
            {
              gradient: 0,
              position: 51445.965,
            },
            {
              gradient: 0,
              position: 51669.965,
            },
            {
              gradient: 1,
              position: 51669.965,
            },
            {
              gradient: 1,
              position: 55391.965,
            },
            {
              gradient: 2,
              position: 55391.965,
            },
            {
              gradient: 2,
              position: 56425.965,
            },
            {
              gradient: 0,
              position: 56425.965,
            },
            {
              gradient: 0,
              position: 56510.965,
            },
            {
              gradient: -1.4,
              position: 56510.965,
            },
            {
              gradient: -1.4,
              position: 58009.965,
            },
            {
              gradient: 0,
              position: 58009.965,
            },
            {
              gradient: 0,
              position: 58162.965,
            },
            {
              gradient: -7.6,
              position: 58162.965,
            },
            {
              gradient: -7.6,
              position: 58733.965,
            },
            {
              gradient: 0,
              position: 58733.965,
            },
            {
              gradient: 0,
              position: 58885.965,
            },
            {
              gradient: -1.5,
              position: 58885.965,
            },
            {
              gradient: -1.5,
              position: 59237.965,
            },
            {
              gradient: 0,
              position: 59237.965,
            },
            {
              gradient: 0,
              position: 59312.965,
            },
            {
              gradient: 1.5,
              position: 59312.965,
            },
            {
              gradient: 1.5,
              position: 59689.965,
            },
            {
              gradient: 0,
              position: 59689.965,
            },
            {
              gradient: 0,
              position: 59777.965,
            },
            {
              gradient: -2,
              position: 59777.965,
            },
            {
              gradient: -2,
              position: 61117.965,
            },
            {
              gradient: 0,
              position: 61117.965,
            },
            {
              gradient: 0,
              position: 61442.965,
            },
            {
              gradient: -15,
              position: 61442.965,
            },
            {
              gradient: -15,
              position: 61589.965,
            },
            {
              gradient: 0,
              position: 61589.965,
            },
            {
              gradient: 0,
              position: 61814.965,
            },
            {
              gradient: -6,
              position: 61814.965,
            },
            {
              gradient: -6,
              position: 62096.965,
            },
            {
              gradient: 0,
              position: 62096.965,
            },
            {
              gradient: 0,
              position: 62346.965,
            },
            {
              gradient: 4,
              position: 62346.965,
            },
            {
              gradient: 4,
              position: 62507.965,
            },
            {
              gradient: 0,
              position: 62507.965,
            },
            {
              gradient: 0,
              position: 62745.965,
            },
            {
              gradient: 13.5,
              position: 62745.965,
            },
            {
              gradient: 13.5,
              position: 62865.965,
            },
            {
              gradient: 0,
              position: 62865.965,
            },
            {
              gradient: 0,
              position: 63077.965,
            },
            {
              gradient: 5,
              position: 63077.965,
            },
            {
              gradient: 5,
              position: 65498.965,
            },
            {
              gradient: 0,
              position: 65498.965,
            },
            {
              gradient: 0,
              position: 65648.965,
            },
            {
              gradient: -1,
              position: 65648.965,
            },
            {
              gradient: -1,
              position: 66069.965,
            },
            {
              gradient: 0,
              position: 66069.965,
            },
            {
              gradient: 0,
              position: 66344.965,
            },
            {
              gradient: -1,
              position: 66344.965,
            },
            {
              gradient: -1,
              position: 66384.965,
            },
            {
              gradient: 0,
              position: 66384.965,
            },
            {
              gradient: 0,
              position: 67349.965,
            },
            {
              gradient: -1,
              position: 67349.965,
            },
            {
              gradient: -1,
              position: 67389.965,
            },
            {
              gradient: 0,
              position: 67389.965,
            },
            {
              gradient: 0,
              position: 67664.965,
            },
            {
              gradient: -1,
              position: 67664.965,
            },
            {
              gradient: -1,
              position: 67993.965,
            },
            {
              gradient: 0,
              position: 67993.965,
            },
            {
              gradient: 0,
              position: 68193.965,
            },
            {
              gradient: -9,
              position: 68193.965,
            },
            {
              gradient: -9,
              position: 68577.965,
            },
            {
              gradient: 0,
              position: 68577.965,
            },
            {
              gradient: 0,
              position: 68702.965,
            },
            {
              gradient: -4,
              position: 68702.965,
            },
            {
              gradient: -4,
              position: 69075.965,
            },
            {
              gradient: 0,
              position: 69075.965,
            },
            {
              gradient: 0,
              position: 69337.965,
            },
            {
              gradient: 6.5,
              position: 69337.965,
            },
            {
              gradient: 6.5,
              position: 69709.965,
            },
            {
              gradient: 0,
              position: 69709.965,
            },
            {
              gradient: 0,
              position: 69971.965,
            },
            {
              gradient: -4,
              position: 69971.965,
            },
            {
              gradient: -4,
              position: 70131.965,
            },
            {
              gradient: 0,
              position: 70131.965,
            },
            {
              gradient: 0,
              position: 70269.965,
            },
            {
              gradient: 1.5,
              position: 70269.965,
            },
            {
              gradient: 1.5,
              position: 70625.965,
            },
            {
              gradient: 0,
              position: 70625.965,
            },
            {
              gradient: 0,
              position: 70765.965,
            },
            {
              gradient: -2,
              position: 70765.965,
            },
            {
              gradient: -2,
              position: 71235.965,
            },
            {
              gradient: 0,
              position: 71235.965,
            },
            {
              gradient: 0,
              position: 71435.965,
            },
            {
              gradient: 3,
              position: 71435.965,
            },
            {
              gradient: 3,
              position: 72930.965,
            },
            {
              gradient: 0,
              position: 72930.965,
            },
            {
              gradient: 0,
              position: 73110.965,
            },
            {
              gradient: -1.5,
              position: 73110.965,
            },
            {
              gradient: -1.5,
              position: 73784.965,
            },
            {
              gradient: 0,
              position: 73784.965,
            },
            {
              gradient: 0,
              position: 73904.965,
            },
            {
              gradient: 1.5,
              position: 73904.965,
            },
            {
              gradient: 1.5,
              position: 74459.965,
            },
            {
              gradient: 0,
              position: 74459.965,
            },
            {
              gradient: 0,
              position: 74619.965,
            },
            {
              gradient: -2.5,
              position: 74619.965,
            },
            {
              gradient: -2.5,
              position: 76032.965,
            },
            {
              gradient: 0,
              position: 76032.965,
            },
            {
              gradient: 0,
              position: 76212.965,
            },
            {
              gradient: 2,
              position: 76212.965,
            },
            {
              gradient: 2,
              position: 76752.965,
            },
            {
              gradient: 0,
              position: 76752.965,
            },
            {
              gradient: 0,
              position: 76912.965,
            },
            {
              gradient: -2,
              position: 76912.965,
            },
            {
              gradient: -2,
              position: 77266.965,
            },
            {
              gradient: 0,
              position: 77266.965,
            },
            {
              gradient: 0,
              position: 77426.965,
            },
            {
              gradient: 2,
              position: 77426.965,
            },
            {
              gradient: 2,
              position: 77800.965,
            },
            {
              gradient: 0,
              position: 77800.965,
            },
            {
              gradient: 0,
              position: 77920.965,
            },
            {
              gradient: -1,
              position: 77920.965,
            },
            {
              gradient: -1,
              position: 78737.965,
            },
            {
              gradient: 0,
              position: 78737.965,
            },
            {
              gradient: 0,
              position: 78777.965,
            },
            {
              gradient: -2,
              position: 78777.965,
            },
            {
              gradient: -2,
              position: 80953.965,
            },
            {
              gradient: 0,
              position: 80953.965,
            },
            {
              gradient: 0,
              position: 81203.965,
            },
            {
              gradient: 8,
              position: 81203.965,
            },
            {
              gradient: 8,
              position: 81906.965,
            },
            {
              gradient: 0,
              position: 81906.965,
            },
            {
              gradient: 0,
              position: 82810.965,
            },
            {
              gradient: -10,
              position: 82810.965,
            },
            {
              gradient: -10,
              position: 83352.965,
            },
            {
              gradient: 0,
              position: 83352.965,
            },
            {
              gradient: 0,
              position: 83794.965,
            },
            {
              gradient: 7.7,
              position: 83794.965,
            },
            {
              gradient: 7.7,
              position: 84792.965,
            },
            {
              gradient: 0,
              position: 84792.965,
            },
            {
              gradient: 0,
              position: 85034.965,
            },
            {
              gradient: -2,
              position: 85034.965,
            },
            {
              gradient: -2,
              position: 86877.965,
            },
            {
              gradient: 0,
              position: 86877.965,
            },
            {
              gradient: 0,
              position: 86997.965,
            },
            {
              gradient: -5,
              position: 86997.965,
            },
            {
              gradient: -5,
              position: 87809.965,
            },
            {
              gradient: 0,
              position: 87809.965,
            },
            {
              gradient: 0,
              position: 88089.965,
            },
            {
              gradient: 2,
              position: 88089.965,
            },
            {
              gradient: 2,
              position: 88589.965,
            },
            {
              gradient: 0,
              position: 88589.965,
            },
            {
              gradient: 0,
              position: 88749.965,
            },
            {
              gradient: -2,
              position: 88749.965,
            },
            {
              gradient: -2,
              position: 89005.965,
            },
            {
              gradient: 0,
              position: 89005.965,
            },
            {
              gradient: 0,
              position: 89065.965,
            },
            {
              gradient: -0.5,
              position: 89065.965,
            },
            {
              gradient: -0.5,
              position: 90087.965,
            },
            {
              gradient: 0,
              position: 90087.965,
            },
            {
              gradient: 0,
              position: 90335.965,
            },
            {
              gradient: 5.7,
              position: 90335.965,
            },
            {
              gradient: 5.7,
              position: 90845.965,
            },
            {
              gradient: 0,
              position: 90845.965,
            },
            {
              gradient: 0,
              position: 91215.965,
            },
            {
              gradient: -5,
              position: 91215.965,
            },
            {
              gradient: -5,
              position: 92361.965,
            },
            {
              gradient: 0,
              position: 92361.965,
            },
            {
              gradient: 0,
              position: 92598.965,
            },
            {
              gradient: 4.5,
              position: 92598.965,
            },
            {
              gradient: 4.5,
              position: 92886.965,
            },
            {
              gradient: 0,
              position: 92886.965,
            },
            {
              gradient: 0,
              position: 93073.965,
            },
            {
              gradient: -3,
              position: 93073.965,
            },
            {
              gradient: -3,
              position: 93439.965,
            },
            {
              gradient: 0,
              position: 93439.965,
            },
            {
              gradient: 0,
              position: 93719.965,
            },
            {
              gradient: 4,
              position: 93719.965,
            },
            {
              gradient: 4,
              position: 94304.965,
            },
            {
              gradient: 0,
              position: 94304.965,
            },
            {
              gradient: 0,
              position: 94504.965,
            },
            {
              gradient: -4,
              position: 94504.965,
            },
            {
              gradient: -4,
              position: 95828.965,
            },
            {
              gradient: 0,
              position: 95828.965,
            },
            {
              gradient: 0,
              position: 95953.965,
            },
            {
              gradient: 1,
              position: 95953.965,
            },
            {
              gradient: 1,
              position: 96910.965,
            },
            {
              gradient: 0,
              position: 96910.965,
            },
            {
              gradient: 0,
              position: 97110.965,
            },
            {
              gradient: 6,
              position: 97110.965,
            },
            {
              gradient: 6,
              position: 97483.965,
            },
            {
              gradient: 0,
              position: 97483.965,
            },
            {
              gradient: 0,
              position: 97758.965,
            },
            {
              gradient: -5,
              position: 97758.965,
            },
            {
              gradient: -5,
              position: 98540.965,
            },
            {
              gradient: 0,
              position: 98540.965,
            },
            {
              gradient: 0,
              position: 99141.965,
            },
            {
              gradient: -2.5,
              position: 99141.965,
            },
            {
              gradient: -2.5,
              position: 99731.965,
            },
            {
              gradient: 0,
              position: 99731.965,
            },
            {
              gradient: 0,
              position: 99951.965,
            },
            {
              gradient: 3,
              position: 99951.965,
            },
            {
              gradient: 3,
              position: 100554.965,
            },
            {
              gradient: 0,
              position: 100554.965,
            },
            {
              gradient: 0,
              position: 101022.965,
            },
            {
              gradient: -4,
              position: 101022.965,
            },
            {
              gradient: -4,
              position: 101391.965,
            },
            {
              gradient: 0,
              position: 101391.965,
            },
            {
              gradient: 0,
              position: 101471.965,
            },
            {
              gradient: -2,
              position: 101471.965,
            },
            {
              gradient: -2,
              position: 103763.965,
            },
            {
              gradient: 0,
              position: 103763.965,
            },
            {
              gradient: 0,
              position: 104025.965,
            },
            {
              gradient: 8.5,
              position: 104025.965,
            },
            {
              gradient: 8.5,
              position: 104327.965,
            },
            {
              gradient: 0,
              position: 104327.965,
            },
            {
              gradient: 0,
              position: 104827.965,
            },
            {
              gradient: -11.5,
              position: 104827.965,
            },
            {
              gradient: -11.5,
              position: 105048.965,
            },
            {
              gradient: 0,
              position: 105048.965,
            },
            {
              gradient: 0,
              position: 105286.965,
            },
            {
              gradient: -2,
              position: 105286.965,
            },
            {
              gradient: -2,
              position: 106852.965,
            },
            {
              gradient: 0,
              position: 106852.965,
            },
            {
              gradient: 0,
              position: 107127.965,
            },
            {
              gradient: 9,
              position: 107127.965,
            },
            {
              gradient: 9,
              position: 108119.965,
            },
            {
              gradient: 0,
              position: 108119.965,
            },
            {
              gradient: 0,
              position: 108294.965,
            },
            {
              gradient: 2,
              position: 108294.965,
            },
            {
              gradient: 2,
              position: 108562.965,
            },
            {
              gradient: 0,
              position: 108562.965,
            },
            {
              gradient: 0,
              position: 108787.965,
            },
            {
              gradient: 11,
              position: 108787.965,
            },
            {
              gradient: 11,
              position: 109810.965,
            },
            {
              gradient: 0,
              position: 109810.965,
            },
            {
              gradient: 0,
              position: 110035.965,
            },
            {
              gradient: 20,
              position: 110035.965,
            },
            {
              gradient: 20,
              position: 110958.965,
            },
            {
              gradient: 0,
              position: 110958.965,
            },
            {
              gradient: 0,
              position: 111508.965,
            },
            {
              gradient: -2,
              position: 111508.965,
            },
            {
              gradient: -2,
              position: 112521.965,
            },
            {
              gradient: -1,
              position: 112521.965,
            },
            {
              gradient: -1,
              position: 114320.965,
            },
            {
              gradient: 0,
              position: 114320.965,
            },
            {
              gradient: 0,
              position: 114520.965,
            },
            {
              gradient: -9,
              position: 114520.965,
            },
            {
              gradient: -9,
              position: 115000.965,
            },
            {
              gradient: 0,
              position: 115000.965,
            },
            {
              gradient: 0,
              position: 115150.965,
            },
            {
              gradient: -3,
              position: 115150.965,
            },
            {
              gradient: -3,
              position: 115335.965,
            },
            {
              gradient: 0,
              position: 115335.965,
            },
            {
              gradient: 0,
              position: 115825.965,
            },
            {
              gradient: 2,
              position: 115825.965,
            },
            {
              gradient: 2,
              position: 115997.965,
            },
            {
              gradient: 0,
              position: 115997.965,
            },
            {
              gradient: 0,
              position: 116147.965,
            },
            {
              gradient: -4,
              position: 116147.965,
            },
            {
              gradient: -4,
              position: 116491.965,
            },
            {
              gradient: 0,
              position: 116491.965,
            },
            {
              gradient: 0,
              position: 116691.965,
            },
            {
              gradient: 4,
              position: 116691.965,
            },
            {
              gradient: 4,
              position: 117119.965,
            },
            {
              gradient: 0,
              position: 117119.965,
            },
            {
              gradient: 0,
              position: 117269.965,
            },
            {
              gradient: -2,
              position: 117269.965,
            },
            {
              gradient: -2,
              position: 118651.965,
            },
            {
              gradient: 0,
              position: 118651.965,
            },
            {
              gradient: 0,
              position: 118751.965,
            },
            {
              gradient: 2,
              position: 118751.965,
            },
            {
              gradient: 2,
              position: 119642.965,
            },
            {
              gradient: 0,
              position: 119642.965,
            },
            {
              gradient: 0,
              position: 119742.965,
            },
            {
              gradient: -2,
              position: 119742.965,
            },
            {
              gradient: -2,
              position: 120276.965,
            },
            {
              gradient: 0,
              position: 120276.965,
            },
            {
              gradient: 0,
              position: 120451.965,
            },
            {
              gradient: -9,
              position: 120451.965,
            },
            {
              gradient: -9,
              position: 120968.965,
            },
            {
              gradient: 0,
              position: 120968.965,
            },
            {
              gradient: 0,
              position: 121243.965,
            },
            {
              gradient: 2,
              position: 121243.965,
            },
            {
              gradient: 2,
              position: 122529.965,
            },
            {
              gradient: 0,
              position: 122529.965,
            },
            {
              gradient: 0,
              position: 122654.965,
            },
            {
              gradient: -3,
              position: 122654.965,
            },
            {
              gradient: -3,
              position: 123012.965,
            },
            {
              gradient: 0,
              position: 123012.965,
            },
            {
              gradient: 0,
              position: 123152.965,
            },
            {
              gradient: -6.5,
              position: 123152.965,
            },
            {
              gradient: -6.5,
              position: 123577.965,
            },
            {
              gradient: 0,
              position: 123577.965,
            },
            {
              gradient: 0,
              position: 123789.965,
            },
            {
              gradient: 2,
              position: 123789.965,
            },
            {
              gradient: 2,
              position: 124578.965,
            },
            {
              gradient: 0,
              position: 124578.965,
            },
            {
              gradient: 0,
              position: 124753.965,
            },
            {
              gradient: -5,
              position: 124753.965,
            },
            {
              gradient: -5,
              position: 125412.965,
            },
            {
              gradient: -4,
              position: 125412.965,
            },
            {
              gradient: -4,
              position: 126287.965,
            },
            {
              gradient: 0,
              position: 126287.965,
            },
            {
              gradient: 0,
              position: 126537.965,
            },
            {
              gradient: 6,
              position: 126537.965,
            },
            {
              gradient: 6,
              position: 126751.965,
            },
            {
              gradient: 7,
              position: 126751.965,
            },
            {
              gradient: 7,
              position: 127135.965,
            },
            {
              gradient: 8,
              position: 127135.965,
            },
            {
              gradient: 8,
              position: 127652.965,
            },
            {
              gradient: 0,
              position: 127652.965,
            },
            {
              gradient: 0,
              position: 128452.965,
            },
            {
              gradient: -24,
              position: 128452.965,
            },
            {
              gradient: -24,
              position: 128625.965,
            },
            {
              gradient: 0,
              position: 128625.965,
            },
            {
              gradient: 0,
              position: 129431.965,
            },
            {
              gradient: 7.5,
              position: 129431.965,
            },
            {
              gradient: 7.5,
              position: 130675.965,
            },
            {
              gradient: 6.5,
              position: 130675.965,
            },
            {
              gradient: 6.5,
              position: 130900.965,
            },
            {
              gradient: 0,
              position: 130900.965,
            },
            {
              gradient: 0,
              position: 130902.965,
            },
            {
              gradient: -2,
              position: 130902.965,
            },
            {
              gradient: -2,
              position: 131626.965,
            },
            {
              gradient: 0,
              position: 131626.965,
            },
            {
              gradient: 0,
              position: 131826.965,
            },
            {
              gradient: 3,
              position: 131826.965,
            },
            {
              gradient: 3,
              position: 132297.965,
            },
            {
              gradient: 0,
              position: 132297.965,
            },
            {
              gradient: 0,
              position: 132447.965,
            },
            {
              gradient: -3,
              position: 132447.965,
            },
            {
              gradient: -3,
              position: 132861.965,
            },
            {
              gradient: 0,
              position: 132861.965,
            },
            {
              gradient: 0,
              position: 133931.965,
            },
            {
              gradient: 2,
              position: 133931.965,
            },
            {
              gradient: 2,
              position: 134706.965,
            },
            {
              gradient: 0,
              position: 134706.965,
            },
            {
              gradient: 0,
              position: 134856.965,
            },
            {
              gradient: 8,
              position: 134856.965,
            },
            {
              gradient: 8,
              position: 135340.965,
            },
            {
              gradient: 0,
              position: 135340.965,
            },
            {
              gradient: 0,
              position: 135765.965,
            },
            {
              gradient: 25,
              position: 135765.965,
            },
            {
              gradient: 25,
              position: 136318.965,
            },
            {
              gradient: 0,
              position: 136318.965,
            },
            {
              gradient: 0,
              position: 137058.965,
            },
            {
              gradient: -12,
              position: 137058.965,
            },
            {
              gradient: -12,
              position: 137501.965,
            },
            {
              gradient: 0,
              position: 137501.965,
            },
            {
              gradient: 0,
              position: 138161.965,
            },
            {
              gradient: 6,
              position: 138161.965,
            },
            {
              gradient: 6,
              position: 138952.965,
            },
            {
              gradient: 0,
              position: 138952.965,
            },
            {
              gradient: 0,
              position: 139152.965,
            },
            {
              gradient: -2,
              position: 139152.965,
            },
            {
              gradient: -2,
              position: 140294.965,
            },
            {
              gradient: 0,
              position: 140294.965,
            },
            {
              gradient: 0,
              position: 140374.965,
            },
            {
              gradient: -4,
              position: 140374.965,
            },
            {
              gradient: -4,
              position: 140699.965,
            },
            {
              gradient: 0,
              position: 140699.965,
            },
            {
              gradient: 0,
              position: 140849.965,
            },
            {
              gradient: 2,
              position: 140849.965,
            },
            {
              gradient: 2,
              position: 141637.965,
            },
            {
              gradient: 0,
              position: 141637.965,
            },
            {
              gradient: 0,
              position: 141797.965,
            },
            {
              gradient: -2,
              position: 141797.965,
            },
            {
              gradient: -2,
              position: 142241.965,
            },
            {
              gradient: 0,
              position: 142241.965,
            },
            {
              gradient: 0,
              position: 142566.965,
            },
            {
              gradient: -15,
              position: 142566.965,
            },
            {
              gradient: -15,
              position: 143079.965,
            },
            {
              gradient: 0,
              position: 143079.965,
            },
            {
              gradient: 0,
              position: 143404.965,
            },
            {
              gradient: -2,
              position: 143404.965,
            },
            {
              gradient: -2,
              position: 144116.965,
            },
            {
              gradient: 0,
              position: 144116.965,
            },
            {
              gradient: 0,
              position: 144241.965,
            },
            {
              gradient: 3,
              position: 144241.965,
            },
            {
              gradient: 3,
              position: 145182.965,
            },
            {
              gradient: 0,
              position: 145182.965,
            },
            {
              gradient: 0,
              position: 145307.965,
            },
            {
              gradient: -2,
              position: 145307.965,
            },
            {
              gradient: -2,
              position: 146320.965,
            },
            {
              gradient: -1,
              position: 146320.965,
            },
            {
              gradient: -1,
              position: 146935.965,
            },
            {
              gradient: 0,
              position: 146935.965,
            },
            {
              gradient: 0,
              position: 146972.965,
            },
            {
              gradient: 0.5,
              position: 146972.965,
            },
            {
              gradient: 0.5,
              position: 147328.965,
            },
            {
              gradient: 0,
              position: 147328.965,
            },
            {
              gradient: 0,
              position: 147416.965,
            },
            {
              gradient: -3,
              position: 147416.965,
            },
            {
              gradient: -3,
              position: 147661.965,
            },
            {
              gradient: 0,
              position: 147661.965,
            },
            {
              gradient: 0,
              position: 147711.965,
            },
            {
              gradient: -1,
              position: 147711.965,
            },
            {
              gradient: -1,
              position: 149697.965,
            },
            {
              gradient: 0,
              position: 149697.965,
            },
            {
              gradient: 0,
              position: 149772.965,
            },
            {
              gradient: -4,
              position: 149772.965,
            },
            {
              gradient: -4,
              position: 150943.965,
            },
            {
              gradient: 0,
              position: 150943.965,
            },
            {
              gradient: 0,
              position: 151093.965,
            },
            {
              gradient: 2,
              position: 151093.965,
            },
            {
              gradient: 2,
              position: 151951.965,
            },
            {
              gradient: 0,
              position: 151951.965,
            },
            {
              gradient: 0,
              position: 152226.965,
            },
            {
              gradient: -9,
              position: 152226.965,
            },
            {
              gradient: -9,
              position: 153832.965,
            },
            {
              gradient: 0,
              position: 153832.965,
            },
            {
              gradient: 0,
              position: 153932.965,
            },
            {
              gradient: -11.5,
              position: 153932.965,
            },
            {
              gradient: -11.5,
              position: 154657.965,
            },
            {
              gradient: 0,
              position: 154657.965,
            },
            {
              gradient: 0,
              position: 154757.965,
            },
            {
              gradient: -7.5,
              position: 154757.965,
            },
            {
              gradient: -7.5,
              position: 155637.965,
            },
            {
              gradient: 0,
              position: 155637.965,
            },
            {
              gradient: 0,
              position: 155737.965,
            },
            {
              gradient: -5,
              position: 155737.965,
            },
            {
              gradient: -5,
              position: 156477.965,
            },
            {
              gradient: -6,
              position: 156477.965,
            },
            {
              gradient: -6,
              position: 157691.965,
            },
            {
              gradient: 0,
              position: 157691.965,
            },
            {
              gradient: 0,
              position: 159021.965,
            },
            {
              gradient: 20,
              position: 159021.965,
            },
            {
              gradient: 20,
              position: 159410.965,
            },
            {
              gradient: 0,
              position: 159410.965,
            },
            {
              gradient: 0,
              position: 159810.965,
            },
            {
              gradient: 4,
              position: 159810.965,
            },
            {
              gradient: 4,
              position: 160851.965,
            },
            {
              gradient: 0,
              position: 160851.965,
            },
            {
              gradient: 0,
              position: 161251.965,
            },
            {
              gradient: 20,
              position: 161251.965,
            },
            {
              gradient: 20,
              position: 161867.965,
            },
            {
              gradient: 0,
              position: 161867.965,
            },
            {
              gradient: 0,
              position: 162492.965,
            },
            {
              gradient: -5,
              position: 162492.965,
            },
            {
              gradient: -5,
              position: 162623.965,
            },
            {
              gradient: 0,
              position: 162623.965,
            },
            {
              gradient: 0,
              position: 162898.965,
            },
            {
              gradient: 6,
              position: 162898.965,
            },
            {
              gradient: 6,
              position: 163712.965,
            },
            {
              gradient: 0,
              position: 163712.965,
            },
            {
              gradient: 0,
              position: 164487.965,
            },
            {
              gradient: -25,
              position: 164487.965,
            },
            {
              gradient: -25,
              position: 166000.965,
            },
            {
              gradient: 0,
              position: 166000.965,
            },
            {
              gradient: 0,
              position: 166400.965,
            },
            {
              gradient: -9,
              position: 166400.965,
            },
            {
              gradient: -9,
              position: 167129.965,
            },
            {
              gradient: 0,
              position: 167129.965,
            },
            {
              gradient: 0,
              position: 167259.965,
            },
            {
              gradient: -14.6,
              position: 167259.965,
            },
            {
              gradient: -14.6,
              position: 168027.965,
            },
            {
              gradient: 0,
              position: 168027.965,
            },
            {
              gradient: 0,
              position: 168280.965,
            },
            {
              gradient: -4.5,
              position: 168280.965,
            },
            {
              gradient: -4.5,
              position: 169671.965,
            },
            {
              gradient: 0,
              position: 169671.965,
            },
            {
              gradient: 0,
              position: 169883.965,
            },
            {
              gradient: 4,
              position: 169883.965,
            },
            {
              gradient: 4,
              position: 171156.965,
            },
            {
              gradient: 0,
              position: 171156.965,
            },
            {
              gradient: 0,
              position: 171306.965,
            },
            {
              gradient: -2,
              position: 171306.965,
            },
            {
              gradient: -2,
              position: 172575.965,
            },
            {
              gradient: 0,
              position: 172575.965,
            },
            {
              gradient: 0,
              position: 172850.965,
            },
            {
              gradient: -13,
              position: 172850.965,
            },
            {
              gradient: -13,
              position: 174001.965,
            },
            {
              gradient: 0,
              position: 174001.965,
            },
            {
              gradient: 0,
              position: 174376.965,
            },
            {
              gradient: 2,
              position: 174376.965,
            },
            {
              gradient: 2,
              position: 175037.965,
            },
            {
              gradient: 0,
              position: 175037.965,
            },
            {
              gradient: 0,
              position: 175412.965,
            },
            {
              gradient: 17,
              position: 175412.965,
            },
            {
              gradient: 17,
              position: 176014.965,
            },
            {
              gradient: 0,
              position: 176014.965,
            },
            {
              gradient: 0,
              position: 176489.965,
            },
            {
              gradient: -2,
              position: 176489.965,
            },
            {
              gradient: -2,
              position: 177767.965,
            },
            {
              gradient: 0,
              position: 177767.965,
            },
            {
              gradient: 0,
              position: 178055.965,
            },
            {
              gradient: -20,
              position: 178055.965,
            },
            {
              gradient: -20,
              position: 178435.965,
            },
            {
              gradient: 0,
              position: 178435.965,
            },
            {
              gradient: 0,
              position: 178563.965,
            },
            {
              gradient: -12,
              position: 178563.965,
            },
            {
              gradient: -12,
              position: 178970.965,
            },
            {
              gradient: 0,
              position: 178970.965,
            },
            {
              gradient: 0,
              position: 179011.965,
            },
            {
              gradient: -12,
              position: 179011.965,
            },
            {
              gradient: -12,
              position: 179377.965,
            },
            {
              gradient: 0,
              position: 179377.965,
            },
            {
              gradient: 0,
              position: 179999.965,
            },
            {
              gradient: -2.1,
              position: 179999.965,
            },
            {
              gradient: -2.1,
              position: 180716.965,
            },
            {
              gradient: -1.8,
              position: 180716.965,
            },
            {
              gradient: -1.8,
              position: 181037.965,
            },
            {
              gradient: -2.1,
              position: 181037.965,
            },
            {
              gradient: -2.1,
              position: 181538.965,
            },
            {
              gradient: -1.5,
              position: 181538.965,
            },
            {
              gradient: -1.5,
              position: 181688.965,
            },
            {
              gradient: 0,
              position: 181688.965,
            },
            {
              gradient: 0,
              position: 181898.965,
            },
            {
              gradient: -1.5,
              position: 181898.965,
            },
            {
              gradient: -1.5,
              position: 182088.965,
            },
            {
              gradient: 0.2,
              position: 182088.965,
            },
            {
              gradient: 0.2,
              position: 182138.965,
            },
            {
              gradient: -0.2,
              position: 182138.965,
            },
            {
              gradient: -0.2,
              position: 182260.965,
            },
            {
              gradient: 0,
              position: 182260.965,
            },
            {
              gradient: 0,
              position: 182488.965,
            },
            {
              gradient: 0.2,
              position: 182488.965,
            },
            {
              gradient: 0.2,
              position: 182538.965,
            },
            {
              gradient: 0,
              position: 182538.965,
            },
            {
              gradient: 0,
              position: 182638.965,
            },
            {
              gradient: 0.4,
              position: 182638.965,
            },
            {
              gradient: 0.4,
              position: 182888.965,
            },
            {
              gradient: -0.4,
              position: 182888.965,
            },
            {
              gradient: -0.4,
              position: 182938.965,
            },
            {
              gradient: -1.7,
              position: 182938.965,
            },
            {
              gradient: -1.7,
              position: 184438.965,
            },
            {
              gradient: -1.2,
              position: 184438.965,
            },
            {
              gradient: -1.2,
              position: 184788.965,
            },
            {
              gradient: -2.4,
              position: 184788.965,
            },
            {
              gradient: -2.4,
              position: 184888.965,
            },
            {
              gradient: -1.3,
              position: 184888.965,
            },
            {
              gradient: -1.3,
              position: 186338.965,
            },
            {
              gradient: 0,
              position: 186338.965,
            },
            {
              gradient: 0,
              position: 186438.965,
            },
            {
              gradient: -0.2,
              position: 186438.965,
            },
            {
              gradient: -0.2,
              position: 186538.965,
            },
            {
              gradient: 0,
              position: 186538.965,
            },
            {
              gradient: 0,
              position: 186638.965,
            },
            {
              gradient: -0.3,
              position: 186638.965,
            },
            {
              gradient: -0.3,
              position: 187088.965,
            },
            {
              gradient: 0.9,
              position: 187088.965,
            },
            {
              gradient: 0.9,
              position: 189188.965,
            },
            {
              gradient: 2.2,
              position: 189188.965,
            },
            {
              gradient: 2.2,
              position: 189888.965,
            },
            {
              gradient: 1.6,
              position: 189888.965,
            },
            {
              gradient: 1.6,
              position: 190038.965,
            },
            {
              gradient: 0,
              position: 190038.965,
            },
            {
              gradient: 0,
              position: 190138.965,
            },
            {
              gradient: 0.4,
              position: 190138.965,
            },
            {
              gradient: 0.4,
              position: 190188.965,
            },
            {
              gradient: -0.6,
              position: 190188.965,
            },
            {
              gradient: -0.6,
              position: 190388.965,
            },
            {
              gradient: 0,
              position: 190388.965,
            },
            {
              gradient: 0,
              position: 190488.965,
            },
            {
              gradient: 0.5,
              position: 190488.965,
            },
            {
              gradient: 0.5,
              position: 190588.965,
            },
            {
              gradient: -0.5,
              position: 190588.965,
            },
            {
              gradient: -0.5,
              position: 190688.965,
            },
            {
              gradient: 0.2,
              position: 190688.965,
            },
            {
              gradient: 0.2,
              position: 190888.965,
            },
            {
              gradient: -0.2,
              position: 190888.965,
            },
            {
              gradient: -0.2,
              position: 191038.965,
            },
            {
              gradient: 0,
              position: 191038.965,
            },
            {
              gradient: 0,
              position: 191138.965,
            },
            {
              gradient: -0.2,
              position: 191138.965,
            },
            {
              gradient: -0.2,
              position: 191238.965,
            },
            {
              gradient: 0.1,
              position: 191238.965,
            },
            {
              gradient: 0.1,
              position: 191338.965,
            },
            {
              gradient: -0.9,
              position: 191338.965,
            },
            {
              gradient: -0.9,
              position: 192588.965,
            },
            {
              gradient: -3.1,
              position: 192588.965,
            },
            {
              gradient: -3.1,
              position: 192838.965,
            },
            {
              gradient: -4.1,
              position: 192838.965,
            },
            {
              gradient: -4.1,
              position: 193288.965,
            },
            {
              gradient: -3.2,
              position: 193288.965,
            },
            {
              gradient: -3.2,
              position: 193438.965,
            },
            {
              gradient: -4.8,
              position: 193438.965,
            },
            {
              gradient: -4.8,
              position: 193488.965,
            },
            {
              gradient: -3.1,
              position: 193488.965,
            },
            {
              gradient: -3.1,
              position: 194388.965,
            },
            {
              gradient: -2.8,
              position: 194388.965,
            },
            {
              gradient: -2.8,
              position: 194938.965,
            },
            {
              gradient: -0.8,
              position: 194938.965,
            },
            {
              gradient: -0.8,
              position: 195288.965,
            },
            {
              gradient: 0,
              position: 195288.965,
            },
            {
              gradient: 0,
              position: 195838.965,
            },
            {
              gradient: -0.2,
              position: 195838.965,
            },
            {
              gradient: -0.2,
              position: 196288.965,
            },
            {
              gradient: -1.8,
              position: 196288.965,
            },
            {
              gradient: -1.8,
              position: 197388.965,
            },
            {
              gradient: -1.7,
              position: 197388.965,
            },
            {
              gradient: -1.7,
              position: 197758.965,
            },
            {
              gradient: -0.5,
              position: 197758.965,
            },
            {
              gradient: -0.5,
              position: 197913.965,
            },
            {
              gradient: -2.6,
              position: 197913.965,
            },
            {
              gradient: -2.6,
              position: 198127.965,
            },
            {
              gradient: -1.5,
              position: 198127.965,
            },
            {
              gradient: -1.5,
              position: 198288.965,
            },
            {
              gradient: -1.4,
              position: 198288.965,
            },
            {
              gradient: -1.4,
              position: 199438.965,
            },
            {
              gradient: -2.4,
              position: 199438.965,
            },
            {
              gradient: -2.4,
              position: 199488.965,
            },
            {
              gradient: -1.3,
              position: 199488.965,
            },
            {
              gradient: -1.3,
              position: 199838.965,
            },
            {
              gradient: 0.6,
              position: 199838.965,
            },
            {
              gradient: 0.6,
              position: 199888.965,
            },
            {
              gradient: 2.9,
              position: 199888.965,
            },
            {
              gradient: 2.9,
              position: 199988.965,
            },
            {
              gradient: 5.5,
              position: 199988.965,
            },
            {
              gradient: 5.5,
              position: 200288.965,
            },
            {
              gradient: 3.8,
              position: 200288.965,
            },
            {
              gradient: 3.8,
              position: 200338.965,
            },
            {
              gradient: 1,
              position: 200338.965,
            },
            {
              gradient: 1,
              position: 200388.965,
            },
            {
              gradient: -0.8,
              position: 200388.965,
            },
            {
              gradient: -0.8,
              position: 200488.965,
            },
            {
              gradient: -2.4,
              position: 200488.965,
            },
            {
              gradient: -2.4,
              position: 200588.965,
            },
            {
              gradient: -1.3,
              position: 200588.965,
            },
            {
              gradient: -1.3,
              position: 200688.965,
            },
            {
              gradient: 2,
              position: 200688.965,
            },
            {
              gradient: 2,
              position: 200754.965,
            },
            {
              gradient: 0,
              position: 200754.965,
            },
            {
              gradient: 0,
              position: 201408.607,
            },
          ],
          curves: [
            {
              radius: -526,
              position: 0,
            },
            {
              radius: -526,
              position: 115.965,
            },
            {
              radius: 806,
              position: 115.965,
            },
            {
              radius: 806,
              position: 175.965,
            },
            {
              radius: -8333,
              position: 175.965,
            },
            {
              radius: -8333,
              position: 255.965,
            },
            {
              radius: 776,
              position: 255.965,
            },
            {
              radius: 776,
              position: 335.965,
            },
            {
              radius: 485,
              position: 335.965,
            },
            {
              radius: 485,
              position: 394.965,
            },
            {
              radius: 1500,
              position: 394.965,
            },
            {
              radius: 1500,
              position: 395.965,
            },
            {
              radius: 0,
              position: 395.965,
            },
            {
              radius: 0,
              position: 1772.965,
            },
            {
              radius: -10000,
              position: 1772.965,
            },
            {
              radius: -10000,
              position: 2015.965,
            },
            {
              radius: -1162,
              position: 2015.965,
            },
            {
              radius: -1162,
              position: 2195.965,
            },
            {
              radius: 1612,
              position: 2195.965,
            },
            {
              radius: 1612,
              position: 2395.965,
            },
            {
              radius: 757,
              position: 2395.965,
            },
            {
              radius: 757,
              position: 2795.965,
            },
            {
              radius: 552,
              position: 2795.965,
            },
            {
              radius: 552,
              position: 2975.965,
            },
            {
              radius: 466,
              position: 2975.965,
            },
            {
              radius: 466,
              position: 3275.965,
            },
            {
              radius: 0,
              position: 3275.965,
            },
            {
              radius: 0,
              position: 3674.965,
            },
            {
              radius: -840,
              position: 3674.965,
            },
            {
              radius: -840,
              position: 4555.965,
            },
            {
              radius: -2941,
              position: 4555.965,
            },
            {
              radius: -2941,
              position: 5014.965,
            },
            {
              radius: 0,
              position: 5014.965,
            },
            {
              radius: 0,
              position: 5655.965,
            },
            {
              radius: 1639,
              position: 5655.965,
            },
            {
              radius: 1639,
              position: 6269.965,
            },
            {
              radius: -1650,
              position: 6269.965,
            },
            {
              radius: -1650,
              position: 6789.965,
            },
            {
              radius: 1650,
              position: 6789.965,
            },
            {
              radius: 1650,
              position: 7478.965,
            },
            {
              radius: 0,
              position: 7478.965,
            },
            {
              radius: 0,
              position: 8061.965,
            },
            {
              radius: 6000,
              position: 8061.965,
            },
            {
              radius: 6000,
              position: 8855.965,
            },
            {
              radius: 0,
              position: 8855.965,
            },
            {
              radius: 0,
              position: 9584.965,
            },
            {
              radius: -2900,
              position: 9584.965,
            },
            {
              radius: -2900,
              position: 10833.965,
            },
            {
              radius: 0,
              position: 10833.965,
            },
            {
              radius: 0,
              position: 11776.965,
            },
            {
              radius: 10000,
              position: 11776.965,
            },
            {
              radius: 10000,
              position: 11984.965,
            },
            {
              radius: 0,
              position: 11984.965,
            },
            {
              radius: 0,
              position: 12607.965,
            },
            {
              radius: -1600,
              position: 12607.965,
            },
            {
              radius: -1600,
              position: 13309.965,
            },
            {
              radius: 0,
              position: 13309.965,
            },
            {
              radius: 0,
              position: 14150.965,
            },
            {
              radius: 1600,
              position: 14150.965,
            },
            {
              radius: 1600,
              position: 15179.965,
            },
            {
              radius: 0,
              position: 15179.965,
            },
            {
              radius: 0,
              position: 15289.965,
            },
            {
              radius: -5000,
              position: 15289.965,
            },
            {
              radius: -5000,
              position: 15572.965,
            },
            {
              radius: 0,
              position: 15572.965,
            },
            {
              radius: 0,
              position: 15700.965,
            },
            {
              radius: 7000,
              position: 15700.965,
            },
            {
              radius: 7000,
              position: 16105.965,
            },
            {
              radius: 0,
              position: 16105.965,
            },
            {
              radius: 0,
              position: 16324.965,
            },
            {
              radius: -4000,
              position: 16324.965,
            },
            {
              radius: -4000,
              position: 17587.965,
            },
            {
              radius: -6000,
              position: 17587.965,
            },
            {
              radius: -6000,
              position: 18038.965,
            },
            {
              radius: -3500,
              position: 18038.965,
            },
            {
              radius: -3500,
              position: 19747.965,
            },
            {
              radius: 0,
              position: 19747.965,
            },
            {
              radius: 0,
              position: 21601.965,
            },
            {
              radius: 5000,
              position: 21601.965,
            },
            {
              radius: 5000,
              position: 23495.965,
            },
            {
              radius: 0,
              position: 23495.965,
            },
            {
              radius: 0,
              position: 23724.965,
            },
            {
              radius: -4545,
              position: 23724.965,
            },
            {
              radius: -4545,
              position: 24903.965,
            },
            {
              radius: 0,
              position: 24903.965,
            },
            {
              radius: 0,
              position: 26540.965,
            },
            {
              radius: 4000,
              position: 26540.965,
            },
            {
              radius: 4000,
              position: 28316.965,
            },
            {
              radius: -4000,
              position: 28316.965,
            },
            {
              radius: -4000,
              position: 31892.965,
            },
            {
              radius: 15000,
              position: 31892.965,
            },
            {
              radius: 15000,
              position: 33016.965,
            },
            {
              radius: 0,
              position: 33016.965,
            },
            {
              radius: 0,
              position: 34674.965,
            },
            {
              radius: 4545,
              position: 34674.965,
            },
            {
              radius: 4545,
              position: 36341.965,
            },
            {
              radius: -5000,
              position: 36341.965,
            },
            {
              radius: -5000,
              position: 37443.965,
            },
            {
              radius: 0,
              position: 37443.965,
            },
            {
              radius: 0,
              position: 38123.965,
            },
            {
              radius: 4545,
              position: 38123.965,
            },
            {
              radius: 4545,
              position: 39399.965,
            },
            {
              radius: -15000,
              position: 39399.965,
            },
            {
              radius: -15000,
              position: 40032.965,
            },
            {
              radius: 0,
              position: 40032.965,
            },
            {
              radius: 0,
              position: 40980.965,
            },
            {
              radius: -4545,
              position: 40980.965,
            },
            {
              radius: -4545,
              position: 43171.965,
            },
            {
              radius: 0,
              position: 43171.965,
            },
            {
              radius: 0,
              position: 44133.965,
            },
            {
              radius: 4167,
              position: 44133.965,
            },
            {
              radius: 4167,
              position: 48823.965,
            },
            {
              radius: 0,
              position: 48823.965,
            },
            {
              radius: 0,
              position: 51393.965,
            },
            {
              radius: -5000,
              position: 51393.965,
            },
            {
              radius: -5000,
              position: 55280.965,
            },
            {
              radius: 0,
              position: 55280.965,
            },
            {
              radius: 0,
              position: 57696.965,
            },
            {
              radius: -5000,
              position: 57696.965,
            },
            {
              radius: -5000,
              position: 59157.965,
            },
            {
              radius: 0,
              position: 59157.965,
            },
            {
              radius: 0,
              position: 59393.965,
            },
            {
              radius: 4545,
              position: 59393.965,
            },
            {
              radius: 4545,
              position: 62101.965,
            },
            {
              radius: 0,
              position: 62101.965,
            },
            {
              radius: 0,
              position: 62358.965,
            },
            {
              radius: -8000,
              position: 62358.965,
            },
            {
              radius: -8000,
              position: 63365.965,
            },
            {
              radius: 0,
              position: 63365.965,
            },
            {
              radius: 0,
              position: 63709.965,
            },
            {
              radius: 5000,
              position: 63709.965,
            },
            {
              radius: 5000,
              position: 65478.965,
            },
            {
              radius: 0,
              position: 65478.965,
            },
            {
              radius: 0,
              position: 69016.965,
            },
            {
              radius: 25000,
              position: 69016.965,
            },
            {
              radius: 25000,
              position: 69411.965,
            },
            {
              radius: -6250,
              position: 69411.965,
            },
            {
              radius: -6250,
              position: 70558.965,
            },
            {
              radius: 25000,
              position: 70558.965,
            },
            {
              radius: 25000,
              position: 70956.965,
            },
            {
              radius: 0,
              position: 70956.965,
            },
            {
              radius: 0,
              position: 74164.965,
            },
            {
              radius: 6250,
              position: 74164.965,
            },
            {
              radius: 6250,
              position: 75638.965,
            },
            {
              radius: 0,
              position: 75638.965,
            },
            {
              radius: 0,
              position: 81197.965,
            },
            {
              radius: -6500,
              position: 81197.965,
            },
            {
              radius: -6500,
              position: 84749.965,
            },
            {
              radius: 0,
              position: 84749.965,
            },
            {
              radius: 0,
              position: 85031.965,
            },
            {
              radius: 6500,
              position: 85031.965,
            },
            {
              radius: 6500,
              position: 86842.965,
            },
            {
              radius: 0,
              position: 86842.965,
            },
            {
              radius: 0,
              position: 87119.965,
            },
            {
              radius: -6250,
              position: 87119.965,
            },
            {
              radius: -6250,
              position: 90744.965,
            },
            {
              radius: 11111,
              position: 90744.965,
            },
            {
              radius: 11111,
              position: 91408.965,
            },
            {
              radius: 0,
              position: 91408.965,
            },
            {
              radius: 0,
              position: 93745.965,
            },
            {
              radius: 10000,
              position: 93745.965,
            },
            {
              radius: 10000,
              position: 94307.965,
            },
            {
              radius: 0,
              position: 94307.965,
            },
            {
              radius: 0,
              position: 94504.965,
            },
            {
              radius: -10000,
              position: 94504.965,
            },
            {
              radius: -10000,
              position: 95436.965,
            },
            {
              radius: 0,
              position: 95436.965,
            },
            {
              radius: 0,
              position: 95637.965,
            },
            {
              radius: 10000,
              position: 95637.965,
            },
            {
              radius: 10000,
              position: 96200.965,
            },
            {
              radius: 0,
              position: 96200.965,
            },
            {
              radius: 0,
              position: 99319.965,
            },
            {
              radius: -12500,
              position: 99319.965,
            },
            {
              radius: -12500,
              position: 99732.965,
            },
            {
              radius: 0,
              position: 99732.965,
            },
            {
              radius: 0,
              position: 100039.965,
            },
            {
              radius: 6667,
              position: 100039.965,
            },
            {
              radius: 6667,
              position: 101946.965,
            },
            {
              radius: 0,
              position: 101946.965,
            },
            {
              radius: 0,
              position: 102235.965,
            },
            {
              radius: -8333,
              position: 102235.965,
            },
            {
              radius: -8333,
              position: 104273.965,
            },
            {
              radius: 0,
              position: 104273.965,
            },
            {
              radius: 0,
              position: 106094.965,
            },
            {
              radius: -10000,
              position: 106094.965,
            },
            {
              radius: -10000,
              position: 108031.965,
            },
            {
              radius: 0,
              position: 108031.965,
            },
            {
              radius: 0,
              position: 108953.965,
            },
            {
              radius: 8333,
              position: 108953.965,
            },
            {
              radius: 8333,
              position: 112428.965,
            },
            {
              radius: 0,
              position: 112428.965,
            },
            {
              radius: 0,
              position: 115455.965,
            },
            {
              radius: -6000,
              position: 115455.965,
            },
            {
              radius: -6000,
              position: 117031.965,
            },
            {
              radius: 0,
              position: 117031.965,
            },
            {
              radius: 0,
              position: 117352.965,
            },
            {
              radius: 6000,
              position: 117352.965,
            },
            {
              radius: 6000,
              position: 120148.965,
            },
            {
              radius: 0,
              position: 120148.965,
            },
            {
              radius: 0,
              position: 120501.965,
            },
            {
              radius: -7143,
              position: 120501.965,
            },
            {
              radius: -7143,
              position: 121598.965,
            },
            {
              radius: 0,
              position: 121598.965,
            },
            {
              radius: 0,
              position: 122000.965,
            },
            {
              radius: 5000,
              position: 122000.965,
            },
            {
              radius: 5000,
              position: 124041.965,
            },
            {
              radius: 0,
              position: 124041.965,
            },
            {
              radius: 0,
              position: 124240.965,
            },
            {
              radius: -4545,
              position: 124240.965,
            },
            {
              radius: -4545,
              position: 127136.965,
            },
            {
              radius: 0,
              position: 127136.965,
            },
            {
              radius: 0,
              position: 129102.965,
            },
            {
              radius: -12500,
              position: 129102.965,
            },
            {
              radius: -12500,
              position: 129459.965,
            },
            {
              radius: 0,
              position: 129459.965,
            },
            {
              radius: 0,
              position: 129976.965,
            },
            {
              radius: 6502,
              position: 129976.965,
            },
            {
              radius: 6502,
              position: 130900.965,
            },
            {
              radius: -2500,
              position: 130900.965,
            },
            {
              radius: -2500,
              position: 131317.965,
            },
            {
              radius: 0,
              position: 131317.965,
            },
            {
              radius: 0,
              position: 132002.965,
            },
            {
              radius: 6250,
              position: 132002.965,
            },
            {
              radius: 6250,
              position: 132857.965,
            },
            {
              radius: 0,
              position: 132857.965,
            },
            {
              radius: 0,
              position: 133941.965,
            },
            {
              radius: -8333,
              position: 133941.965,
            },
            {
              radius: -8333,
              position: 138009.965,
            },
            {
              radius: 0,
              position: 138009.965,
            },
            {
              radius: 0,
              position: 139242.965,
            },
            {
              radius: 15000,
              position: 139242.965,
            },
            {
              radius: 15000,
              position: 140193.965,
            },
            {
              radius: 0,
              position: 140193.965,
            },
            {
              radius: 0,
              position: 140480.965,
            },
            {
              radius: -8333,
              position: 140480.965,
            },
            {
              radius: -8333,
              position: 142068.965,
            },
            {
              radius: 0,
              position: 142068.965,
            },
            {
              radius: 0,
              position: 143300.965,
            },
            {
              radius: -12500,
              position: 143300.965,
            },
            {
              radius: -12500,
              position: 143957.965,
            },
            {
              radius: 0,
              position: 143957.965,
            },
            {
              radius: 0,
              position: 144260.965,
            },
            {
              radius: 6250,
              position: 144260.965,
            },
            {
              radius: 6250,
              position: 146799.965,
            },
            {
              radius: 0,
              position: 146799.965,
            },
            {
              radius: 0,
              position: 147104.965,
            },
            {
              radius: -10000,
              position: 147104.965,
            },
            {
              radius: -10000,
              position: 147913.965,
            },
            {
              radius: 0,
              position: 147913.965,
            },
            {
              radius: 0,
              position: 149775.965,
            },
            {
              radius: 7143,
              position: 149775.965,
            },
            {
              radius: 7143,
              position: 151356.965,
            },
            {
              radius: 0,
              position: 151356.965,
            },
            {
              radius: 0,
              position: 151664.965,
            },
            {
              radius: -7143,
              position: 151664.965,
            },
            {
              radius: -7143,
              position: 153145.965,
            },
            {
              radius: 0,
              position: 153145.965,
            },
            {
              radius: 0,
              position: 154343.965,
            },
            {
              radius: -6250,
              position: 154343.965,
            },
            {
              radius: -6250,
              position: 155609.965,
            },
            {
              radius: 0,
              position: 155609.965,
            },
            {
              radius: 0,
              position: 155961.965,
            },
            {
              radius: 6250,
              position: 155961.965,
            },
            {
              radius: 6250,
              position: 157886.965,
            },
            {
              radius: 0,
              position: 157886.965,
            },
            {
              radius: 0,
              position: 159965.965,
            },
            {
              radius: 6250,
              position: 159965.965,
            },
            {
              radius: 6250,
              position: 161606.965,
            },
            {
              radius: 0,
              position: 161606.965,
            },
            {
              radius: 0,
              position: 161972.965,
            },
            {
              radius: -6250,
              position: 161972.965,
            },
            {
              radius: -6250,
              position: 163420.965,
            },
            {
              radius: 0,
              position: 163420.965,
            },
            {
              radius: 0,
              position: 163772.965,
            },
            {
              radius: 6250,
              position: 163772.965,
            },
            {
              radius: 6250,
              position: 164672.965,
            },
            {
              radius: 10000,
              position: 164672.965,
            },
            {
              radius: 10000,
              position: 165843.965,
            },
            {
              radius: 8333,
              position: 165843.965,
            },
            {
              radius: 8333,
              position: 167675.965,
            },
            {
              radius: 0,
              position: 167675.965,
            },
            {
              radius: 0,
              position: 168386.965,
            },
            {
              radius: -6250,
              position: 168386.965,
            },
            {
              radius: -6250,
              position: 171749.965,
            },
            {
              radius: 0,
              position: 171749.965,
            },
            {
              radius: 0,
              position: 172983.965,
            },
            {
              radius: -8333,
              position: 172983.965,
            },
            {
              radius: -8333,
              position: 173889.965,
            },
            {
              radius: 0,
              position: 173889.965,
            },
            {
              radius: 0,
              position: 175737.965,
            },
            {
              radius: -6250,
              position: 175737.965,
            },
            {
              radius: -6250,
              position: 178343.965,
            },
            {
              radius: 0,
              position: 178343.965,
            },
            {
              radius: 0,
              position: 179011.965,
            },
            {
              radius: 10000,
              position: 179011.965,
            },
            {
              radius: 10000,
              position: 179182.965,
            },
            {
              radius: 0,
              position: 179182.965,
            },
            {
              radius: 0,
              position: 179329.965,
            },
            {
              radius: 2000,
              position: 179329.965,
            },
            {
              radius: 2000,
              position: 181333.965,
            },
            {
              radius: 0,
              position: 181333.965,
            },
            {
              radius: 0,
              position: 192928.965,
            },
            {
              radius: -1818,
              position: 192928.965,
            },
            {
              radius: -1818,
              position: 193888.965,
            },
            {
              radius: 0,
              position: 193888.965,
            },
            {
              radius: 0,
              position: 194738.965,
            },
            {
              radius: 1852,
              position: 194738.965,
            },
            {
              radius: 1852,
              position: 195718.965,
            },
            {
              radius: 0,
              position: 195718.965,
            },
            {
              radius: 0,
              position: 199478.965,
            },
            {
              radius: -1220,
              position: 199478.965,
            },
            {
              radius: -1220,
              position: 199918.965,
            },
            {
              radius: -990,
              position: 199918.965,
            },
            {
              radius: -990,
              position: 200188.965,
            },
            {
              radius: -909,
              position: 200188.965,
            },
            {
              radius: -909,
              position: 200388.965,
            },
            {
              radius: 0,
              position: 200388.965,
            },
            {
              radius: 0,
              position: 201108.965,
            },
            {
              radius: -885,
              position: 201108.965,
            },
            {
              radius: -885,
              position: 201408.607,
            },
          ],
          base: {
            head_positions: [
              [
                {
                  time: 50400,
                  position: 0,
                },
                {
                  time: 50408,
                  position: 15.087681652230287,
                },
                {
                  time: 50416,
                  position: 59.95650969166121,
                },
                {
                  time: 50424,
                  position: 134.0825421380268,
                },
                {
                  time: 50432,
                  position: 236.98839247875625,
                },
                {
                  time: 50517.49827720566,
                  position: 1660.9650000000001,
                },
                {
                  time: 50523.49827720566,
                  position: 1767.7780072292762,
                },
                {
                  time: 50531.49827720566,
                  position: 1930.6174571559138,
                },
                {
                  time: 50541.49827720566,
                  position: 2161.1275570966345,
                },
                {
                  time: 50551.49827720566,
                  position: 2413.0298284954642,
                },
                {
                  time: 50563.49827720566,
                  position: 2738.1398383195615,
                },
                {
                  time: 50577.75174569455,
                  position: 3145.965,
                },
                {
                  time: 50602.43174569455,
                  position: 3770.858012400591,
                },
                {
                  time: 50616.43174569455,
                  position: 4156.964371844142,
                },
                {
                  time: 50626.43174569455,
                  position: 4459.229607497612,
                },
                {
                  time: 50638.43174569455,
                  position: 4850.376521303067,
                },
                {
                  time: 50650.43174569455,
                  position: 5270.281282169671,
                },
                {
                  time: 50662.43174569455,
                  position: 5716.242002875245,
                },
                {
                  time: 50672.43174569455,
                  position: 6106.035980221415,
                },
                {
                  time: 50680.43174569455,
                  position: 6435.579634345027,
                },
                {
                  time: 50690.43174569455,
                  position: 6868.595781383138,
                },
                {
                  time: 50716.43174569455,
                  position: 8020.071253348365,
                },
                {
                  time: 50744.43174569455,
                  position: 9210.531491201365,
                },
                {
                  time: 50750.43174569455,
                  position: 9484.128166707702,
                },
                {
                  time: 50756.43174569455,
                  position: 9771.392110422634,
                },
                {
                  time: 50764.43174569455,
                  position: 10172.427180640114,
                },
                {
                  time: 50770.43174569455,
                  position: 10486.693547932831,
                },
                {
                  time: 50859.935124907905,
                  position: 15453.965,
                },
                {
                  time: 50865.935124907905,
                  position: 15793.311759016024,
                },
                {
                  time: 50871.935124907905,
                  position: 16143.99757989964,
                },
                {
                  time: 50881.935124907905,
                  position: 16748.723176299554,
                },
                {
                  time: 50891.935124907905,
                  position: 17368.41050165773,
                },
                {
                  time: 50913.935124907905,
                  position: 18766.6763033138,
                },
                {
                  time: 50921.935124907905,
                  position: 19286.141310948067,
                },
                {
                  time: 50929.935124907905,
                  position: 19816.618864989814,
                },
                {
                  time: 50945.935124907905,
                  position: 20905.824840111123,
                },
                {
                  time: 50953.935124907905,
                  position: 21467.64995775713,
                },
                {
                  time: 50963.935124907905,
                  position: 22189.116288063826,
                },
                {
                  time: 50971.935124907905,
                  position: 22780.758499968604,
                },
                {
                  time: 50981.935124907905,
                  position: 23537.4561097713,
                },
                {
                  time: 51007.935124907905,
                  position: 25538.497935155963,
                },
                {
                  time: 51023.935124907905,
                  position: 26785.73730604492,
                },
                {
                  time: 51035.935124907905,
                  position: 27738.84707111232,
                },
                {
                  time: 51045.935124907905,
                  position: 28553.034185602537,
                },
                {
                  time: 51202.05770487142,
                  position: 41549.750324835055,
                },
                {
                  time: 51249.79815316909,
                  position: 45487.18384380568,
                },
                {
                  time: 51464.9010873366,
                  position: 63412.01822058594,
                },
                {
                  time: 51472.9010873366,
                  position: 64070.69104510256,
                },
                {
                  time: 51490.9010873366,
                  position: 65534.839081862076,
                },
                {
                  time: 51502.9010873366,
                  position: 66525.77093593446,
                },
                {
                  time: 51825.283525107196,
                  position: 93390.965,
                },
                {
                  time: 51852.84637979722,
                  position: 95661.12432035248,
                },
                {
                  time: 52279.282189231584,
                  position: 131190.965,
                },
                {
                  time: 52305.282189231584,
                  position: 133333.25559366634,
                },
                {
                  time: 52348.88092429429,
                  position: 136961.33569717835,
                },
                {
                  time: 52813.887332933846,
                  position: 175708.57652478074,
                },
                {
                  time: 52820.25390236885,
                  position: 176228.74277777784,
                },
                {
                  time: 52826.25390236885,
                  position: 176700.4094444445,
                },
                {
                  time: 52834.25390236885,
                  position: 177301.29833333337,
                },
                {
                  time: 52842.25390236885,
                  position: 177870.18722222224,
                },
                {
                  time: 52850.25390236885,
                  position: 178407.07611111112,
                },
                {
                  time: 52858.25390236885,
                  position: 178911.965,
                },
                {
                  time: 52878.48299327795,
                  position: 180147.2705093627,
                },
                {
                  time: 52892.48299327795,
                  position: 180991.56898009698,
                },
                {
                  time: 52906.48299327795,
                  position: 181823.81089114814,
                },
                {
                  time: 52930.48299327795,
                  position: 183234.1939976445,
                },
                {
                  time: 52950.48299327795,
                  position: 184435.50229204967,
                },
                {
                  time: 53157.92652920042,
                  position: 197111.8538888888,
                },
                {
                  time: 53165.92652920042,
                  position: 197582.96499999994,
                },
                {
                  time: 53169.92652920042,
                  position: 197806.5205555555,
                },
                {
                  time: 53175.92652920042,
                  position: 198126.85388888884,
                },
                {
                  time: 53183.92652920042,
                  position: 198525.96499999997,
                },
                {
                  time: 53191.92652920042,
                  position: 198893.0761111111,
                },
                {
                  time: 53199.92652920042,
                  position: 199228.18722222222,
                },
                {
                  time: 53210.29541808931,
                  position: 199627.96499999994,
                },
                {
                  time: 53216.29541808931,
                  position: 199839.63166666662,
                },
                {
                  time: 53224.29541808931,
                  position: 200093.85388888887,
                },
                {
                  time: 53247.26030786709,
                  position: 200732.607,
                },
                {
                  time: 53253.26030786709,
                  position: 200879.607,
                },
                {
                  time: 53259.26030786709,
                  position: 201008.607,
                },
                {
                  time: 53265.26030786709,
                  position: 201119.607,
                },
                {
                  time: 53273.26030786709,
                  position: 201239.607,
                },
                {
                  time: 53279.26030786709,
                  position: 201308.607,
                },
                {
                  time: 53287.26030786709,
                  position: 201372.607,
                },
                {
                  time: 53293.26030786709,
                  position: 201399.607,
                },
                {
                  time: 53300.26030786709,
                  position: 201408.607,
                },
              ],
            ],
            tail_positions: [
              [
                {
                  time: 50400,
                  position: 0,
                },
                {
                  time: 50408,
                  position: 0,
                },
                {
                  time: 50416,
                  position: 0,
                },
                {
                  time: 50424,
                  position: 0,
                },
                {
                  time: 50432,
                  position: 36.98839247875625,
                },
                {
                  time: 50517.49827720566,
                  position: 1460.9650000000001,
                },
                {
                  time: 50523.49827720566,
                  position: 1567.7780072292762,
                },
                {
                  time: 50531.49827720566,
                  position: 1730.6174571559138,
                },
                {
                  time: 50541.49827720566,
                  position: 1961.1275570966345,
                },
                {
                  time: 50551.49827720566,
                  position: 2213.0298284954642,
                },
                {
                  time: 50563.49827720566,
                  position: 2538.1398383195615,
                },
                {
                  time: 50577.75174569455,
                  position: 2945.965,
                },
                {
                  time: 50602.43174569455,
                  position: 3570.858012400591,
                },
                {
                  time: 50616.43174569455,
                  position: 3956.964371844142,
                },
                {
                  time: 50626.43174569455,
                  position: 4259.229607497612,
                },
                {
                  time: 50638.43174569455,
                  position: 4650.376521303067,
                },
                {
                  time: 50650.43174569455,
                  position: 5070.281282169671,
                },
                {
                  time: 50662.43174569455,
                  position: 5516.242002875245,
                },
                {
                  time: 50672.43174569455,
                  position: 5906.035980221415,
                },
                {
                  time: 50680.43174569455,
                  position: 6235.579634345027,
                },
                {
                  time: 50690.43174569455,
                  position: 6668.595781383138,
                },
                {
                  time: 50716.43174569455,
                  position: 7820.071253348365,
                },
                {
                  time: 50744.43174569455,
                  position: 9010.531491201365,
                },
                {
                  time: 50750.43174569455,
                  position: 9284.128166707702,
                },
                {
                  time: 50756.43174569455,
                  position: 9571.392110422634,
                },
                {
                  time: 50764.43174569455,
                  position: 9972.427180640114,
                },
                {
                  time: 50770.43174569455,
                  position: 10286.693547932831,
                },
                {
                  time: 50859.935124907905,
                  position: 15253.965,
                },
                {
                  time: 50865.935124907905,
                  position: 15593.311759016024,
                },
                {
                  time: 50871.935124907905,
                  position: 15943.99757989964,
                },
                {
                  time: 50881.935124907905,
                  position: 16548.723176299554,
                },
                {
                  time: 50891.935124907905,
                  position: 17168.41050165773,
                },
                {
                  time: 50913.935124907905,
                  position: 18566.6763033138,
                },
                {
                  time: 50921.935124907905,
                  position: 19086.141310948067,
                },
                {
                  time: 50929.935124907905,
                  position: 19616.618864989814,
                },
                {
                  time: 50945.935124907905,
                  position: 20705.824840111123,
                },
                {
                  time: 50953.935124907905,
                  position: 21267.64995775713,
                },
                {
                  time: 50963.935124907905,
                  position: 21989.116288063826,
                },
                {
                  time: 50971.935124907905,
                  position: 22580.758499968604,
                },
                {
                  time: 50981.935124907905,
                  position: 23337.4561097713,
                },
                {
                  time: 51007.935124907905,
                  position: 25338.497935155963,
                },
                {
                  time: 51023.935124907905,
                  position: 26585.73730604492,
                },
                {
                  time: 51035.935124907905,
                  position: 27538.84707111232,
                },
                {
                  time: 51045.935124907905,
                  position: 28353.034185602537,
                },
                {
                  time: 51202.05770487142,
                  position: 41349.750324835055,
                },
                {
                  time: 51249.79815316909,
                  position: 45287.18384380568,
                },
                {
                  time: 51464.9010873366,
                  position: 63212.01822058594,
                },
                {
                  time: 51472.9010873366,
                  position: 63870.69104510256,
                },
                {
                  time: 51490.9010873366,
                  position: 65334.839081862076,
                },
                {
                  time: 51502.9010873366,
                  position: 66325.77093593446,
                },
                {
                  time: 51825.283525107196,
                  position: 93190.965,
                },
                {
                  time: 51852.84637979722,
                  position: 95461.12432035248,
                },
                {
                  time: 52279.282189231584,
                  position: 130990.965,
                },
                {
                  time: 52305.282189231584,
                  position: 133133.25559366634,
                },
                {
                  time: 52348.88092429429,
                  position: 136761.33569717835,
                },
                {
                  time: 52813.887332933846,
                  position: 175508.57652478074,
                },
                {
                  time: 52820.25390236885,
                  position: 176028.74277777784,
                },
                {
                  time: 52826.25390236885,
                  position: 176500.4094444445,
                },
                {
                  time: 52834.25390236885,
                  position: 177101.29833333337,
                },
                {
                  time: 52842.25390236885,
                  position: 177670.18722222224,
                },
                {
                  time: 52850.25390236885,
                  position: 178207.07611111112,
                },
                {
                  time: 52858.25390236885,
                  position: 178711.965,
                },
                {
                  time: 52878.48299327795,
                  position: 179947.2705093627,
                },
                {
                  time: 52892.48299327795,
                  position: 180791.56898009698,
                },
                {
                  time: 52906.48299327795,
                  position: 181623.81089114814,
                },
                {
                  time: 52930.48299327795,
                  position: 183034.1939976445,
                },
                {
                  time: 52950.48299327795,
                  position: 184235.50229204967,
                },
                {
                  time: 53157.92652920042,
                  position: 196911.8538888888,
                },
                {
                  time: 53165.92652920042,
                  position: 197382.96499999994,
                },
                {
                  time: 53169.92652920042,
                  position: 197606.5205555555,
                },
                {
                  time: 53175.92652920042,
                  position: 197926.85388888884,
                },
                {
                  time: 53183.92652920042,
                  position: 198325.96499999997,
                },
                {
                  time: 53191.92652920042,
                  position: 198693.0761111111,
                },
                {
                  time: 53199.92652920042,
                  position: 199028.18722222222,
                },
                {
                  time: 53210.29541808931,
                  position: 199427.96499999994,
                },
                {
                  time: 53216.29541808931,
                  position: 199639.63166666662,
                },
                {
                  time: 53224.29541808931,
                  position: 199893.85388888887,
                },
                {
                  time: 53247.26030786709,
                  position: 200532.607,
                },
                {
                  time: 53253.26030786709,
                  position: 200679.607,
                },
                {
                  time: 53259.26030786709,
                  position: 200808.607,
                },
                {
                  time: 53265.26030786709,
                  position: 200919.607,
                },
                {
                  time: 53273.26030786709,
                  position: 201039.607,
                },
                {
                  time: 53279.26030786709,
                  position: 201108.607,
                },
                {
                  time: 53287.26030786709,
                  position: 201172.607,
                },
                {
                  time: 53293.26030786709,
                  position: 201199.607,
                },
                {
                  time: 53300.26030786709,
                  position: 201208.607,
                },
              ],
            ],
            speeds: [
              {
                time: 50400,
                position: 0,
                speed: 0,
              },
              {
                time: 50402,
                position: 0.9490586448983088,
                speed: 0.9490586448983088,
              },
              {
                time: 50404,
                position: 3.7876080685882414,
                speed: 1.8894907787916235,
              },
              {
                time: 50408,
                position: 15.08768165223028,
                speed: 3.7585662853925057,
              },
              {
                time: 50412,
                position: 33.83214516120702,
                speed: 5.6116489504209675,
              },
              {
                time: 50418,
                position: 75.76573617868836,
                speed: 8.360738040262225,
              },
              {
                time: 50422,
                position: 112.836826916906,
                speed: 10.17270700575389,
              },
              {
                time: 50428,
                position: 181.96120792333537,
                speed: 12.86480037753732,
              },
              {
                time: 50436.570030776566,
                position: 308.55995765996323,
                speed: 16.666666666666668,
              },
              {
                time: 50469.41433331696,
                position: 855.965,
                speed: 16.666666666666668,
              },
              {
                time: 50472.46016693547,
                position: 908.6938467914624,
                speed: 17.94572180176421,
              },
              {
                time: 50475.018277205665,
                position: 952.965,
                speed: 16.666666666666668,
              },
              {
                time: 50517.49827720566,
                position: 1660.965,
                speed: 16.666666666666668,
              },
              {
                time: 50529.49827720566,
                position: 1887.858671857618,
                speed: 21.056336905724773,
              },
              {
                time: 50539.49827720566,
                position: 2113.090781464639,
                speed: 23.80534114707529,
              },
              {
                time: 50551.49827720566,
                position: 2413.029828495464,
                speed: 26.105668045905404,
              },
              {
                time: 50572.46938812619,
                position: 2996.3655202844907,
                speed: 29.641178784176407,
              },
              {
                time: 50581.75174569455,
                position: 3249.965,
                speed: 25,
              },
              {
                time: 50596.43174569455,
                position: 3616.965,
                speed: 25,
              },
              {
                time: 50626.43174569455,
                position: 4459.229607497612,
                speed: 31.345374805946133,
              },
              {
                time: 50642.43174569455,
                position: 4987.250326566449,
                speed: 34.61553198154361,
              },
              {
                time: 50656.43174569455,
                position: 5490.174913149777,
                speed: 37.17209736732895,
              },
              {
                time: 50670.43174569455,
                position: 6026.6744400508705,
                speed: 39.45240892712816,
              },
              {
                time: 50682.43174569455,
                position: 6521.178532726996,
                speed: 43.07577255246863,
              },
              {
                time: 50686.43174569455,
                position: 6693.960154849802,
                speed: 43.33322615807421,
              },
              {
                time: 50694.43174569455,
                position: 7046.075111813276,
                speed: 44.70812670813125,
              },
              {
                time: 50698.43174569455,
                position: 7225.23599945501,
                speed: 44.77339358281161,
              },
              {
                time: 50714.43174569455,
                position: 7932.902880120726,
                speed: 43.69624472410094,
              },
              {
                time: 50734.43174569455,
                position: 8783.682799773613,
                speed: 41.324123750709546,
              },
              {
                time: 50740.43174569455,
                position: 9036.004387683512,
                speed: 42.89585277574626,
              },
              {
                time: 50752.43174569455,
                position: 9578.5172191259,
                speed: 47.55163379646402,
              },
              {
                time: 50768.43174569455,
                position: 10380.54788310116,
                speed: 52.69311822784173,
              },
              {
                time: 50775.47304653589,
                position: 10761.627312665774,
                speed: 55.55555555555556,
              },
              {
                time: 50859.935124907905,
                position: 15453.965,
                speed: 55.55555555555556,
              },
              {
                time: 50873.935124907905,
                position: 16263.167336376571,
                speed: 59.85825428880899,
              },
              {
                time: 50881.935124907905,
                position: 16748.723176299554,
                speed: 61.38572431306721,
              },
              {
                time: 50901.935124907905,
                position: 17999.134634225047,
                speed: 63.69031321436226,
              },
              {
                time: 50915.935124907905,
                position: 18895.395244128296,
                speed: 64.48409205077189,
              },
              {
                time: 50921.935124907905,
                position: 19286.141310948067,
                speed: 65.7013819681295,
              },
              {
                time: 50943.935124907905,
                position: 20767.50609335596,
                speed: 68.96061864834742,
              },
              {
                time: 50963.935124907905,
                position: 22189.116288063826,
                speed: 73.16914241504898,
              },
              {
                time: 50981.935124907905,
                position: 23537.4561097713,
                speed: 76.59368700768825,
              },
              {
                time: 50987.935124907905,
                position: 23999.409845542636,
                speed: 77.21262710092336,
              },
              {
                time: 50995.935124907905,
                position: 24614.388639609148,
                speed: 76.54905821591642,
              },
              {
                time: 51011.935124907905,
                position: 25848.712308372487,
                speed: 77.81157209750988,
              },
              {
                time: 51021.935124907905,
                position: 26629.081230660693,
                speed: 78.22486444596254,
              },
              {
                time: 51039.935124907905,
                position: 28062.013071366036,
                speed: 81.07716031674254,
              },
              {
                time: 51048.00122209541,
                position: 28724.57556097535,
                speed: 83.33333333333333,
              },
              {
                time: 51083.821895363704,
                position: 31709.6308858811,
                speed: 83.33255254776554,
              },
              {
                time: 51091.821895363704,
                position: 32373.97423797496,
                speed: 82.84657929799457,
              },
              {
                time: 51096.28919601914,
                position: 32745.1422452447,
                speed: 83.33333333333333,
              },
              {
                time: 51128.64706907621,
                position: 35441.63166666664,
                speed: 83.33333333333333,
              },
              {
                time: 51140.64706907621,
                position: 36436.43850406896,
                speed: 82.46245470354208,
              },
              {
                time: 51148.271514743516,
                position: 37068.449156007664,
                speed: 83.33333333333333,
              },
              {
                time: 51196.05770487142,
                position: 41050.63042815859,
                speed: 83.33209482526631,
              },
              {
                time: 51206.05770487142,
                position: 41881.54119684637,
                speed: 82.85385166361458,
              },
              {
                time: 51210.05770487142,
                position: 42213.107803883555,
                speed: 82.99070178839779,
              },
              {
                time: 51216.05770487142,
                position: 42709.14184618783,
                speed: 82.33330657037375,
              },
              {
                time: 51220.05770487142,
                position: 43038.745036132226,
                speed: 82.5128013855045,
              },
              {
                time: 51238.05770487142,
                position: 44518.880928441264,
                speed: 81.9430736672955,
              },
              {
                time: 51246.05770487142,
                position: 45176.816922214144,
                speed: 82.6780265594408,
              },
              {
                time: 51249.79815316909,
                position: 45487.18384380568,
                speed: 83.33333333333333,
              },
              {
                time: 51462.9010873366,
                position: 63245.63166666665,
                speed: 83.33333333333333,
              },
              {
                time: 51476.9010873366,
                position: 64395.74223491244,
                speed: 80.90874120181111,
              },
              {
                time: 51490.9010873366,
                position: 65534.83908186208,
                speed: 81.87944083610552,
              },
              {
                time: 51503.30390485196,
                position: 66559.3299787296,
                speed: 83.33333333333333,
              },
              {
                time: 51825.283525107196,
                position: 93390.965,
                speed: 83.33333333333333,
              },
              {
                time: 51839.283525107196,
                position: 94544.84906853344,
                speed: 81.3434987537168,
              },
              {
                time: 51852.84637979722,
                position: 95661.12432035248,
                speed: 83.33333333333333,
              },
              {
                time: 52026.32046795299,
                position: 110117.29833333335,
                speed: 83.33333333333333,
              },
              {
                time: 52038.32046795299,
                position: 111112.8984723236,
                speed: 82.65687277733876,
              },
              {
                time: 52044.36890575577,
                position: 111614.85804368171,
                speed: 83.33333333333333,
              },
              {
                time: 52279.282189231584,
                position: 131190.965,
                speed: 83.33333333333333,
              },
              {
                time: 52293.282189231584,
                position: 132346.46010255828,
                speed: 81.53146243137134,
              },
              {
                time: 52308.394743377554,
                position: 133592.0894357146,
                speed: 83.33333333333333,
              },
              {
                time: 52335.60525014898,
                position: 135859.63166666662,
                speed: 83.33333333333333,
              },
              {
                time: 52341.60525014898,
                position: 136357.82622933082,
                speed: 82.6938108810291,
              },
              {
                time: 52348.88092429429,
                position: 136961.33569717835,
                speed: 83.33333333333333,
              },
              {
                time: 52641.41198995405,
                position: 161338.29833333325,
                speed: 83.33333333333333,
              },
              {
                time: 52649.41198995405,
                position: 162003.15432985823,
                speed: 82.9128855540673,
              },
              {
                time: 52653.33211751481,
                position: 162328.99181158727,
                speed: 83.33333333333333,
              },
              {
                time: 52813.07979577577,
                position: 175641.2977278311,
                speed: 83.33272783120943,
              },
              {
                time: 52813.887332933846,
                position: 175708.57652478074,
                speed: 83.2943958286144,
              },
              {
                time: 52818.25390236885,
                position: 176067.52055555562,
                speed: 81.11111111111111,
              },
              {
                time: 52834.25390236885,
                position: 177301.29833333337,
                speed: 73.11111111111111,
              },
              {
                time: 52846.25390236885,
                position: 178142.63166666668,
                speed: 67.11111111111111,
              },
              {
                time: 52858.25390236885,
                position: 178911.965,
                speed: 61.11111111111111,
              },
              {
                time: 52874.48299327795,
                position: 179903.68796172203,
                speed: 61.05629505542252,
              },
              {
                time: 52916.48299327795,
                position: 182410.6124384856,
                speed: 58.3752119619226,
              },
              {
                time: 52955.07641105239,
                position: 184715.50716255856,
                speed: 61.11111111111111,
              },
              {
                time: 53157.482084755975,
                position: 197084.7427777777,
                speed: 61.11111111111111,
              },
              {
                time: 53167.92652920042,
                position: 197695.74277777772,
                speed: 55.888888888888886,
              },
              {
                time: 53179.92652920042,
                position: 198330.4094444444,
                speed: 49.888888888888886,
              },
              {
                time: 53189.92652920042,
                position: 198804.2983333333,
                speed: 44.888888888888886,
              },
              {
                time: 53201.92652920042,
                position: 199306.965,
                speed: 38.888888888888886,
              },
              {
                time: 53206.07319586709,
                position: 199468.2242592592,
                speed: 38.888888888888886,
              },
              {
                time: 53216.29541808931,
                position: 199839.63166666665,
                speed: 33.77777777777778,
              },
              {
                time: 53228.29541808931,
                position: 200208.965,
                speed: 27.77777777777778,
              },
              {
                time: 53243.70475231153,
                position: 200637.0020617284,
                speed: 27.77777777777778,
              },
              {
                time: 53251.26030786709,
                position: 200832.607,
                speed: 24,
              },
              {
                time: 53257.26030786709,
                position: 200967.607,
                speed: 21,
              },
              {
                time: 53263.26030786709,
                position: 201084.607,
                speed: 18,
              },
              {
                time: 53271.26030786709,
                position: 201212.607,
                speed: 14,
              },
              {
                time: 53277.26030786709,
                position: 201287.607,
                speed: 11,
              },
              {
                time: 53281.26030786709,
                position: 201327.607,
                speed: 9,
              },
              {
                time: 53285.26030786709,
                position: 201359.607,
                speed: 7,
              },
              {
                time: 53291.26030786709,
                position: 201392.607,
                speed: 4,
              },
              {
                time: 53295.26030786709,
                position: 201404.607,
                speed: 2,
              },
              {
                time: 53297.26030786709,
                position: 201407.607,
                speed: 1,
              },
              {
                time: 53300.26030786709,
                position: 201408.607,
                speed: 0,
              },
            ],
            stops: [
              {
                time: 50400,
                position: 0,
                duration: 0,
                id: null,
                name: null,
                line_code: 420000,
                track_number: 4467,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie 1 de  Paris-Montparnasse',
              },
              {
                time: 50468.143826091895,
                position: 838.965,
                duration: 0,
                id: 'd98aed70-6667-11e3-89ff-01f464e0362d',
                name: 'Paris-Montparnasse',
                line_code: 420000,
                track_number: 389,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V2 de Paris-Montparnasse à Brest',
              },
              {
                time: 50521.093344978406,
                position: 1724.965,
                duration: 0,
                id: 'd991522e-6667-11e3-89ff-01f464e0362d',
                name: 'Paris-Montparnasse',
                line_code: 553000,
                track_number: 505,
                line_name: "Ligne d'Ouest-Ceinture à Chartres",
                track_name: 'Voie 1',
              },
              {
                time: 50523.753104535186,
                position: 1772.965,
                duration: 0,
                id: 'd991522e-6667-11e3-89ff-01f464e0362d',
                name: 'Paris-Montparnasse',
                line_code: 420000,
                track_number: 13542,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie 80 de  Paris-Montparnasse',
              },
              {
                time: 50530.48366030956,
                position: 1909.965,
                duration: 0,
                id: 'd96dd23c-6667-11e3-89ff-01f464e0362d',
                name: 'Vanves-Malakoff',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 50591.653901467784,
                position: 3497.965,
                duration: 0,
                id: 'd94b9e04-6667-11e3-89ff-01f464e0362d',
                name: 'Montrouge-Châtillon',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 50656.53139637603,
                position: 5496.965,
                duration: 0,
                id: 'd9abaea4-6667-11e3-89ff-01f464e0362d',
                name: 'Montrouge-Châtillon',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 50784.76144018352,
                position: 11281.965,
                duration: 0,
                id: 'd9b1afd2-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 50817.35712466732,
                position: 13090.965,
                duration: 0,
                id: 'd98ef502-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 50821.48338876173,
                position: 13319.965,
                duration: 0,
                id: 'd995be4a-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 50829.087246612566,
                position: 13741.965,
                duration: 0,
                id: 'd9b63fde-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 50836.27667619191,
                position: 14140.965,
                duration: 0,
                id: 'd9cce656-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 50997.208784237875,
                position: 24712.965,
                duration: 0,
                id: 'd99fe84e-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 12 Marcoussis',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51231.51135711593,
                position: 43978.965,
                duration: 0,
                id: 'd9c68ba6-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 13 St-Arnoult',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51369.846273795214,
                position: 55490.965,
                duration: 0,
                id: 'b5992bfa-51ee-11ec-80ff-0168b2273146',
                name: 'Poste 13 St-Arnoult',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51494.22070109625,
                position: 65808.965,
                duration: 0,
                id: 'bd3f33ec-91b6-11e6-b6ff-010c64e0362d',
                name: 'Poste 14 St-Léger',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51503.575416333384,
                position: 66581.965,
                duration: 0,
                id: 'd944e8be-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 14 St-Léger',
                line_code: 431000,
                track_number: 12304,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie 3 de St-Léger',
              },
              {
                time: 51510.3554186258,
                position: 67146.965,
                duration: 0,
                id: 'd944e8be-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 14 St-Léger',
                line_code: 431000,
                track_number: 12304,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie 3 de St-Léger',
              },
              {
                time: 51804.55951810013,
                position: 91663.965,
                duration: 0,
                id: 'd9e1d9fe-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 15 Rouvray',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52065.96731091809,
                position: 113417.965,
                duration: 0,
                id: 'd9d9a0c8-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 16 Dangeau',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52260.654794242415,
                position: 129638.965,
                duration: 0,
                id: 'd99ac560-6667-11e3-89ff-01f464e0362d',
                name: 'Courtalain-TGV-Bifurcation',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52305.81946335617,
                position: 133377.965,
                duration: 0,
                id: 'd991ca18-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 17',
                line_code: 429000,
                track_number: 396,
                line_name: 'Ligne de Courtalain à Connerré (LGV)',
                track_name: 'Voie 1',
              },
              {
                time: 52771.24037027163,
                position: 172154.965,
                duration: 0,
                id: 'd9c72694-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 32 Dollon',
                line_code: 429000,
                track_number: 396,
                line_name: 'Ligne de Courtalain à Connerré (LGV)',
                track_name: 'Voie 1',
              },
              {
                time: 52859.89148034092,
                position: 179011.965,
                duration: 0,
                id: 'bd3d7012-91b6-11e6-b6ff-010c64e0362d',
                name: 'Poste 33 Connerré',
                line_code: 429000,
                track_number: 396,
                line_name: 'Ligne de Courtalain à Connerré (LGV)',
                track_name: 'Voie 1',
              },
              {
                time: 52898.24279005697,
                position: 181333.965,
                duration: 0,
                id: 'd9b146e4-6667-11e3-89ff-01f464e0362d',
                name: 'Connerré-Beillé',
                line_code: 429310,
                track_number: 398,
                line_name: 'Raccordement de Connerré-Sud',
                track_name: 'Voie 1',
              },
              {
                time: 52912.7477440196,
                position: 182191.965,
                duration: 0,
                id: 'd990066a-6667-11e3-89ff-01f464e0362d',
                name: 'Connerré-Beillé',
                line_code: 420000,
                track_number: 389,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V2 de Paris-Montparnasse à Brest',
              },
              {
                time: 52947.84358268221,
                position: 184276.965,
                duration: 0,
                id: 'd97dc09a-6667-11e3-89ff-01f464e0362d',
                name: 'Montfort-le-Gesnois',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 52951.325160365515,
                position: 184486.965,
                duration: 0,
                id: 'd9d582aa-6667-11e3-89ff-01f464e0362d',
                name: 'Montfort-le-Gesnois',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 53041.96872895832,
                position: 190025.965,
                duration: 0,
                id: 'd9a52b18-6667-11e3-89ff-01f464e0362d',
                name: 'Champagné',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 53202.021632652955,
                position: 199308.965,
                duration: 0,
                id: 'd97a0c7c-6667-11e3-89ff-01f464e0362d',
                name: 'Le Mans',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 53229.224930758915,
                position: 200230.965,
                duration: 0,
                id: 'd9b6e040-6667-11e3-89ff-01f464e0362d',
                name: 'Le Mans',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 53300.26030786709,
                position: 201408.607,
                duration: 1,
                id: null,
                name: null,
                line_code: 450000,
                track_number: 424,
                line_name: 'Ligne du Mans à Angers-Maître-École',
                track_name: 'Voie 2',
              },
            ],
            route_aspects: [
              {
                signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
                time_start: 50400,
                time_end: 50437.314,
                position_start: 320.965,
                position_end: 605.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '69ca947c-6667-11e3-81ff-01f464e0362d',
                track_offset: 496,
              },
              {
                signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
                time_start: 50437.314,
                time_end: 50466.409,
                position_start: 320.965,
                position_end: 605.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '69ca947c-6667-11e3-81ff-01f464e0362d',
                track_offset: 496,
              },
              {
                signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
                time_start: 50466.409,
                time_end: 50514.491,
                position_start: 320.965,
                position_end: 605.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '69ca947c-6667-11e3-81ff-01f464e0362d',
                track_offset: 496,
              },
              {
                signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
                time_start: 50437.314,
                time_end: 50454.413,
                position_start: 605.965,
                position_end: 1410.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60c895c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 51,
              },
              {
                signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
                time_start: 50454.413,
                time_end: 50514.491,
                position_start: 605.965,
                position_end: 1410.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60c895c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 51,
              },
              {
                signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
                time_start: 50514.491,
                time_end: 50549.366,
                position_start: 605.965,
                position_end: 1410.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60c895c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 51,
              },
              {
                signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
                time_start: 50478.49,
                time_end: 50502.49,
                position_start: 1410.965,
                position_end: 2157.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '61a60592-6667-11e3-81ff-01f464e0362d',
                track_offset: 358,
              },
              {
                signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
                time_start: 50502.49,
                time_end: 50549.366,
                position_start: 1410.965,
                position_end: 2157.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '61a60592-6667-11e3-81ff-01f464e0362d',
                track_offset: 358,
              },
              {
                signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
                time_start: 50549.366,
                time_end: 50585.344,
                position_start: 1410.965,
                position_end: 2157.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '61a60592-6667-11e3-81ff-01f464e0362d',
                track_offset: 358,
              },
              {
                signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
                time_start: 50522.969,
                time_end: 50541.36,
                position_start: 2157.965,
                position_end: 3139.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '61a460c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 248,
              },
              {
                signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
                time_start: 50541.36,
                time_end: 50585.344,
                position_start: 2157.965,
                position_end: 3139.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '61a460c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 248,
              },
              {
                signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
                time_start: 50585.344,
                time_end: 50645.395,
                position_start: 2157.965,
                position_end: 3139.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '61a460c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 248,
              },
              {
                signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
                time_start: 50563.556,
                time_end: 50577.522,
                position_start: 3139.965,
                position_end: 4890.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '61a465bc-6667-11e3-81ff-01f464e0362d',
                track_offset: 544,
              },
              {
                signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
                time_start: 50577.522,
                time_end: 50645.395,
                position_start: 3139.965,
                position_end: 4890.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '61a465bc-6667-11e3-81ff-01f464e0362d',
                track_offset: 544,
              },
              {
                signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
                time_start: 50645.395,
                time_end: 50683.463,
                position_start: 3139.965,
                position_end: 4890.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '61a465bc-6667-11e3-81ff-01f464e0362d',
                track_offset: 544,
              },
              {
                signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
                time_start: 50627.432,
                time_end: 50639.619,
                position_start: 4890.965,
                position_end: 6365.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8b696-6667-11e3-81ff-01f464e0362d',
                track_offset: 1393,
              },
              {
                signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
                time_start: 50639.619,
                time_end: 50683.463,
                position_start: 4890.965,
                position_end: 6365.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8b696-6667-11e3-81ff-01f464e0362d',
                track_offset: 1393,
              },
              {
                signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
                time_start: 50683.463,
                time_end: 50736.164,
                position_start: 4890.965,
                position_end: 6365.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8b696-6667-11e3-81ff-01f464e0362d',
                track_offset: 1393,
              },
              {
                signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
                time_start: 50668.88,
                time_end: 50678.776,
                position_start: 6365.965,
                position_end: 8655.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 869,
              },
              {
                signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
                time_start: 50678.776,
                time_end: 50736.164,
                position_start: 6365.965,
                position_end: 8655.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 869,
              },
              {
                signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
                time_start: 50736.164,
                time_end: 50777.883,
                position_start: 6365.965,
                position_end: 8655.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 869,
              },
              {
                signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
                time_start: 50721.903,
                time_end: 50731.348,
                position_start: 8655.965,
                position_end: 10695.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 3159,
              },
              {
                signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
                time_start: 50731.348,
                time_end: 50777.883,
                position_start: 8655.965,
                position_end: 10695.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 3159,
              },
              {
                signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
                time_start: 50777.883,
                time_end: 50823.329,
                position_start: 8655.965,
                position_end: 10695.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 3159,
              },
              {
                signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
                time_start: 50766.81,
                time_end: 50774.278,
                position_start: 10695.965,
                position_end: 13220.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 5199,
              },
              {
                signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
                time_start: 50774.278,
                time_end: 50823.329,
                position_start: 10695.965,
                position_end: 13220.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 5199,
              },
              {
                signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
                time_start: 50823.329,
                time_end: 50861.71,
                position_start: 10695.965,
                position_end: 13220.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 5199,
              },
              {
                signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
                time_start: 50812.531,
                time_end: 50819.73,
                position_start: 13220.965,
                position_end: 15353.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
                track_offset: 10,
              },
              {
                signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
                time_start: 50819.73,
                time_end: 50861.71,
                position_start: 13220.965,
                position_end: 15353.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
                track_offset: 10,
              },
              {
                signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
                time_start: 52868.402,
                time_end: 52874.949,
                position_start: 179935.965,
                position_end: 181568.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
                track_offset: 924,
              },
              {
                signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
                time_start: 52874.949,
                time_end: 52905.492,
                position_start: 179935.965,
                position_end: 181568.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
                track_offset: 924,
              },
              {
                signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
                time_start: 52905.492,
                time_end: 52940.385,
                position_start: 179935.965,
                position_end: 181568.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
                track_offset: 924,
              },
              {
                signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
                time_start: 52895.388,
                time_end: 52902.113,
                position_start: 181568.965,
                position_end: 183628.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
                track_offset: 235,
              },
              {
                signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
                time_start: 52902.113,
                time_end: 52940.385,
                position_start: 181568.965,
                position_end: 183628.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
                track_offset: 235,
              },
              {
                signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
                time_start: 52940.385,
                time_end: 52967.834,
                position_start: 181568.965,
                position_end: 183628.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
                track_offset: 235,
              },
              {
                signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
                time_start: 52930.332,
                time_end: 52937.048,
                position_start: 183628.965,
                position_end: 185298.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 1140,
              },
              {
                signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
                time_start: 52937.048,
                time_end: 52967.834,
                position_start: 183628.965,
                position_end: 185298.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 1140,
              },
              {
                signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
                time_start: 52967.834,
                time_end: 52995.488,
                position_start: 183628.965,
                position_end: 185298.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 1140,
              },
              {
                signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
                time_start: 52958.016,
                time_end: 52964.561,
                position_start: 185298.965,
                position_end: 186988.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 2810,
              },
              {
                signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
                time_start: 52964.561,
                time_end: 52995.488,
                position_start: 185298.965,
                position_end: 186988.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 2810,
              },
              {
                signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
                time_start: 52995.488,
                time_end: 53022.161,
                position_start: 185298.965,
                position_end: 186988.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 2810,
              },
              {
                signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
                time_start: 52985.67,
                time_end: 52992.215,
                position_start: 186988.965,
                position_end: 188618.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 4500,
              },
              {
                signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
                time_start: 52992.215,
                time_end: 53022.161,
                position_start: 186988.965,
                position_end: 188618.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 4500,
              },
              {
                signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
                time_start: 53022.161,
                time_end: 53049.061,
                position_start: 186988.965,
                position_end: 188618.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 4500,
              },
              {
                signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
                time_start: 53012.342,
                time_end: 53018.888,
                position_start: 188618.965,
                position_end: 190262.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 6130,
              },
              {
                signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
                time_start: 53018.888,
                time_end: 53049.061,
                position_start: 188618.965,
                position_end: 190262.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 6130,
              },
              {
                signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
                time_start: 53049.061,
                time_end: 53076.698,
                position_start: 188618.965,
                position_end: 190262.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 6130,
              },
              {
                signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
                time_start: 53039.244,
                time_end: 53045.789,
                position_start: 190262.965,
                position_end: 191951.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca4278-6667-11e3-81ff-01f464e0362d',
                track_offset: 264,
              },
              {
                signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
                time_start: 53045.789,
                time_end: 53076.698,
                position_start: 190262.965,
                position_end: 191951.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca4278-6667-11e3-81ff-01f464e0362d',
                track_offset: 264,
              },
              {
                signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
                time_start: 53076.698,
                time_end: 53108.312,
                position_start: 190262.965,
                position_end: 191951.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca4278-6667-11e3-81ff-01f464e0362d',
                track_offset: 264,
              },
              {
                signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
                time_start: 53066.88,
                time_end: 53073.425,
                position_start: 191951.965,
                position_end: 193883.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 1085,
              },
              {
                signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
                time_start: 53073.425,
                time_end: 53108.312,
                position_start: 191951.965,
                position_end: 193883.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 1085,
              },
              {
                signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
                time_start: 53108.312,
                time_end: 53140.303,
                position_start: 191951.965,
                position_end: 193883.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 1085,
              },
              {
                signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
                time_start: 53098.494,
                time_end: 53105.039,
                position_start: 193883.965,
                position_end: 195838.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 3017,
              },
              {
                signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
                time_start: 53105.039,
                time_end: 53140.303,
                position_start: 193883.965,
                position_end: 195838.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 3017,
              },
              {
                signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
                time_start: 53140.303,
                time_end: 53167.971,
                position_start: 193883.965,
                position_end: 195838.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 3017,
              },
              {
                signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
                time_start: 53130.485,
                time_end: 53137.03,
                position_start: 195838.965,
                position_end: 197501.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 4972,
              },
              {
                signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
                time_start: 53137.03,
                time_end: 53167.971,
                position_start: 195838.965,
                position_end: 197501.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 4972,
              },
              {
                signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
                time_start: 53167.971,
                time_end: 53201.398,
                position_start: 195838.965,
                position_end: 197501.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 4972,
              },
              {
                signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
                time_start: 53157.698,
                time_end: 53164.444,
                position_start: 197501.965,
                position_end: 199088.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 6635,
              },
              {
                signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
                time_start: 53164.444,
                time_end: 53201.398,
                position_start: 197501.965,
                position_end: 199088.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 6635,
              },
              {
                signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
                time_start: 53201.398,
                time_end: 53227.654,
                position_start: 197501.965,
                position_end: 199088.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 6635,
              },
              {
                signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
                time_start: 53187.326,
                time_end: 53196.442,
                position_start: 199088.965,
                position_end: 199992.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 8222,
              },
              {
                signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
                time_start: 53196.442,
                time_end: 53227.654,
                position_start: 199088.965,
                position_end: 199992.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 8222,
              },
              {
                signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
                time_start: 53227.654,
                time_end: 53252.86,
                position_start: 199088.965,
                position_end: 199992.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 8222,
              },
              {
                signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
                time_start: 53209.282,
                time_end: 53220.931,
                position_start: 199992.965,
                position_end: 200671.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
                track_offset: 684,
              },
              {
                signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
                time_start: 53220.931,
                time_end: 53252.86,
                position_start: 199992.965,
                position_end: 200671.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
                track_offset: 684,
              },
              {
                signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
                time_start: 53252.86,
                time_end: 53300.26030786709,
                position_start: 199992.965,
                position_end: 200671.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
                track_offset: 684,
              },
              {
                signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
                time_start: 53230.495,
                time_end: 53244.91,
                position_start: 200671.965,
                position_end: 201657.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
                track_offset: 12,
              },
              {
                signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
                time_start: 53244.91,
                time_end: 53300.26030786709,
                position_start: 200671.965,
                position_end: 201657.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
                track_offset: 12,
              },
              {
                signal_id: 'b564cfd6-4964-11e4-9bff-012064e0362d',
                time_start: 50400,
                time_end: 53300.26030786709,
                position_start: 201657.965,
                position_end: 201657.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '6058b958-6667-11e3-81ff-01f464e0362d',
                track_offset: 705,
              },
            ],
            mechanical_energy_consumed: 12083466761.106243,
          },
          speed_limit_tags: 'Aucune composition',
          electrification_ranges: [
            {
              electrificationUsage: {
                mode: '1500V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 0,
              stop: 6503.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: true,
                object_type: 'Neutral',
              },
              start: 6503.965,
              stop: 7106.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 7106.965,
              stop: 63305.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 63305.965,
              stop: 63996.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 63996.965,
              stop: 93473.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 93473.965,
              stop: 94165.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 94165.965,
              stop: 131273.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 131273.965,
              stop: 131965.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 131965.965,
              stop: 179005.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 179005.965,
              stop: 179011.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 179011.965,
              stop: 179841.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: true,
                object_type: 'Neutral',
              },
              start: 179841.965,
              stop: 180550.965,
            },
            {
              electrificationUsage: {
                mode: '1500V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 180550.965,
              stop: 201408.607,
            },
          ],
          power_restriction_ranges: [],
        },
        {
          id: 11,
          labels: [],
          path: 4,
          name: 'sample 3',
          vmax: [
            {
              position: 0,
              speed: 16.666666666666668,
            },
            {
              position: 320.96500000000003,
              speed: 16.666666666666668,
            },
            {
              position: 320.96500000000003,
              speed: 16.666666666666668,
            },
            {
              position: 394.965,
              speed: 16.666666666666668,
            },
            {
              position: 394.965,
              speed: 16.666666666666668,
            },
            {
              position: 420.965,
              speed: 16.666666666666668,
            },
            {
              position: 420.965,
              speed: 16.666666666666668,
            },
            {
              position: 477.965,
              speed: 16.666666666666668,
            },
            {
              position: 477.965,
              speed: 16.666666666666668,
            },
            {
              position: 511.965,
              speed: 16.666666666666668,
            },
            {
              position: 511.965,
              speed: 16.666666666666668,
            },
            {
              position: 551.965,
              speed: 16.666666666666668,
            },
            {
              position: 551.965,
              speed: 16.666666666666668,
            },
            {
              position: 554.965,
              speed: 16.666666666666668,
            },
            {
              position: 554.965,
              speed: 16.666666666666668,
            },
            {
              position: 605.965,
              speed: 16.666666666666668,
            },
            {
              position: 605.965,
              speed: 25,
            },
            {
              position: 637.965,
              speed: 25,
            },
            {
              position: 637.965,
              speed: 25,
            },
            {
              position: 677.965,
              speed: 25,
            },
            {
              position: 677.965,
              speed: 25,
            },
            {
              position: 756.965,
              speed: 25,
            },
            {
              position: 756.965,
              speed: 25,
            },
            {
              position: 802.965,
              speed: 25,
            },
            {
              position: 802.965,
              speed: 25,
            },
            {
              position: 838.965,
              speed: 25,
            },
            {
              position: 838.965,
              speed: 25,
            },
            {
              position: 892.965,
              speed: 25,
            },
            {
              position: 892.965,
              speed: 25,
            },
            {
              position: 951.965,
              speed: 25,
            },
            {
              position: 951.965,
              speed: 30.555555555555554,
            },
            {
              position: 982.965,
              speed: 30.555555555555554,
            },
            {
              position: 982.965,
              speed: 30.555555555555554,
            },
            {
              position: 1052.965,
              speed: 30.555555555555554,
            },
            {
              position: 1052.965,
              speed: 16.666666666666668,
            },
            {
              position: 1066.965,
              speed: 16.666666666666668,
            },
            {
              position: 1066.965,
              speed: 16.666666666666668,
            },
            {
              position: 1410.965,
              speed: 16.666666666666668,
            },
            {
              position: 1410.965,
              speed: 25,
            },
            {
              position: 1425.965,
              speed: 25,
            },
            {
              position: 1425.965,
              speed: 25,
            },
            {
              position: 1724.965,
              speed: 25,
            },
            {
              position: 1724.965,
              speed: 36.11111111111111,
            },
            {
              position: 1772.965,
              speed: 36.11111111111111,
            },
            {
              position: 1772.965,
              speed: 41.666666666666664,
            },
            {
              position: 1780.965,
              speed: 41.666666666666664,
            },
            {
              position: 1780.965,
              speed: 41.666666666666664,
            },
            {
              position: 1909.965,
              speed: 41.666666666666664,
            },
            {
              position: 1909.965,
              speed: 41.666666666666664,
            },
            {
              position: 2157.965,
              speed: 41.666666666666664,
            },
            {
              position: 2157.965,
              speed: 41.666666666666664,
            },
            {
              position: 2595.965,
              speed: 41.666666666666664,
            },
            {
              position: 2595.965,
              speed: 41.666666666666664,
            },
            {
              position: 3139.965,
              speed: 41.666666666666664,
            },
            {
              position: 3139.965,
              speed: 41.666666666666664,
            },
            {
              position: 3349.965,
              speed: 41.666666666666664,
            },
            {
              position: 3349.965,
              speed: 25,
            },
            {
              position: 3366.965,
              speed: 25,
            },
            {
              position: 3366.965,
              speed: 41.666666666666664,
            },
            {
              position: 3367.965,
              speed: 41.666666666666664,
            },
            {
              position: 3367.965,
              speed: 41.666666666666664,
            },
            {
              position: 3494.965,
              speed: 41.666666666666664,
            },
            {
              position: 3494.965,
              speed: 41.666666666666664,
            },
            {
              position: 3497.965,
              speed: 41.666666666666664,
            },
            {
              position: 3497.965,
              speed: 41.666666666666664,
            },
            {
              position: 3625.965,
              speed: 41.666666666666664,
            },
            {
              position: 3625.965,
              speed: 41.666666666666664,
            },
            {
              position: 4890.965,
              speed: 41.666666666666664,
            },
            {
              position: 4890.965,
              speed: 41.666666666666664,
            },
            {
              position: 4975.965,
              speed: 41.666666666666664,
            },
            {
              position: 4975.965,
              speed: 55.55555555555556,
            },
            {
              position: 5496.965,
              speed: 55.55555555555556,
            },
            {
              position: 5496.965,
              speed: 55.55555555555556,
            },
            {
              position: 6365.965,
              speed: 55.55555555555556,
            },
            {
              position: 6365.965,
              speed: 55.55555555555556,
            },
            {
              position: 7591.965,
              speed: 55.55555555555556,
            },
            {
              position: 7591.965,
              speed: 55.55555555555556,
            },
            {
              position: 10695.965,
              speed: 55.55555555555556,
            },
            {
              position: 10695.965,
              speed: 55.55555555555556,
            },
            {
              position: 11201.965,
              speed: 55.55555555555556,
            },
            {
              position: 11201.965,
              speed: 55.55555555555556,
            },
            {
              position: 11281.965,
              speed: 55.55555555555556,
            },
            {
              position: 11281.965,
              speed: 55.55555555555556,
            },
            {
              position: 12870.965,
              speed: 55.55555555555556,
            },
            {
              position: 12870.965,
              speed: 55.55555555555556,
            },
            {
              position: 12880.965,
              speed: 55.55555555555556,
            },
            {
              position: 12880.965,
              speed: 55.55555555555556,
            },
            {
              position: 12955.965,
              speed: 55.55555555555556,
            },
            {
              position: 12955.965,
              speed: 55.55555555555556,
            },
            {
              position: 13210.965,
              speed: 55.55555555555556,
            },
            {
              position: 13210.965,
              speed: 55.55555555555556,
            },
            {
              position: 13220.965,
              speed: 55.55555555555556,
            },
            {
              position: 13220.965,
              speed: 55.55555555555556,
            },
            {
              position: 13301.965,
              speed: 55.55555555555556,
            },
            {
              position: 13301.965,
              speed: 55.55555555555556,
            },
            {
              position: 13319.965,
              speed: 55.55555555555556,
            },
            {
              position: 13319.965,
              speed: 55.55555555555556,
            },
            {
              position: 13741.965,
              speed: 55.55555555555556,
            },
            {
              position: 13741.965,
              speed: 55.55555555555556,
            },
            {
              position: 14140.965,
              speed: 55.55555555555556,
            },
            {
              position: 14140.965,
              speed: 55.55555555555556,
            },
            {
              position: 15203.965,
              speed: 55.55555555555556,
            },
            {
              position: 15203.965,
              speed: 61.11111111111111,
            },
            {
              position: 15353.965,
              speed: 61.11111111111111,
            },
            {
              position: 15353.965,
              speed: 75,
            },
            {
              position: 15365.965,
              speed: 75,
            },
            {
              position: 15365.965,
              speed: 83.33333333333333,
            },
            {
              position: 17246.965,
              speed: 83.33333333333333,
            },
            {
              position: 17246.965,
              speed: 83.33333333333333,
            },
            {
              position: 18895.965,
              speed: 83.33333333333333,
            },
            {
              position: 18895.965,
              speed: 83.33333333333333,
            },
            {
              position: 20763.965,
              speed: 83.33333333333333,
            },
            {
              position: 20763.965,
              speed: 83.33333333333333,
            },
            {
              position: 22909.965,
              speed: 83.33333333333333,
            },
            {
              position: 22909.965,
              speed: 83.33333333333333,
            },
            {
              position: 24630.965,
              speed: 83.33333333333333,
            },
            {
              position: 24630.965,
              speed: 83.33333333333333,
            },
            {
              position: 25414.965,
              speed: 83.33333333333333,
            },
            {
              position: 25414.965,
              speed: 83.33333333333333,
            },
            {
              position: 25494.965,
              speed: 83.33333333333333,
            },
            {
              position: 25494.965,
              speed: 83.33333333333333,
            },
            {
              position: 25768.965,
              speed: 83.33333333333333,
            },
            {
              position: 25768.965,
              speed: 83.33333333333333,
            },
            {
              position: 26965.965,
              speed: 83.33333333333333,
            },
            {
              position: 26965.965,
              speed: 83.33333333333333,
            },
            {
              position: 27028.965,
              speed: 83.33333333333333,
            },
            {
              position: 27028.965,
              speed: 83.33333333333333,
            },
            {
              position: 31122.965,
              speed: 83.33333333333333,
            },
            {
              position: 31122.965,
              speed: 83.33333333333333,
            },
            {
              position: 33524.965,
              speed: 83.33333333333333,
            },
            {
              position: 33524.965,
              speed: 83.33333333333333,
            },
            {
              position: 35697.965,
              speed: 83.33333333333333,
            },
            {
              position: 35697.965,
              speed: 83.33333333333333,
            },
            {
              position: 40073.965,
              speed: 83.33333333333333,
            },
            {
              position: 40073.965,
              speed: 83.33333333333333,
            },
            {
              position: 42824.965,
              speed: 83.33333333333333,
            },
            {
              position: 42824.965,
              speed: 83.33333333333333,
            },
            {
              position: 43318.965,
              speed: 83.33333333333333,
            },
            {
              position: 43318.965,
              speed: 83.33333333333333,
            },
            {
              position: 43950.965,
              speed: 83.33333333333333,
            },
            {
              position: 43950.965,
              speed: 83.33333333333333,
            },
            {
              position: 45287.965,
              speed: 83.33333333333333,
            },
            {
              position: 45287.965,
              speed: 83.33333333333333,
            },
            {
              position: 47558.965,
              speed: 83.33333333333333,
            },
            {
              position: 47558.965,
              speed: 83.33333333333333,
            },
            {
              position: 49678.965,
              speed: 83.33333333333333,
            },
            {
              position: 49678.965,
              speed: 83.33333333333333,
            },
            {
              position: 51800.965,
              speed: 83.33333333333333,
            },
            {
              position: 51800.965,
              speed: 83.33333333333333,
            },
            {
              position: 53887.965,
              speed: 83.33333333333333,
            },
            {
              position: 53887.965,
              speed: 83.33333333333333,
            },
            {
              position: 55490.965,
              speed: 83.33333333333333,
            },
            {
              position: 55490.965,
              speed: 83.33333333333333,
            },
            {
              position: 55975.965,
              speed: 83.33333333333333,
            },
            {
              position: 55975.965,
              speed: 83.33333333333333,
            },
            {
              position: 60045.965,
              speed: 83.33333333333333,
            },
            {
              position: 60045.965,
              speed: 83.33333333333333,
            },
            {
              position: 62328.965,
              speed: 83.33333333333333,
            },
            {
              position: 62328.965,
              speed: 83.33333333333333,
            },
            {
              position: 64579.965,
              speed: 83.33333333333333,
            },
            {
              position: 64579.965,
              speed: 83.33333333333333,
            },
            {
              position: 65809.965,
              speed: 83.33333333333333,
            },
            {
              position: 65809.965,
              speed: 83.33333333333333,
            },
            {
              position: 66069.965,
              speed: 83.33333333333333,
            },
            {
              position: 66069.965,
              speed: 83.33333333333333,
            },
            {
              position: 66344.965,
              speed: 83.33333333333333,
            },
            {
              position: 66344.965,
              speed: 83.33333333333333,
            },
            {
              position: 66384.965,
              speed: 83.33333333333333,
            },
            {
              position: 66384.965,
              speed: 83.33333333333333,
            },
            {
              position: 66538.965,
              speed: 83.33333333333333,
            },
            {
              position: 66538.965,
              speed: 83.33333333333333,
            },
            {
              position: 67146.965,
              speed: 83.33333333333333,
            },
            {
              position: 67146.965,
              speed: 83.33333333333333,
            },
            {
              position: 67194.965,
              speed: 83.33333333333333,
            },
            {
              position: 67194.965,
              speed: 83.33333333333333,
            },
            {
              position: 67349.965,
              speed: 83.33333333333333,
            },
            {
              position: 67349.965,
              speed: 83.33333333333333,
            },
            {
              position: 67389.965,
              speed: 83.33333333333333,
            },
            {
              position: 67389.965,
              speed: 83.33333333333333,
            },
            {
              position: 67664.965,
              speed: 83.33333333333333,
            },
            {
              position: 67664.965,
              speed: 83.33333333333333,
            },
            {
              position: 69177.965,
              speed: 83.33333333333333,
            },
            {
              position: 69177.965,
              speed: 83.33333333333333,
            },
            {
              position: 71344.965,
              speed: 83.33333333333333,
            },
            {
              position: 71344.965,
              speed: 83.33333333333333,
            },
            {
              position: 73511.965,
              speed: 83.33333333333333,
            },
            {
              position: 73511.965,
              speed: 83.33333333333333,
            },
            {
              position: 75663.965,
              speed: 83.33333333333333,
            },
            {
              position: 75663.965,
              speed: 83.33333333333333,
            },
            {
              position: 77852.965,
              speed: 83.33333333333333,
            },
            {
              position: 77852.965,
              speed: 83.33333333333333,
            },
            {
              position: 80001.965,
              speed: 83.33333333333333,
            },
            {
              position: 80001.965,
              speed: 83.33333333333333,
            },
            {
              position: 82179.965,
              speed: 83.33333333333333,
            },
            {
              position: 82179.965,
              speed: 83.33333333333333,
            },
            {
              position: 84345.965,
              speed: 83.33333333333333,
            },
            {
              position: 84345.965,
              speed: 83.33333333333333,
            },
            {
              position: 86513.965,
              speed: 83.33333333333333,
            },
            {
              position: 86513.965,
              speed: 83.33333333333333,
            },
            {
              position: 88680.965,
              speed: 83.33333333333333,
            },
            {
              position: 88680.965,
              speed: 83.33333333333333,
            },
            {
              position: 90845.965,
              speed: 83.33333333333333,
            },
            {
              position: 90845.965,
              speed: 83.33333333333333,
            },
            {
              position: 91607.965,
              speed: 83.33333333333333,
            },
            {
              position: 91607.965,
              speed: 83.33333333333333,
            },
            {
              position: 92236.965,
              speed: 83.33333333333333,
            },
            {
              position: 92236.965,
              speed: 83.33333333333333,
            },
            {
              position: 92937.965,
              speed: 83.33333333333333,
            },
            {
              position: 92937.965,
              speed: 83.33333333333333,
            },
            {
              position: 95023.965,
              speed: 83.33333333333333,
            },
            {
              position: 95023.965,
              speed: 83.33333333333333,
            },
            {
              position: 97273.965,
              speed: 83.33333333333333,
            },
            {
              position: 97273.965,
              speed: 83.33333333333333,
            },
            {
              position: 99525.965,
              speed: 83.33333333333333,
            },
            {
              position: 99525.965,
              speed: 83.33333333333333,
            },
            {
              position: 101777.965,
              speed: 83.33333333333333,
            },
            {
              position: 101777.965,
              speed: 83.33333333333333,
            },
            {
              position: 104018.965,
              speed: 83.33333333333333,
            },
            {
              position: 104018.965,
              speed: 83.33333333333333,
            },
            {
              position: 106281.965,
              speed: 83.33333333333333,
            },
            {
              position: 106281.965,
              speed: 83.33333333333333,
            },
            {
              position: 108533.965,
              speed: 83.33333333333333,
            },
            {
              position: 108533.965,
              speed: 83.33333333333333,
            },
            {
              position: 111188.965,
              speed: 83.33333333333333,
            },
            {
              position: 111188.965,
              speed: 83.33333333333333,
            },
            {
              position: 112626.965,
              speed: 83.33333333333333,
            },
            {
              position: 112626.965,
              speed: 83.33333333333333,
            },
            {
              position: 113559.965,
              speed: 83.33333333333333,
            },
            {
              position: 113559.965,
              speed: 83.33333333333333,
            },
            {
              position: 114221.965,
              speed: 83.33333333333333,
            },
            {
              position: 114221.965,
              speed: 83.33333333333333,
            },
            {
              position: 115729.965,
              speed: 83.33333333333333,
            },
            {
              position: 115729.965,
              speed: 83.33333333333333,
            },
            {
              position: 117865.965,
              speed: 83.33333333333333,
            },
            {
              position: 117865.965,
              speed: 83.33333333333333,
            },
            {
              position: 120019.965,
              speed: 83.33333333333333,
            },
            {
              position: 120019.965,
              speed: 83.33333333333333,
            },
            {
              position: 124073.965,
              speed: 83.33333333333333,
            },
            {
              position: 124073.965,
              speed: 83.33333333333333,
            },
            {
              position: 126210.965,
              speed: 83.33333333333333,
            },
            {
              position: 126210.965,
              speed: 83.33333333333333,
            },
            {
              position: 128143.965,
              speed: 83.33333333333333,
            },
            {
              position: 128143.965,
              speed: 83.33333333333333,
            },
            {
              position: 129638.965,
              speed: 83.33333333333333,
            },
            {
              position: 129638.965,
              speed: 83.33333333333333,
            },
            {
              position: 130644.965,
              speed: 83.33333333333333,
            },
            {
              position: 130644.965,
              speed: 83.33333333333333,
            },
            {
              position: 130900.965,
              speed: 83.33333333333333,
            },
            {
              position: 130900.965,
              speed: 83.33333333333333,
            },
            {
              position: 132862.965,
              speed: 83.33333333333333,
            },
            {
              position: 132862.965,
              speed: 83.33333333333333,
            },
            {
              position: 132865.965,
              speed: 83.33333333333333,
            },
            {
              position: 132865.965,
              speed: 83.33333333333333,
            },
            {
              position: 132942.965,
              speed: 83.33333333333333,
            },
            {
              position: 132942.965,
              speed: 83.33333333333333,
            },
            {
              position: 133377.965,
              speed: 83.33333333333333,
            },
            {
              position: 133377.965,
              speed: 83.33333333333333,
            },
            {
              position: 133457.965,
              speed: 83.33333333333333,
            },
            {
              position: 133457.965,
              speed: 83.33333333333333,
            },
            {
              position: 134942.965,
              speed: 83.33333333333333,
            },
            {
              position: 134942.965,
              speed: 83.33333333333333,
            },
            {
              position: 137363.965,
              speed: 83.33333333333333,
            },
            {
              position: 137363.965,
              speed: 83.33333333333333,
            },
            {
              position: 139603.965,
              speed: 83.33333333333333,
            },
            {
              position: 139603.965,
              speed: 83.33333333333333,
            },
            {
              position: 141935.965,
              speed: 83.33333333333333,
            },
            {
              position: 141935.965,
              speed: 83.33333333333333,
            },
            {
              position: 144265.965,
              speed: 83.33333333333333,
            },
            {
              position: 144265.965,
              speed: 83.33333333333333,
            },
            {
              position: 146602.965,
              speed: 83.33333333333333,
            },
            {
              position: 146602.965,
              speed: 83.33333333333333,
            },
            {
              position: 148279.965,
              speed: 83.33333333333333,
            },
            {
              position: 148279.965,
              speed: 83.33333333333333,
            },
            {
              position: 148319.965,
              speed: 83.33333333333333,
            },
            {
              position: 148319.965,
              speed: 83.33333333333333,
            },
            {
              position: 148945.965,
              speed: 83.33333333333333,
            },
            {
              position: 148945.965,
              speed: 83.33333333333333,
            },
            {
              position: 149283.965,
              speed: 83.33333333333333,
            },
            {
              position: 149283.965,
              speed: 83.33333333333333,
            },
            {
              position: 149323.965,
              speed: 83.33333333333333,
            },
            {
              position: 149323.965,
              speed: 83.33333333333333,
            },
            {
              position: 151085.965,
              speed: 83.33333333333333,
            },
            {
              position: 151085.965,
              speed: 83.33333333333333,
            },
            {
              position: 153316.965,
              speed: 83.33333333333333,
            },
            {
              position: 153316.965,
              speed: 83.33333333333333,
            },
            {
              position: 155693.965,
              speed: 83.33333333333333,
            },
            {
              position: 155693.965,
              speed: 83.33333333333333,
            },
            {
              position: 157928.965,
              speed: 83.33333333333333,
            },
            {
              position: 157928.965,
              speed: 83.33333333333333,
            },
            {
              position: 159754.965,
              speed: 83.33333333333333,
            },
            {
              position: 159754.965,
              speed: 83.33333333333333,
            },
            {
              position: 161590.965,
              speed: 83.33333333333333,
            },
            {
              position: 161590.965,
              speed: 83.33333333333333,
            },
            {
              position: 163491.965,
              speed: 83.33333333333333,
            },
            {
              position: 163491.965,
              speed: 83.33333333333333,
            },
            {
              position: 166348.965,
              speed: 83.33333333333333,
            },
            {
              position: 166348.965,
              speed: 83.33333333333333,
            },
            {
              position: 168818.965,
              speed: 83.33333333333333,
            },
            {
              position: 168818.965,
              speed: 83.33333333333333,
            },
            {
              position: 170892.965,
              speed: 83.33333333333333,
            },
            {
              position: 170892.965,
              speed: 83.33333333333333,
            },
            {
              position: 172121.965,
              speed: 83.33333333333333,
            },
            {
              position: 172121.965,
              speed: 83.33333333333333,
            },
            {
              position: 172201.965,
              speed: 83.33333333333333,
            },
            {
              position: 172201.965,
              speed: 83.33333333333333,
            },
            {
              position: 173001.965,
              speed: 83.33333333333333,
            },
            {
              position: 173001.965,
              speed: 83.33333333333333,
            },
            {
              position: 175240.965,
              speed: 83.33333333333333,
            },
            {
              position: 175240.965,
              speed: 83.33333333333333,
            },
            {
              position: 177510.965,
              speed: 83.33333333333333,
            },
            {
              position: 177510.965,
              speed: 83.33333333333333,
            },
            {
              position: 178970.965,
              speed: 83.33333333333333,
            },
            {
              position: 178970.965,
              speed: 83.33333333333333,
            },
            {
              position: 179011.965,
              speed: 83.33333333333333,
            },
            {
              position: 179011.965,
              speed: 61.11111111111111,
            },
            {
              position: 179935.965,
              speed: 61.11111111111111,
            },
            {
              position: 179935.965,
              speed: 61.11111111111111,
            },
            {
              position: 181333.965,
              speed: 61.11111111111111,
            },
            {
              position: 181333.965,
              speed: 61.11111111111111,
            },
            {
              position: 181568.965,
              speed: 61.11111111111111,
            },
            {
              position: 181568.965,
              speed: 61.11111111111111,
            },
            {
              position: 181688.965,
              speed: 61.11111111111111,
            },
            {
              position: 181688.965,
              speed: 61.11111111111111,
            },
            {
              position: 181898.965,
              speed: 61.11111111111111,
            },
            {
              position: 181898.965,
              speed: 61.11111111111111,
            },
            {
              position: 182191.965,
              speed: 61.11111111111111,
            },
            {
              position: 182191.965,
              speed: 61.11111111111111,
            },
            {
              position: 182260.965,
              speed: 61.11111111111111,
            },
            {
              position: 182260.965,
              speed: 61.11111111111111,
            },
            {
              position: 182488.965,
              speed: 61.11111111111111,
            },
            {
              position: 182488.965,
              speed: 61.11111111111111,
            },
            {
              position: 185298.965,
              speed: 61.11111111111111,
            },
            {
              position: 185298.965,
              speed: 61.11111111111111,
            },
            {
              position: 188618.965,
              speed: 61.11111111111111,
            },
            {
              position: 188618.965,
              speed: 61.11111111111111,
            },
            {
              position: 189798.965,
              speed: 61.11111111111111,
            },
            {
              position: 189798.965,
              speed: 61.11111111111111,
            },
            {
              position: 189998.965,
              speed: 61.11111111111111,
            },
            {
              position: 189998.965,
              speed: 61.11111111111111,
            },
            {
              position: 190262.965,
              speed: 61.11111111111111,
            },
            {
              position: 190262.965,
              speed: 61.11111111111111,
            },
            {
              position: 190396.965,
              speed: 61.11111111111111,
            },
            {
              position: 190396.965,
              speed: 61.11111111111111,
            },
            {
              position: 190866.965,
              speed: 61.11111111111111,
            },
            {
              position: 190866.965,
              speed: 61.11111111111111,
            },
            {
              position: 191951.965,
              speed: 61.11111111111111,
            },
            {
              position: 191951.965,
              speed: 61.11111111111111,
            },
            {
              position: 199088.965,
              speed: 61.11111111111111,
            },
            {
              position: 199088.965,
              speed: 61.11111111111111,
            },
            {
              position: 199294.965,
              speed: 61.11111111111111,
            },
            {
              position: 199294.965,
              speed: 61.11111111111111,
            },
            {
              position: 199308.965,
              speed: 61.11111111111111,
            },
            {
              position: 199308.965,
              speed: 61.11111111111111,
            },
            {
              position: 199406.965,
              speed: 61.11111111111111,
            },
            {
              position: 199406.965,
              speed: 38.888888888888886,
            },
            {
              position: 199505.965,
              speed: 38.888888888888886,
            },
            {
              position: 199505.965,
              speed: 44.44444444444444,
            },
            {
              position: 199992.965,
              speed: 44.44444444444444,
            },
            {
              position: 199992.965,
              speed: 44.44444444444444,
            },
            {
              position: 200175.965,
              speed: 44.44444444444444,
            },
            {
              position: 200175.965,
              speed: 44.44444444444444,
            },
            {
              position: 200186.965,
              speed: 44.44444444444444,
            },
            {
              position: 200186.965,
              speed: 44.44444444444444,
            },
            {
              position: 200230.965,
              speed: 44.44444444444444,
            },
            {
              position: 200230.965,
              speed: 44.44444444444444,
            },
            {
              position: 200308.965,
              speed: 44.44444444444444,
            },
            {
              position: 200308.965,
              speed: 27.77777777777778,
            },
            {
              position: 200434.965,
              speed: 27.77777777777778,
            },
            {
              position: 200434.965,
              speed: 27.77777777777778,
            },
            {
              position: 200659.965,
              speed: 27.77777777777778,
            },
            {
              position: 200659.965,
              speed: 27.77777777777778,
            },
            {
              position: 200671.965,
              speed: 27.77777777777778,
            },
            {
              position: 200671.965,
              speed: 27.77777777777778,
            },
            {
              position: 200683.965,
              speed: 27.77777777777778,
            },
            {
              position: 200683.965,
              speed: 27.77777777777778,
            },
            {
              position: 200754.965,
              speed: 27.77777777777778,
            },
            {
              position: 200754.965,
              speed: 27.77777777777778,
            },
            {
              position: 200952.965,
              speed: 27.77777777777778,
            },
            {
              position: 200952.965,
              speed: 27.77777777777778,
            },
            {
              position: 201408.607,
              speed: 27.77777777777778,
            },
          ],
          slopes: [
            {
              gradient: 0,
              position: 0,
            },
            {
              gradient: 0,
              position: 551.965,
            },
            {
              gradient: 7.7,
              position: 551.965,
            },
            {
              gradient: 7.7,
              position: 565.965,
            },
            {
              gradient: 4.1,
              position: 565.965,
            },
            {
              gradient: 4.1,
              position: 637.965,
            },
            {
              gradient: 0,
              position: 637.965,
            },
            {
              gradient: 0,
              position: 802.965,
            },
            {
              gradient: 3.3,
              position: 802.965,
            },
            {
              gradient: 3.3,
              position: 892.965,
            },
            {
              gradient: 0,
              position: 892.965,
            },
            {
              gradient: 0,
              position: 1365.965,
            },
            {
              gradient: 8.4,
              position: 1365.965,
            },
            {
              gradient: 8.4,
              position: 1565.965,
            },
            {
              gradient: 4.2,
              position: 1565.965,
            },
            {
              gradient: 4.2,
              position: 1724.965,
            },
            {
              gradient: 0,
              position: 1724.965,
            },
            {
              gradient: 0,
              position: 1772.965,
            },
            {
              gradient: 5,
              position: 1772.965,
            },
            {
              gradient: 5,
              position: 1905.965,
            },
            {
              gradient: 9.3,
              position: 1905.965,
            },
            {
              gradient: 9.3,
              position: 2015.965,
            },
            {
              gradient: 11.5,
              position: 2015.965,
            },
            {
              gradient: 11.5,
              position: 2487.965,
            },
            {
              gradient: 11.3,
              position: 2487.965,
            },
            {
              gradient: 11.3,
              position: 2776.965,
            },
            {
              gradient: 0,
              position: 2776.965,
            },
            {
              gradient: 0,
              position: 2891.965,
            },
            {
              gradient: 7.1,
              position: 2891.965,
            },
            {
              gradient: 7.1,
              position: 3157.965,
            },
            {
              gradient: 10,
              position: 3157.965,
            },
            {
              gradient: 10,
              position: 3367.965,
            },
            {
              gradient: 0,
              position: 3367.965,
            },
            {
              gradient: 0,
              position: 3494.965,
            },
            {
              gradient: 10,
              position: 3494.965,
            },
            {
              gradient: 10,
              position: 3892.965,
            },
            {
              gradient: 1.1,
              position: 3892.965,
            },
            {
              gradient: 1.1,
              position: 4144.965,
            },
            {
              gradient: 0.4,
              position: 4144.965,
            },
            {
              gradient: 0.4,
              position: 4429.965,
            },
            {
              gradient: 0.9,
              position: 4429.965,
            },
            {
              gradient: 0.9,
              position: 4706.965,
            },
            {
              gradient: 0.3,
              position: 4706.965,
            },
            {
              gradient: 0.3,
              position: 5034.965,
            },
            {
              gradient: 1.1,
              position: 5034.965,
            },
            {
              gradient: 1.1,
              position: 5571.965,
            },
            {
              gradient: 1.6,
              position: 5571.965,
            },
            {
              gradient: 1.6,
              position: 5743.965,
            },
            {
              gradient: 2,
              position: 5743.965,
            },
            {
              gradient: 2,
              position: 5775.965,
            },
            {
              gradient: 0,
              position: 5775.965,
            },
            {
              gradient: 0,
              position: 5993.965,
            },
            {
              gradient: -20,
              position: 5993.965,
            },
            {
              gradient: -20,
              position: 6460.965,
            },
            {
              gradient: 0,
              position: 6460.965,
            },
            {
              gradient: 0,
              position: 6557.965,
            },
            {
              gradient: -25,
              position: 6557.965,
            },
            {
              gradient: -25,
              position: 6991.965,
            },
            {
              gradient: 0,
              position: 6991.965,
            },
            {
              gradient: 0,
              position: 7273.965,
            },
            {
              gradient: 3,
              position: 7273.965,
            },
            {
              gradient: 3,
              position: 7702.965,
            },
            {
              gradient: 0,
              position: 7702.965,
            },
            {
              gradient: 0,
              position: 7920.965,
            },
            {
              gradient: 25,
              position: 7920.965,
            },
            {
              gradient: 25,
              position: 8029.965,
            },
            {
              gradient: 0,
              position: 8029.965,
            },
            {
              gradient: 0,
              position: 8209.965,
            },
            {
              gradient: 7,
              position: 8209.965,
            },
            {
              gradient: 7,
              position: 8331.965,
            },
            {
              gradient: 0,
              position: 8331.965,
            },
            {
              gradient: 0,
              position: 8457.965,
            },
            {
              gradient: 16,
              position: 8457.965,
            },
            {
              gradient: 16,
              position: 8877.965,
            },
            {
              gradient: 0,
              position: 8877.965,
            },
            {
              gradient: 0,
              position: 9189.965,
            },
            {
              gradient: -10,
              position: 9189.965,
            },
            {
              gradient: -10,
              position: 9332.965,
            },
            {
              gradient: 0,
              position: 9332.965,
            },
            {
              gradient: 0,
              position: 9490.965,
            },
            {
              gradient: 3,
              position: 9490.965,
            },
            {
              gradient: 3,
              position: 9782.965,
            },
            {
              gradient: 0,
              position: 9782.965,
            },
            {
              gradient: 0,
              position: 9848.965,
            },
            {
              gradient: 8.5,
              position: 9848.965,
            },
            {
              gradient: 8.5,
              position: 9978.965,
            },
            {
              gradient: 0,
              position: 9978.965,
            },
            {
              gradient: 0,
              position: 10346.965,
            },
            {
              gradient: -14.5,
              position: 10346.965,
            },
            {
              gradient: -14.5,
              position: 10618.965,
            },
            {
              gradient: 0,
              position: 10618.965,
            },
            {
              gradient: 0,
              position: 10690.965,
            },
            {
              gradient: -10,
              position: 10690.965,
            },
            {
              gradient: -10,
              position: 11647.965,
            },
            {
              gradient: 0,
              position: 11647.965,
            },
            {
              gradient: 0,
              position: 11759.965,
            },
            {
              gradient: -3.1,
              position: 11759.965,
            },
            {
              gradient: -3.1,
              position: 12015.965,
            },
            {
              gradient: 0,
              position: 12015.965,
            },
            {
              gradient: 0,
              position: 12115.965,
            },
            {
              gradient: 2,
              position: 12115.965,
            },
            {
              gradient: 2,
              position: 12358.965,
            },
            {
              gradient: 0,
              position: 12358.965,
            },
            {
              gradient: 0,
              position: 12502.965,
            },
            {
              gradient: 14,
              position: 12502.965,
            },
            {
              gradient: 14,
              position: 13084.965,
            },
            {
              gradient: 0,
              position: 13084.965,
            },
            {
              gradient: 0,
              position: 13258.965,
            },
            {
              gradient: -0.5,
              position: 13258.965,
            },
            {
              gradient: -0.5,
              position: 14550.965,
            },
            {
              gradient: 0,
              position: 14550.965,
            },
            {
              gradient: 0,
              position: 14724.965,
            },
            {
              gradient: -15,
              position: 14724.965,
            },
            {
              gradient: -15,
              position: 14886.965,
            },
            {
              gradient: 0,
              position: 14886.965,
            },
            {
              gradient: 0,
              position: 14976.965,
            },
            {
              gradient: -12,
              position: 14976.965,
            },
            {
              gradient: -12,
              position: 15383.965,
            },
            {
              gradient: 0,
              position: 15383.965,
            },
            {
              gradient: 0,
              position: 15479.965,
            },
            {
              gradient: -4,
              position: 15479.965,
            },
            {
              gradient: -4,
              position: 15854.965,
            },
            {
              gradient: 0,
              position: 15854.965,
            },
            {
              gradient: 0,
              position: 15944.965,
            },
            {
              gradient: -1,
              position: 15944.965,
            },
            {
              gradient: -1,
              position: 16126.965,
            },
            {
              gradient: 0,
              position: 16126.965,
            },
            {
              gradient: 0,
              position: 16322.965,
            },
            {
              gradient: 13,
              position: 16322.965,
            },
            {
              gradient: 13,
              position: 16557.965,
            },
            {
              gradient: 0,
              position: 16557.965,
            },
            {
              gradient: 0,
              position: 16637.965,
            },
            {
              gradient: 15,
              position: 16637.965,
            },
            {
              gradient: 15,
              position: 17659.965,
            },
            {
              gradient: 0,
              position: 17659.965,
            },
            {
              gradient: 0,
              position: 17784.965,
            },
            {
              gradient: 20,
              position: 17784.965,
            },
            {
              gradient: 20,
              position: 18035.965,
            },
            {
              gradient: 20.6,
              position: 18035.965,
            },
            {
              gradient: 20.6,
              position: 18135.965,
            },
            {
              gradient: 20,
              position: 18135.965,
            },
            {
              gradient: 20,
              position: 18743.965,
            },
            {
              gradient: 0,
              position: 18743.965,
            },
            {
              gradient: 0,
              position: 19068.965,
            },
            {
              gradient: 7,
              position: 19068.965,
            },
            {
              gradient: 7,
              position: 20600.965,
            },
            {
              gradient: 0,
              position: 20600.965,
            },
            {
              gradient: 0,
              position: 20850.965,
            },
            {
              gradient: -3,
              position: 20850.965,
            },
            {
              gradient: -3,
              position: 23000.965,
            },
            {
              gradient: 0,
              position: 23000.965,
            },
            {
              gradient: 0,
              position: 23080.965,
            },
            {
              gradient: -6.2,
              position: 23080.965,
            },
            {
              gradient: -6.2,
              position: 23311.965,
            },
            {
              gradient: 0,
              position: 23311.965,
            },
            {
              gradient: 0,
              position: 23811.965,
            },
            {
              gradient: 25,
              position: 23811.965,
            },
            {
              gradient: 25,
              position: 24561.965,
            },
            {
              gradient: 0,
              position: 24561.965,
            },
            {
              gradient: 0,
              position: 24831.965,
            },
            {
              gradient: 11.5,
              position: 24831.965,
            },
            {
              gradient: 11.5,
              position: 25494.965,
            },
            {
              gradient: 0,
              position: 25494.965,
            },
            {
              gradient: 0,
              position: 25768.965,
            },
            {
              gradient: 11.5,
              position: 25768.965,
            },
            {
              gradient: 11.5,
              position: 26573.965,
            },
            {
              gradient: 0,
              position: 26573.965,
            },
            {
              gradient: 0,
              position: 26869.965,
            },
            {
              gradient: -7,
              position: 26869.965,
            },
            {
              gradient: -7,
              position: 27033.965,
            },
            {
              gradient: 0,
              position: 27033.965,
            },
            {
              gradient: 0,
              position: 27113.965,
            },
            {
              gradient: -5,
              position: 27113.965,
            },
            {
              gradient: -5,
              position: 27806.965,
            },
            {
              gradient: 0,
              position: 27806.965,
            },
            {
              gradient: 0,
              position: 28046.965,
            },
            {
              gradient: -20,
              position: 28046.965,
            },
            {
              gradient: -20,
              position: 28759.965,
            },
            {
              gradient: 0,
              position: 28759.965,
            },
            {
              gradient: 0,
              position: 28884.965,
            },
            {
              gradient: -25,
              position: 28884.965,
            },
            {
              gradient: -25,
              position: 29483.965,
            },
            {
              gradient: 0,
              position: 29483.965,
            },
            {
              gradient: 0,
              position: 29623.965,
            },
            {
              gradient: -18,
              position: 29623.965,
            },
            {
              gradient: -18,
              position: 30558.965,
            },
            {
              gradient: 0,
              position: 30558.965,
            },
            {
              gradient: 0,
              position: 31508.965,
            },
            {
              gradient: 20,
              position: 31508.965,
            },
            {
              gradient: 20,
              position: 32233.965,
            },
            {
              gradient: 0,
              position: 32233.965,
            },
            {
              gradient: 0,
              position: 32808.965,
            },
            {
              gradient: -3,
              position: 32808.965,
            },
            {
              gradient: -3,
              position: 34958.965,
            },
            {
              gradient: 0,
              position: 34958.965,
            },
            {
              gradient: 0,
              position: 35326.965,
            },
            {
              gradient: 20,
              position: 35326.965,
            },
            {
              gradient: 20,
              position: 35523.965,
            },
            {
              gradient: 0,
              position: 35523.965,
            },
            {
              gradient: 0,
              position: 35603.965,
            },
            {
              gradient: 25,
              position: 35603.965,
            },
            {
              gradient: 25,
              position: 36252.965,
            },
            {
              gradient: 0,
              position: 36252.965,
            },
            {
              gradient: 0,
              position: 37052.965,
            },
            {
              gradient: -25,
              position: 37052.965,
            },
            {
              gradient: -25,
              position: 38579.965,
            },
            {
              gradient: 0,
              position: 38579.965,
            },
            {
              gradient: 0,
              position: 39129.965,
            },
            {
              gradient: -3,
              position: 39129.965,
            },
            {
              gradient: -3,
              position: 39846.965,
            },
            {
              gradient: 0,
              position: 39846.965,
            },
            {
              gradient: 0,
              position: 39946.965,
            },
            {
              gradient: 1,
              position: 39946.965,
            },
            {
              gradient: 1,
              position: 40421.965,
            },
            {
              gradient: 0,
              position: 40421.965,
            },
            {
              gradient: 0,
              position: 40821.965,
            },
            {
              gradient: 17,
              position: 40821.965,
            },
            {
              gradient: 17,
              position: 41905.965,
            },
            {
              gradient: 0,
              position: 41905.965,
            },
            {
              gradient: 0,
              position: 42105.965,
            },
            {
              gradient: 25,
              position: 42105.965,
            },
            {
              gradient: 25,
              position: 42670.965,
            },
            {
              gradient: 0,
              position: 42670.965,
            },
            {
              gradient: 0,
              position: 42895.965,
            },
            {
              gradient: 16,
              position: 42895.965,
            },
            {
              gradient: 16,
              position: 44526.965,
            },
            {
              gradient: 0,
              position: 44526.965,
            },
            {
              gradient: 0,
              position: 45201.965,
            },
            {
              gradient: -11,
              position: 45201.965,
            },
            {
              gradient: -11,
              position: 46232.965,
            },
            {
              gradient: -10,
              position: 46232.965,
            },
            {
              gradient: -10,
              position: 46837.965,
            },
            {
              gradient: 0,
              position: 46837.965,
            },
            {
              gradient: 0,
              position: 47437.965,
            },
            {
              gradient: 14,
              position: 47437.965,
            },
            {
              gradient: 14,
              position: 47904.965,
            },
            {
              gradient: 0,
              position: 47904.965,
            },
            {
              gradient: 0,
              position: 48379.965,
            },
            {
              gradient: -5,
              position: 48379.965,
            },
            {
              gradient: -5,
              position: 48864.965,
            },
            {
              gradient: 0,
              position: 48864.965,
            },
            {
              gradient: 0,
              position: 49014.965,
            },
            {
              gradient: 1,
              position: 49014.965,
            },
            {
              gradient: 1,
              position: 50045.965,
            },
            {
              gradient: 0,
              position: 50045.965,
            },
            {
              gradient: 0,
              position: 50255.965,
            },
            {
              gradient: 16,
              position: 50255.965,
            },
            {
              gradient: 16,
              position: 50435.965,
            },
            {
              gradient: 0,
              position: 50435.965,
            },
            {
              gradient: 0,
              position: 50931.965,
            },
            {
              gradient: -15,
              position: 50931.965,
            },
            {
              gradient: -15,
              position: 51445.965,
            },
            {
              gradient: 0,
              position: 51445.965,
            },
            {
              gradient: 0,
              position: 51669.965,
            },
            {
              gradient: 1,
              position: 51669.965,
            },
            {
              gradient: 1,
              position: 55391.965,
            },
            {
              gradient: 2,
              position: 55391.965,
            },
            {
              gradient: 2,
              position: 56425.965,
            },
            {
              gradient: 0,
              position: 56425.965,
            },
            {
              gradient: 0,
              position: 56510.965,
            },
            {
              gradient: -1.4,
              position: 56510.965,
            },
            {
              gradient: -1.4,
              position: 58009.965,
            },
            {
              gradient: 0,
              position: 58009.965,
            },
            {
              gradient: 0,
              position: 58162.965,
            },
            {
              gradient: -7.6,
              position: 58162.965,
            },
            {
              gradient: -7.6,
              position: 58733.965,
            },
            {
              gradient: 0,
              position: 58733.965,
            },
            {
              gradient: 0,
              position: 58885.965,
            },
            {
              gradient: -1.5,
              position: 58885.965,
            },
            {
              gradient: -1.5,
              position: 59237.965,
            },
            {
              gradient: 0,
              position: 59237.965,
            },
            {
              gradient: 0,
              position: 59312.965,
            },
            {
              gradient: 1.5,
              position: 59312.965,
            },
            {
              gradient: 1.5,
              position: 59689.965,
            },
            {
              gradient: 0,
              position: 59689.965,
            },
            {
              gradient: 0,
              position: 59777.965,
            },
            {
              gradient: -2,
              position: 59777.965,
            },
            {
              gradient: -2,
              position: 61117.965,
            },
            {
              gradient: 0,
              position: 61117.965,
            },
            {
              gradient: 0,
              position: 61442.965,
            },
            {
              gradient: -15,
              position: 61442.965,
            },
            {
              gradient: -15,
              position: 61589.965,
            },
            {
              gradient: 0,
              position: 61589.965,
            },
            {
              gradient: 0,
              position: 61814.965,
            },
            {
              gradient: -6,
              position: 61814.965,
            },
            {
              gradient: -6,
              position: 62096.965,
            },
            {
              gradient: 0,
              position: 62096.965,
            },
            {
              gradient: 0,
              position: 62346.965,
            },
            {
              gradient: 4,
              position: 62346.965,
            },
            {
              gradient: 4,
              position: 62507.965,
            },
            {
              gradient: 0,
              position: 62507.965,
            },
            {
              gradient: 0,
              position: 62745.965,
            },
            {
              gradient: 13.5,
              position: 62745.965,
            },
            {
              gradient: 13.5,
              position: 62865.965,
            },
            {
              gradient: 0,
              position: 62865.965,
            },
            {
              gradient: 0,
              position: 63077.965,
            },
            {
              gradient: 5,
              position: 63077.965,
            },
            {
              gradient: 5,
              position: 65498.965,
            },
            {
              gradient: 0,
              position: 65498.965,
            },
            {
              gradient: 0,
              position: 65648.965,
            },
            {
              gradient: -1,
              position: 65648.965,
            },
            {
              gradient: -1,
              position: 66069.965,
            },
            {
              gradient: 0,
              position: 66069.965,
            },
            {
              gradient: 0,
              position: 66344.965,
            },
            {
              gradient: -1,
              position: 66344.965,
            },
            {
              gradient: -1,
              position: 66384.965,
            },
            {
              gradient: 0,
              position: 66384.965,
            },
            {
              gradient: 0,
              position: 67349.965,
            },
            {
              gradient: -1,
              position: 67349.965,
            },
            {
              gradient: -1,
              position: 67389.965,
            },
            {
              gradient: 0,
              position: 67389.965,
            },
            {
              gradient: 0,
              position: 67664.965,
            },
            {
              gradient: -1,
              position: 67664.965,
            },
            {
              gradient: -1,
              position: 67993.965,
            },
            {
              gradient: 0,
              position: 67993.965,
            },
            {
              gradient: 0,
              position: 68193.965,
            },
            {
              gradient: -9,
              position: 68193.965,
            },
            {
              gradient: -9,
              position: 68577.965,
            },
            {
              gradient: 0,
              position: 68577.965,
            },
            {
              gradient: 0,
              position: 68702.965,
            },
            {
              gradient: -4,
              position: 68702.965,
            },
            {
              gradient: -4,
              position: 69075.965,
            },
            {
              gradient: 0,
              position: 69075.965,
            },
            {
              gradient: 0,
              position: 69337.965,
            },
            {
              gradient: 6.5,
              position: 69337.965,
            },
            {
              gradient: 6.5,
              position: 69709.965,
            },
            {
              gradient: 0,
              position: 69709.965,
            },
            {
              gradient: 0,
              position: 69971.965,
            },
            {
              gradient: -4,
              position: 69971.965,
            },
            {
              gradient: -4,
              position: 70131.965,
            },
            {
              gradient: 0,
              position: 70131.965,
            },
            {
              gradient: 0,
              position: 70269.965,
            },
            {
              gradient: 1.5,
              position: 70269.965,
            },
            {
              gradient: 1.5,
              position: 70625.965,
            },
            {
              gradient: 0,
              position: 70625.965,
            },
            {
              gradient: 0,
              position: 70765.965,
            },
            {
              gradient: -2,
              position: 70765.965,
            },
            {
              gradient: -2,
              position: 71235.965,
            },
            {
              gradient: 0,
              position: 71235.965,
            },
            {
              gradient: 0,
              position: 71435.965,
            },
            {
              gradient: 3,
              position: 71435.965,
            },
            {
              gradient: 3,
              position: 72930.965,
            },
            {
              gradient: 0,
              position: 72930.965,
            },
            {
              gradient: 0,
              position: 73110.965,
            },
            {
              gradient: -1.5,
              position: 73110.965,
            },
            {
              gradient: -1.5,
              position: 73784.965,
            },
            {
              gradient: 0,
              position: 73784.965,
            },
            {
              gradient: 0,
              position: 73904.965,
            },
            {
              gradient: 1.5,
              position: 73904.965,
            },
            {
              gradient: 1.5,
              position: 74459.965,
            },
            {
              gradient: 0,
              position: 74459.965,
            },
            {
              gradient: 0,
              position: 74619.965,
            },
            {
              gradient: -2.5,
              position: 74619.965,
            },
            {
              gradient: -2.5,
              position: 76032.965,
            },
            {
              gradient: 0,
              position: 76032.965,
            },
            {
              gradient: 0,
              position: 76212.965,
            },
            {
              gradient: 2,
              position: 76212.965,
            },
            {
              gradient: 2,
              position: 76752.965,
            },
            {
              gradient: 0,
              position: 76752.965,
            },
            {
              gradient: 0,
              position: 76912.965,
            },
            {
              gradient: -2,
              position: 76912.965,
            },
            {
              gradient: -2,
              position: 77266.965,
            },
            {
              gradient: 0,
              position: 77266.965,
            },
            {
              gradient: 0,
              position: 77426.965,
            },
            {
              gradient: 2,
              position: 77426.965,
            },
            {
              gradient: 2,
              position: 77800.965,
            },
            {
              gradient: 0,
              position: 77800.965,
            },
            {
              gradient: 0,
              position: 77920.965,
            },
            {
              gradient: -1,
              position: 77920.965,
            },
            {
              gradient: -1,
              position: 78737.965,
            },
            {
              gradient: 0,
              position: 78737.965,
            },
            {
              gradient: 0,
              position: 78777.965,
            },
            {
              gradient: -2,
              position: 78777.965,
            },
            {
              gradient: -2,
              position: 80953.965,
            },
            {
              gradient: 0,
              position: 80953.965,
            },
            {
              gradient: 0,
              position: 81203.965,
            },
            {
              gradient: 8,
              position: 81203.965,
            },
            {
              gradient: 8,
              position: 81906.965,
            },
            {
              gradient: 0,
              position: 81906.965,
            },
            {
              gradient: 0,
              position: 82810.965,
            },
            {
              gradient: -10,
              position: 82810.965,
            },
            {
              gradient: -10,
              position: 83352.965,
            },
            {
              gradient: 0,
              position: 83352.965,
            },
            {
              gradient: 0,
              position: 83794.965,
            },
            {
              gradient: 7.7,
              position: 83794.965,
            },
            {
              gradient: 7.7,
              position: 84792.965,
            },
            {
              gradient: 0,
              position: 84792.965,
            },
            {
              gradient: 0,
              position: 85034.965,
            },
            {
              gradient: -2,
              position: 85034.965,
            },
            {
              gradient: -2,
              position: 86877.965,
            },
            {
              gradient: 0,
              position: 86877.965,
            },
            {
              gradient: 0,
              position: 86997.965,
            },
            {
              gradient: -5,
              position: 86997.965,
            },
            {
              gradient: -5,
              position: 87809.965,
            },
            {
              gradient: 0,
              position: 87809.965,
            },
            {
              gradient: 0,
              position: 88089.965,
            },
            {
              gradient: 2,
              position: 88089.965,
            },
            {
              gradient: 2,
              position: 88589.965,
            },
            {
              gradient: 0,
              position: 88589.965,
            },
            {
              gradient: 0,
              position: 88749.965,
            },
            {
              gradient: -2,
              position: 88749.965,
            },
            {
              gradient: -2,
              position: 89005.965,
            },
            {
              gradient: 0,
              position: 89005.965,
            },
            {
              gradient: 0,
              position: 89065.965,
            },
            {
              gradient: -0.5,
              position: 89065.965,
            },
            {
              gradient: -0.5,
              position: 90087.965,
            },
            {
              gradient: 0,
              position: 90087.965,
            },
            {
              gradient: 0,
              position: 90335.965,
            },
            {
              gradient: 5.7,
              position: 90335.965,
            },
            {
              gradient: 5.7,
              position: 90845.965,
            },
            {
              gradient: 0,
              position: 90845.965,
            },
            {
              gradient: 0,
              position: 91215.965,
            },
            {
              gradient: -5,
              position: 91215.965,
            },
            {
              gradient: -5,
              position: 92361.965,
            },
            {
              gradient: 0,
              position: 92361.965,
            },
            {
              gradient: 0,
              position: 92598.965,
            },
            {
              gradient: 4.5,
              position: 92598.965,
            },
            {
              gradient: 4.5,
              position: 92886.965,
            },
            {
              gradient: 0,
              position: 92886.965,
            },
            {
              gradient: 0,
              position: 93073.965,
            },
            {
              gradient: -3,
              position: 93073.965,
            },
            {
              gradient: -3,
              position: 93439.965,
            },
            {
              gradient: 0,
              position: 93439.965,
            },
            {
              gradient: 0,
              position: 93719.965,
            },
            {
              gradient: 4,
              position: 93719.965,
            },
            {
              gradient: 4,
              position: 94304.965,
            },
            {
              gradient: 0,
              position: 94304.965,
            },
            {
              gradient: 0,
              position: 94504.965,
            },
            {
              gradient: -4,
              position: 94504.965,
            },
            {
              gradient: -4,
              position: 95828.965,
            },
            {
              gradient: 0,
              position: 95828.965,
            },
            {
              gradient: 0,
              position: 95953.965,
            },
            {
              gradient: 1,
              position: 95953.965,
            },
            {
              gradient: 1,
              position: 96910.965,
            },
            {
              gradient: 0,
              position: 96910.965,
            },
            {
              gradient: 0,
              position: 97110.965,
            },
            {
              gradient: 6,
              position: 97110.965,
            },
            {
              gradient: 6,
              position: 97483.965,
            },
            {
              gradient: 0,
              position: 97483.965,
            },
            {
              gradient: 0,
              position: 97758.965,
            },
            {
              gradient: -5,
              position: 97758.965,
            },
            {
              gradient: -5,
              position: 98540.965,
            },
            {
              gradient: 0,
              position: 98540.965,
            },
            {
              gradient: 0,
              position: 99141.965,
            },
            {
              gradient: -2.5,
              position: 99141.965,
            },
            {
              gradient: -2.5,
              position: 99731.965,
            },
            {
              gradient: 0,
              position: 99731.965,
            },
            {
              gradient: 0,
              position: 99951.965,
            },
            {
              gradient: 3,
              position: 99951.965,
            },
            {
              gradient: 3,
              position: 100554.965,
            },
            {
              gradient: 0,
              position: 100554.965,
            },
            {
              gradient: 0,
              position: 101022.965,
            },
            {
              gradient: -4,
              position: 101022.965,
            },
            {
              gradient: -4,
              position: 101391.965,
            },
            {
              gradient: 0,
              position: 101391.965,
            },
            {
              gradient: 0,
              position: 101471.965,
            },
            {
              gradient: -2,
              position: 101471.965,
            },
            {
              gradient: -2,
              position: 103763.965,
            },
            {
              gradient: 0,
              position: 103763.965,
            },
            {
              gradient: 0,
              position: 104025.965,
            },
            {
              gradient: 8.5,
              position: 104025.965,
            },
            {
              gradient: 8.5,
              position: 104327.965,
            },
            {
              gradient: 0,
              position: 104327.965,
            },
            {
              gradient: 0,
              position: 104827.965,
            },
            {
              gradient: -11.5,
              position: 104827.965,
            },
            {
              gradient: -11.5,
              position: 105048.965,
            },
            {
              gradient: 0,
              position: 105048.965,
            },
            {
              gradient: 0,
              position: 105286.965,
            },
            {
              gradient: -2,
              position: 105286.965,
            },
            {
              gradient: -2,
              position: 106852.965,
            },
            {
              gradient: 0,
              position: 106852.965,
            },
            {
              gradient: 0,
              position: 107127.965,
            },
            {
              gradient: 9,
              position: 107127.965,
            },
            {
              gradient: 9,
              position: 108119.965,
            },
            {
              gradient: 0,
              position: 108119.965,
            },
            {
              gradient: 0,
              position: 108294.965,
            },
            {
              gradient: 2,
              position: 108294.965,
            },
            {
              gradient: 2,
              position: 108562.965,
            },
            {
              gradient: 0,
              position: 108562.965,
            },
            {
              gradient: 0,
              position: 108787.965,
            },
            {
              gradient: 11,
              position: 108787.965,
            },
            {
              gradient: 11,
              position: 109810.965,
            },
            {
              gradient: 0,
              position: 109810.965,
            },
            {
              gradient: 0,
              position: 110035.965,
            },
            {
              gradient: 20,
              position: 110035.965,
            },
            {
              gradient: 20,
              position: 110958.965,
            },
            {
              gradient: 0,
              position: 110958.965,
            },
            {
              gradient: 0,
              position: 111508.965,
            },
            {
              gradient: -2,
              position: 111508.965,
            },
            {
              gradient: -2,
              position: 112521.965,
            },
            {
              gradient: -1,
              position: 112521.965,
            },
            {
              gradient: -1,
              position: 114320.965,
            },
            {
              gradient: 0,
              position: 114320.965,
            },
            {
              gradient: 0,
              position: 114520.965,
            },
            {
              gradient: -9,
              position: 114520.965,
            },
            {
              gradient: -9,
              position: 115000.965,
            },
            {
              gradient: 0,
              position: 115000.965,
            },
            {
              gradient: 0,
              position: 115150.965,
            },
            {
              gradient: -3,
              position: 115150.965,
            },
            {
              gradient: -3,
              position: 115335.965,
            },
            {
              gradient: 0,
              position: 115335.965,
            },
            {
              gradient: 0,
              position: 115825.965,
            },
            {
              gradient: 2,
              position: 115825.965,
            },
            {
              gradient: 2,
              position: 115997.965,
            },
            {
              gradient: 0,
              position: 115997.965,
            },
            {
              gradient: 0,
              position: 116147.965,
            },
            {
              gradient: -4,
              position: 116147.965,
            },
            {
              gradient: -4,
              position: 116491.965,
            },
            {
              gradient: 0,
              position: 116491.965,
            },
            {
              gradient: 0,
              position: 116691.965,
            },
            {
              gradient: 4,
              position: 116691.965,
            },
            {
              gradient: 4,
              position: 117119.965,
            },
            {
              gradient: 0,
              position: 117119.965,
            },
            {
              gradient: 0,
              position: 117269.965,
            },
            {
              gradient: -2,
              position: 117269.965,
            },
            {
              gradient: -2,
              position: 118651.965,
            },
            {
              gradient: 0,
              position: 118651.965,
            },
            {
              gradient: 0,
              position: 118751.965,
            },
            {
              gradient: 2,
              position: 118751.965,
            },
            {
              gradient: 2,
              position: 119642.965,
            },
            {
              gradient: 0,
              position: 119642.965,
            },
            {
              gradient: 0,
              position: 119742.965,
            },
            {
              gradient: -2,
              position: 119742.965,
            },
            {
              gradient: -2,
              position: 120276.965,
            },
            {
              gradient: 0,
              position: 120276.965,
            },
            {
              gradient: 0,
              position: 120451.965,
            },
            {
              gradient: -9,
              position: 120451.965,
            },
            {
              gradient: -9,
              position: 120968.965,
            },
            {
              gradient: 0,
              position: 120968.965,
            },
            {
              gradient: 0,
              position: 121243.965,
            },
            {
              gradient: 2,
              position: 121243.965,
            },
            {
              gradient: 2,
              position: 122529.965,
            },
            {
              gradient: 0,
              position: 122529.965,
            },
            {
              gradient: 0,
              position: 122654.965,
            },
            {
              gradient: -3,
              position: 122654.965,
            },
            {
              gradient: -3,
              position: 123012.965,
            },
            {
              gradient: 0,
              position: 123012.965,
            },
            {
              gradient: 0,
              position: 123152.965,
            },
            {
              gradient: -6.5,
              position: 123152.965,
            },
            {
              gradient: -6.5,
              position: 123577.965,
            },
            {
              gradient: 0,
              position: 123577.965,
            },
            {
              gradient: 0,
              position: 123789.965,
            },
            {
              gradient: 2,
              position: 123789.965,
            },
            {
              gradient: 2,
              position: 124578.965,
            },
            {
              gradient: 0,
              position: 124578.965,
            },
            {
              gradient: 0,
              position: 124753.965,
            },
            {
              gradient: -5,
              position: 124753.965,
            },
            {
              gradient: -5,
              position: 125412.965,
            },
            {
              gradient: -4,
              position: 125412.965,
            },
            {
              gradient: -4,
              position: 126287.965,
            },
            {
              gradient: 0,
              position: 126287.965,
            },
            {
              gradient: 0,
              position: 126537.965,
            },
            {
              gradient: 6,
              position: 126537.965,
            },
            {
              gradient: 6,
              position: 126751.965,
            },
            {
              gradient: 7,
              position: 126751.965,
            },
            {
              gradient: 7,
              position: 127135.965,
            },
            {
              gradient: 8,
              position: 127135.965,
            },
            {
              gradient: 8,
              position: 127652.965,
            },
            {
              gradient: 0,
              position: 127652.965,
            },
            {
              gradient: 0,
              position: 128452.965,
            },
            {
              gradient: -24,
              position: 128452.965,
            },
            {
              gradient: -24,
              position: 128625.965,
            },
            {
              gradient: 0,
              position: 128625.965,
            },
            {
              gradient: 0,
              position: 129431.965,
            },
            {
              gradient: 7.5,
              position: 129431.965,
            },
            {
              gradient: 7.5,
              position: 130675.965,
            },
            {
              gradient: 6.5,
              position: 130675.965,
            },
            {
              gradient: 6.5,
              position: 130900.965,
            },
            {
              gradient: 0,
              position: 130900.965,
            },
            {
              gradient: 0,
              position: 130902.965,
            },
            {
              gradient: -2,
              position: 130902.965,
            },
            {
              gradient: -2,
              position: 131626.965,
            },
            {
              gradient: 0,
              position: 131626.965,
            },
            {
              gradient: 0,
              position: 131826.965,
            },
            {
              gradient: 3,
              position: 131826.965,
            },
            {
              gradient: 3,
              position: 132297.965,
            },
            {
              gradient: 0,
              position: 132297.965,
            },
            {
              gradient: 0,
              position: 132447.965,
            },
            {
              gradient: -3,
              position: 132447.965,
            },
            {
              gradient: -3,
              position: 132861.965,
            },
            {
              gradient: 0,
              position: 132861.965,
            },
            {
              gradient: 0,
              position: 133931.965,
            },
            {
              gradient: 2,
              position: 133931.965,
            },
            {
              gradient: 2,
              position: 134706.965,
            },
            {
              gradient: 0,
              position: 134706.965,
            },
            {
              gradient: 0,
              position: 134856.965,
            },
            {
              gradient: 8,
              position: 134856.965,
            },
            {
              gradient: 8,
              position: 135340.965,
            },
            {
              gradient: 0,
              position: 135340.965,
            },
            {
              gradient: 0,
              position: 135765.965,
            },
            {
              gradient: 25,
              position: 135765.965,
            },
            {
              gradient: 25,
              position: 136318.965,
            },
            {
              gradient: 0,
              position: 136318.965,
            },
            {
              gradient: 0,
              position: 137058.965,
            },
            {
              gradient: -12,
              position: 137058.965,
            },
            {
              gradient: -12,
              position: 137501.965,
            },
            {
              gradient: 0,
              position: 137501.965,
            },
            {
              gradient: 0,
              position: 138161.965,
            },
            {
              gradient: 6,
              position: 138161.965,
            },
            {
              gradient: 6,
              position: 138952.965,
            },
            {
              gradient: 0,
              position: 138952.965,
            },
            {
              gradient: 0,
              position: 139152.965,
            },
            {
              gradient: -2,
              position: 139152.965,
            },
            {
              gradient: -2,
              position: 140294.965,
            },
            {
              gradient: 0,
              position: 140294.965,
            },
            {
              gradient: 0,
              position: 140374.965,
            },
            {
              gradient: -4,
              position: 140374.965,
            },
            {
              gradient: -4,
              position: 140699.965,
            },
            {
              gradient: 0,
              position: 140699.965,
            },
            {
              gradient: 0,
              position: 140849.965,
            },
            {
              gradient: 2,
              position: 140849.965,
            },
            {
              gradient: 2,
              position: 141637.965,
            },
            {
              gradient: 0,
              position: 141637.965,
            },
            {
              gradient: 0,
              position: 141797.965,
            },
            {
              gradient: -2,
              position: 141797.965,
            },
            {
              gradient: -2,
              position: 142241.965,
            },
            {
              gradient: 0,
              position: 142241.965,
            },
            {
              gradient: 0,
              position: 142566.965,
            },
            {
              gradient: -15,
              position: 142566.965,
            },
            {
              gradient: -15,
              position: 143079.965,
            },
            {
              gradient: 0,
              position: 143079.965,
            },
            {
              gradient: 0,
              position: 143404.965,
            },
            {
              gradient: -2,
              position: 143404.965,
            },
            {
              gradient: -2,
              position: 144116.965,
            },
            {
              gradient: 0,
              position: 144116.965,
            },
            {
              gradient: 0,
              position: 144241.965,
            },
            {
              gradient: 3,
              position: 144241.965,
            },
            {
              gradient: 3,
              position: 145182.965,
            },
            {
              gradient: 0,
              position: 145182.965,
            },
            {
              gradient: 0,
              position: 145307.965,
            },
            {
              gradient: -2,
              position: 145307.965,
            },
            {
              gradient: -2,
              position: 146320.965,
            },
            {
              gradient: -1,
              position: 146320.965,
            },
            {
              gradient: -1,
              position: 146935.965,
            },
            {
              gradient: 0,
              position: 146935.965,
            },
            {
              gradient: 0,
              position: 146972.965,
            },
            {
              gradient: 0.5,
              position: 146972.965,
            },
            {
              gradient: 0.5,
              position: 147328.965,
            },
            {
              gradient: 0,
              position: 147328.965,
            },
            {
              gradient: 0,
              position: 147416.965,
            },
            {
              gradient: -3,
              position: 147416.965,
            },
            {
              gradient: -3,
              position: 147661.965,
            },
            {
              gradient: 0,
              position: 147661.965,
            },
            {
              gradient: 0,
              position: 147711.965,
            },
            {
              gradient: -1,
              position: 147711.965,
            },
            {
              gradient: -1,
              position: 149697.965,
            },
            {
              gradient: 0,
              position: 149697.965,
            },
            {
              gradient: 0,
              position: 149772.965,
            },
            {
              gradient: -4,
              position: 149772.965,
            },
            {
              gradient: -4,
              position: 150943.965,
            },
            {
              gradient: 0,
              position: 150943.965,
            },
            {
              gradient: 0,
              position: 151093.965,
            },
            {
              gradient: 2,
              position: 151093.965,
            },
            {
              gradient: 2,
              position: 151951.965,
            },
            {
              gradient: 0,
              position: 151951.965,
            },
            {
              gradient: 0,
              position: 152226.965,
            },
            {
              gradient: -9,
              position: 152226.965,
            },
            {
              gradient: -9,
              position: 153832.965,
            },
            {
              gradient: 0,
              position: 153832.965,
            },
            {
              gradient: 0,
              position: 153932.965,
            },
            {
              gradient: -11.5,
              position: 153932.965,
            },
            {
              gradient: -11.5,
              position: 154657.965,
            },
            {
              gradient: 0,
              position: 154657.965,
            },
            {
              gradient: 0,
              position: 154757.965,
            },
            {
              gradient: -7.5,
              position: 154757.965,
            },
            {
              gradient: -7.5,
              position: 155637.965,
            },
            {
              gradient: 0,
              position: 155637.965,
            },
            {
              gradient: 0,
              position: 155737.965,
            },
            {
              gradient: -5,
              position: 155737.965,
            },
            {
              gradient: -5,
              position: 156477.965,
            },
            {
              gradient: -6,
              position: 156477.965,
            },
            {
              gradient: -6,
              position: 157691.965,
            },
            {
              gradient: 0,
              position: 157691.965,
            },
            {
              gradient: 0,
              position: 159021.965,
            },
            {
              gradient: 20,
              position: 159021.965,
            },
            {
              gradient: 20,
              position: 159410.965,
            },
            {
              gradient: 0,
              position: 159410.965,
            },
            {
              gradient: 0,
              position: 159810.965,
            },
            {
              gradient: 4,
              position: 159810.965,
            },
            {
              gradient: 4,
              position: 160851.965,
            },
            {
              gradient: 0,
              position: 160851.965,
            },
            {
              gradient: 0,
              position: 161251.965,
            },
            {
              gradient: 20,
              position: 161251.965,
            },
            {
              gradient: 20,
              position: 161867.965,
            },
            {
              gradient: 0,
              position: 161867.965,
            },
            {
              gradient: 0,
              position: 162492.965,
            },
            {
              gradient: -5,
              position: 162492.965,
            },
            {
              gradient: -5,
              position: 162623.965,
            },
            {
              gradient: 0,
              position: 162623.965,
            },
            {
              gradient: 0,
              position: 162898.965,
            },
            {
              gradient: 6,
              position: 162898.965,
            },
            {
              gradient: 6,
              position: 163712.965,
            },
            {
              gradient: 0,
              position: 163712.965,
            },
            {
              gradient: 0,
              position: 164487.965,
            },
            {
              gradient: -25,
              position: 164487.965,
            },
            {
              gradient: -25,
              position: 166000.965,
            },
            {
              gradient: 0,
              position: 166000.965,
            },
            {
              gradient: 0,
              position: 166400.965,
            },
            {
              gradient: -9,
              position: 166400.965,
            },
            {
              gradient: -9,
              position: 167129.965,
            },
            {
              gradient: 0,
              position: 167129.965,
            },
            {
              gradient: 0,
              position: 167259.965,
            },
            {
              gradient: -14.6,
              position: 167259.965,
            },
            {
              gradient: -14.6,
              position: 168027.965,
            },
            {
              gradient: 0,
              position: 168027.965,
            },
            {
              gradient: 0,
              position: 168280.965,
            },
            {
              gradient: -4.5,
              position: 168280.965,
            },
            {
              gradient: -4.5,
              position: 169671.965,
            },
            {
              gradient: 0,
              position: 169671.965,
            },
            {
              gradient: 0,
              position: 169883.965,
            },
            {
              gradient: 4,
              position: 169883.965,
            },
            {
              gradient: 4,
              position: 171156.965,
            },
            {
              gradient: 0,
              position: 171156.965,
            },
            {
              gradient: 0,
              position: 171306.965,
            },
            {
              gradient: -2,
              position: 171306.965,
            },
            {
              gradient: -2,
              position: 172575.965,
            },
            {
              gradient: 0,
              position: 172575.965,
            },
            {
              gradient: 0,
              position: 172850.965,
            },
            {
              gradient: -13,
              position: 172850.965,
            },
            {
              gradient: -13,
              position: 174001.965,
            },
            {
              gradient: 0,
              position: 174001.965,
            },
            {
              gradient: 0,
              position: 174376.965,
            },
            {
              gradient: 2,
              position: 174376.965,
            },
            {
              gradient: 2,
              position: 175037.965,
            },
            {
              gradient: 0,
              position: 175037.965,
            },
            {
              gradient: 0,
              position: 175412.965,
            },
            {
              gradient: 17,
              position: 175412.965,
            },
            {
              gradient: 17,
              position: 176014.965,
            },
            {
              gradient: 0,
              position: 176014.965,
            },
            {
              gradient: 0,
              position: 176489.965,
            },
            {
              gradient: -2,
              position: 176489.965,
            },
            {
              gradient: -2,
              position: 177767.965,
            },
            {
              gradient: 0,
              position: 177767.965,
            },
            {
              gradient: 0,
              position: 178055.965,
            },
            {
              gradient: -20,
              position: 178055.965,
            },
            {
              gradient: -20,
              position: 178435.965,
            },
            {
              gradient: 0,
              position: 178435.965,
            },
            {
              gradient: 0,
              position: 178563.965,
            },
            {
              gradient: -12,
              position: 178563.965,
            },
            {
              gradient: -12,
              position: 178970.965,
            },
            {
              gradient: 0,
              position: 178970.965,
            },
            {
              gradient: 0,
              position: 179011.965,
            },
            {
              gradient: -12,
              position: 179011.965,
            },
            {
              gradient: -12,
              position: 179377.965,
            },
            {
              gradient: 0,
              position: 179377.965,
            },
            {
              gradient: 0,
              position: 179999.965,
            },
            {
              gradient: -2.1,
              position: 179999.965,
            },
            {
              gradient: -2.1,
              position: 180716.965,
            },
            {
              gradient: -1.8,
              position: 180716.965,
            },
            {
              gradient: -1.8,
              position: 181037.965,
            },
            {
              gradient: -2.1,
              position: 181037.965,
            },
            {
              gradient: -2.1,
              position: 181538.965,
            },
            {
              gradient: -1.5,
              position: 181538.965,
            },
            {
              gradient: -1.5,
              position: 181688.965,
            },
            {
              gradient: 0,
              position: 181688.965,
            },
            {
              gradient: 0,
              position: 181898.965,
            },
            {
              gradient: -1.5,
              position: 181898.965,
            },
            {
              gradient: -1.5,
              position: 182088.965,
            },
            {
              gradient: 0.2,
              position: 182088.965,
            },
            {
              gradient: 0.2,
              position: 182138.965,
            },
            {
              gradient: -0.2,
              position: 182138.965,
            },
            {
              gradient: -0.2,
              position: 182260.965,
            },
            {
              gradient: 0,
              position: 182260.965,
            },
            {
              gradient: 0,
              position: 182488.965,
            },
            {
              gradient: 0.2,
              position: 182488.965,
            },
            {
              gradient: 0.2,
              position: 182538.965,
            },
            {
              gradient: 0,
              position: 182538.965,
            },
            {
              gradient: 0,
              position: 182638.965,
            },
            {
              gradient: 0.4,
              position: 182638.965,
            },
            {
              gradient: 0.4,
              position: 182888.965,
            },
            {
              gradient: -0.4,
              position: 182888.965,
            },
            {
              gradient: -0.4,
              position: 182938.965,
            },
            {
              gradient: -1.7,
              position: 182938.965,
            },
            {
              gradient: -1.7,
              position: 184438.965,
            },
            {
              gradient: -1.2,
              position: 184438.965,
            },
            {
              gradient: -1.2,
              position: 184788.965,
            },
            {
              gradient: -2.4,
              position: 184788.965,
            },
            {
              gradient: -2.4,
              position: 184888.965,
            },
            {
              gradient: -1.3,
              position: 184888.965,
            },
            {
              gradient: -1.3,
              position: 186338.965,
            },
            {
              gradient: 0,
              position: 186338.965,
            },
            {
              gradient: 0,
              position: 186438.965,
            },
            {
              gradient: -0.2,
              position: 186438.965,
            },
            {
              gradient: -0.2,
              position: 186538.965,
            },
            {
              gradient: 0,
              position: 186538.965,
            },
            {
              gradient: 0,
              position: 186638.965,
            },
            {
              gradient: -0.3,
              position: 186638.965,
            },
            {
              gradient: -0.3,
              position: 187088.965,
            },
            {
              gradient: 0.9,
              position: 187088.965,
            },
            {
              gradient: 0.9,
              position: 189188.965,
            },
            {
              gradient: 2.2,
              position: 189188.965,
            },
            {
              gradient: 2.2,
              position: 189888.965,
            },
            {
              gradient: 1.6,
              position: 189888.965,
            },
            {
              gradient: 1.6,
              position: 190038.965,
            },
            {
              gradient: 0,
              position: 190038.965,
            },
            {
              gradient: 0,
              position: 190138.965,
            },
            {
              gradient: 0.4,
              position: 190138.965,
            },
            {
              gradient: 0.4,
              position: 190188.965,
            },
            {
              gradient: -0.6,
              position: 190188.965,
            },
            {
              gradient: -0.6,
              position: 190388.965,
            },
            {
              gradient: 0,
              position: 190388.965,
            },
            {
              gradient: 0,
              position: 190488.965,
            },
            {
              gradient: 0.5,
              position: 190488.965,
            },
            {
              gradient: 0.5,
              position: 190588.965,
            },
            {
              gradient: -0.5,
              position: 190588.965,
            },
            {
              gradient: -0.5,
              position: 190688.965,
            },
            {
              gradient: 0.2,
              position: 190688.965,
            },
            {
              gradient: 0.2,
              position: 190888.965,
            },
            {
              gradient: -0.2,
              position: 190888.965,
            },
            {
              gradient: -0.2,
              position: 191038.965,
            },
            {
              gradient: 0,
              position: 191038.965,
            },
            {
              gradient: 0,
              position: 191138.965,
            },
            {
              gradient: -0.2,
              position: 191138.965,
            },
            {
              gradient: -0.2,
              position: 191238.965,
            },
            {
              gradient: 0.1,
              position: 191238.965,
            },
            {
              gradient: 0.1,
              position: 191338.965,
            },
            {
              gradient: -0.9,
              position: 191338.965,
            },
            {
              gradient: -0.9,
              position: 192588.965,
            },
            {
              gradient: -3.1,
              position: 192588.965,
            },
            {
              gradient: -3.1,
              position: 192838.965,
            },
            {
              gradient: -4.1,
              position: 192838.965,
            },
            {
              gradient: -4.1,
              position: 193288.965,
            },
            {
              gradient: -3.2,
              position: 193288.965,
            },
            {
              gradient: -3.2,
              position: 193438.965,
            },
            {
              gradient: -4.8,
              position: 193438.965,
            },
            {
              gradient: -4.8,
              position: 193488.965,
            },
            {
              gradient: -3.1,
              position: 193488.965,
            },
            {
              gradient: -3.1,
              position: 194388.965,
            },
            {
              gradient: -2.8,
              position: 194388.965,
            },
            {
              gradient: -2.8,
              position: 194938.965,
            },
            {
              gradient: -0.8,
              position: 194938.965,
            },
            {
              gradient: -0.8,
              position: 195288.965,
            },
            {
              gradient: 0,
              position: 195288.965,
            },
            {
              gradient: 0,
              position: 195838.965,
            },
            {
              gradient: -0.2,
              position: 195838.965,
            },
            {
              gradient: -0.2,
              position: 196288.965,
            },
            {
              gradient: -1.8,
              position: 196288.965,
            },
            {
              gradient: -1.8,
              position: 197388.965,
            },
            {
              gradient: -1.7,
              position: 197388.965,
            },
            {
              gradient: -1.7,
              position: 197758.965,
            },
            {
              gradient: -0.5,
              position: 197758.965,
            },
            {
              gradient: -0.5,
              position: 197913.965,
            },
            {
              gradient: -2.6,
              position: 197913.965,
            },
            {
              gradient: -2.6,
              position: 198127.965,
            },
            {
              gradient: -1.5,
              position: 198127.965,
            },
            {
              gradient: -1.5,
              position: 198288.965,
            },
            {
              gradient: -1.4,
              position: 198288.965,
            },
            {
              gradient: -1.4,
              position: 199438.965,
            },
            {
              gradient: -2.4,
              position: 199438.965,
            },
            {
              gradient: -2.4,
              position: 199488.965,
            },
            {
              gradient: -1.3,
              position: 199488.965,
            },
            {
              gradient: -1.3,
              position: 199838.965,
            },
            {
              gradient: 0.6,
              position: 199838.965,
            },
            {
              gradient: 0.6,
              position: 199888.965,
            },
            {
              gradient: 2.9,
              position: 199888.965,
            },
            {
              gradient: 2.9,
              position: 199988.965,
            },
            {
              gradient: 5.5,
              position: 199988.965,
            },
            {
              gradient: 5.5,
              position: 200288.965,
            },
            {
              gradient: 3.8,
              position: 200288.965,
            },
            {
              gradient: 3.8,
              position: 200338.965,
            },
            {
              gradient: 1,
              position: 200338.965,
            },
            {
              gradient: 1,
              position: 200388.965,
            },
            {
              gradient: -0.8,
              position: 200388.965,
            },
            {
              gradient: -0.8,
              position: 200488.965,
            },
            {
              gradient: -2.4,
              position: 200488.965,
            },
            {
              gradient: -2.4,
              position: 200588.965,
            },
            {
              gradient: -1.3,
              position: 200588.965,
            },
            {
              gradient: -1.3,
              position: 200688.965,
            },
            {
              gradient: 2,
              position: 200688.965,
            },
            {
              gradient: 2,
              position: 200754.965,
            },
            {
              gradient: 0,
              position: 200754.965,
            },
            {
              gradient: 0,
              position: 201408.607,
            },
          ],
          curves: [
            {
              radius: -526,
              position: 0,
            },
            {
              radius: -526,
              position: 115.965,
            },
            {
              radius: 806,
              position: 115.965,
            },
            {
              radius: 806,
              position: 175.965,
            },
            {
              radius: -8333,
              position: 175.965,
            },
            {
              radius: -8333,
              position: 255.965,
            },
            {
              radius: 776,
              position: 255.965,
            },
            {
              radius: 776,
              position: 335.965,
            },
            {
              radius: 485,
              position: 335.965,
            },
            {
              radius: 485,
              position: 394.965,
            },
            {
              radius: 1500,
              position: 394.965,
            },
            {
              radius: 1500,
              position: 395.965,
            },
            {
              radius: 0,
              position: 395.965,
            },
            {
              radius: 0,
              position: 1772.965,
            },
            {
              radius: -10000,
              position: 1772.965,
            },
            {
              radius: -10000,
              position: 2015.965,
            },
            {
              radius: -1162,
              position: 2015.965,
            },
            {
              radius: -1162,
              position: 2195.965,
            },
            {
              radius: 1612,
              position: 2195.965,
            },
            {
              radius: 1612,
              position: 2395.965,
            },
            {
              radius: 757,
              position: 2395.965,
            },
            {
              radius: 757,
              position: 2795.965,
            },
            {
              radius: 552,
              position: 2795.965,
            },
            {
              radius: 552,
              position: 2975.965,
            },
            {
              radius: 466,
              position: 2975.965,
            },
            {
              radius: 466,
              position: 3275.965,
            },
            {
              radius: 0,
              position: 3275.965,
            },
            {
              radius: 0,
              position: 3674.965,
            },
            {
              radius: -840,
              position: 3674.965,
            },
            {
              radius: -840,
              position: 4555.965,
            },
            {
              radius: -2941,
              position: 4555.965,
            },
            {
              radius: -2941,
              position: 5014.965,
            },
            {
              radius: 0,
              position: 5014.965,
            },
            {
              radius: 0,
              position: 5655.965,
            },
            {
              radius: 1639,
              position: 5655.965,
            },
            {
              radius: 1639,
              position: 6269.965,
            },
            {
              radius: -1650,
              position: 6269.965,
            },
            {
              radius: -1650,
              position: 6789.965,
            },
            {
              radius: 1650,
              position: 6789.965,
            },
            {
              radius: 1650,
              position: 7478.965,
            },
            {
              radius: 0,
              position: 7478.965,
            },
            {
              radius: 0,
              position: 8061.965,
            },
            {
              radius: 6000,
              position: 8061.965,
            },
            {
              radius: 6000,
              position: 8855.965,
            },
            {
              radius: 0,
              position: 8855.965,
            },
            {
              radius: 0,
              position: 9584.965,
            },
            {
              radius: -2900,
              position: 9584.965,
            },
            {
              radius: -2900,
              position: 10833.965,
            },
            {
              radius: 0,
              position: 10833.965,
            },
            {
              radius: 0,
              position: 11776.965,
            },
            {
              radius: 10000,
              position: 11776.965,
            },
            {
              radius: 10000,
              position: 11984.965,
            },
            {
              radius: 0,
              position: 11984.965,
            },
            {
              radius: 0,
              position: 12607.965,
            },
            {
              radius: -1600,
              position: 12607.965,
            },
            {
              radius: -1600,
              position: 13309.965,
            },
            {
              radius: 0,
              position: 13309.965,
            },
            {
              radius: 0,
              position: 14150.965,
            },
            {
              radius: 1600,
              position: 14150.965,
            },
            {
              radius: 1600,
              position: 15179.965,
            },
            {
              radius: 0,
              position: 15179.965,
            },
            {
              radius: 0,
              position: 15289.965,
            },
            {
              radius: -5000,
              position: 15289.965,
            },
            {
              radius: -5000,
              position: 15572.965,
            },
            {
              radius: 0,
              position: 15572.965,
            },
            {
              radius: 0,
              position: 15700.965,
            },
            {
              radius: 7000,
              position: 15700.965,
            },
            {
              radius: 7000,
              position: 16105.965,
            },
            {
              radius: 0,
              position: 16105.965,
            },
            {
              radius: 0,
              position: 16324.965,
            },
            {
              radius: -4000,
              position: 16324.965,
            },
            {
              radius: -4000,
              position: 17587.965,
            },
            {
              radius: -6000,
              position: 17587.965,
            },
            {
              radius: -6000,
              position: 18038.965,
            },
            {
              radius: -3500,
              position: 18038.965,
            },
            {
              radius: -3500,
              position: 19747.965,
            },
            {
              radius: 0,
              position: 19747.965,
            },
            {
              radius: 0,
              position: 21601.965,
            },
            {
              radius: 5000,
              position: 21601.965,
            },
            {
              radius: 5000,
              position: 23495.965,
            },
            {
              radius: 0,
              position: 23495.965,
            },
            {
              radius: 0,
              position: 23724.965,
            },
            {
              radius: -4545,
              position: 23724.965,
            },
            {
              radius: -4545,
              position: 24903.965,
            },
            {
              radius: 0,
              position: 24903.965,
            },
            {
              radius: 0,
              position: 26540.965,
            },
            {
              radius: 4000,
              position: 26540.965,
            },
            {
              radius: 4000,
              position: 28316.965,
            },
            {
              radius: -4000,
              position: 28316.965,
            },
            {
              radius: -4000,
              position: 31892.965,
            },
            {
              radius: 15000,
              position: 31892.965,
            },
            {
              radius: 15000,
              position: 33016.965,
            },
            {
              radius: 0,
              position: 33016.965,
            },
            {
              radius: 0,
              position: 34674.965,
            },
            {
              radius: 4545,
              position: 34674.965,
            },
            {
              radius: 4545,
              position: 36341.965,
            },
            {
              radius: -5000,
              position: 36341.965,
            },
            {
              radius: -5000,
              position: 37443.965,
            },
            {
              radius: 0,
              position: 37443.965,
            },
            {
              radius: 0,
              position: 38123.965,
            },
            {
              radius: 4545,
              position: 38123.965,
            },
            {
              radius: 4545,
              position: 39399.965,
            },
            {
              radius: -15000,
              position: 39399.965,
            },
            {
              radius: -15000,
              position: 40032.965,
            },
            {
              radius: 0,
              position: 40032.965,
            },
            {
              radius: 0,
              position: 40980.965,
            },
            {
              radius: -4545,
              position: 40980.965,
            },
            {
              radius: -4545,
              position: 43171.965,
            },
            {
              radius: 0,
              position: 43171.965,
            },
            {
              radius: 0,
              position: 44133.965,
            },
            {
              radius: 4167,
              position: 44133.965,
            },
            {
              radius: 4167,
              position: 48823.965,
            },
            {
              radius: 0,
              position: 48823.965,
            },
            {
              radius: 0,
              position: 51393.965,
            },
            {
              radius: -5000,
              position: 51393.965,
            },
            {
              radius: -5000,
              position: 55280.965,
            },
            {
              radius: 0,
              position: 55280.965,
            },
            {
              radius: 0,
              position: 57696.965,
            },
            {
              radius: -5000,
              position: 57696.965,
            },
            {
              radius: -5000,
              position: 59157.965,
            },
            {
              radius: 0,
              position: 59157.965,
            },
            {
              radius: 0,
              position: 59393.965,
            },
            {
              radius: 4545,
              position: 59393.965,
            },
            {
              radius: 4545,
              position: 62101.965,
            },
            {
              radius: 0,
              position: 62101.965,
            },
            {
              radius: 0,
              position: 62358.965,
            },
            {
              radius: -8000,
              position: 62358.965,
            },
            {
              radius: -8000,
              position: 63365.965,
            },
            {
              radius: 0,
              position: 63365.965,
            },
            {
              radius: 0,
              position: 63709.965,
            },
            {
              radius: 5000,
              position: 63709.965,
            },
            {
              radius: 5000,
              position: 65478.965,
            },
            {
              radius: 0,
              position: 65478.965,
            },
            {
              radius: 0,
              position: 69016.965,
            },
            {
              radius: 25000,
              position: 69016.965,
            },
            {
              radius: 25000,
              position: 69411.965,
            },
            {
              radius: -6250,
              position: 69411.965,
            },
            {
              radius: -6250,
              position: 70558.965,
            },
            {
              radius: 25000,
              position: 70558.965,
            },
            {
              radius: 25000,
              position: 70956.965,
            },
            {
              radius: 0,
              position: 70956.965,
            },
            {
              radius: 0,
              position: 74164.965,
            },
            {
              radius: 6250,
              position: 74164.965,
            },
            {
              radius: 6250,
              position: 75638.965,
            },
            {
              radius: 0,
              position: 75638.965,
            },
            {
              radius: 0,
              position: 81197.965,
            },
            {
              radius: -6500,
              position: 81197.965,
            },
            {
              radius: -6500,
              position: 84749.965,
            },
            {
              radius: 0,
              position: 84749.965,
            },
            {
              radius: 0,
              position: 85031.965,
            },
            {
              radius: 6500,
              position: 85031.965,
            },
            {
              radius: 6500,
              position: 86842.965,
            },
            {
              radius: 0,
              position: 86842.965,
            },
            {
              radius: 0,
              position: 87119.965,
            },
            {
              radius: -6250,
              position: 87119.965,
            },
            {
              radius: -6250,
              position: 90744.965,
            },
            {
              radius: 11111,
              position: 90744.965,
            },
            {
              radius: 11111,
              position: 91408.965,
            },
            {
              radius: 0,
              position: 91408.965,
            },
            {
              radius: 0,
              position: 93745.965,
            },
            {
              radius: 10000,
              position: 93745.965,
            },
            {
              radius: 10000,
              position: 94307.965,
            },
            {
              radius: 0,
              position: 94307.965,
            },
            {
              radius: 0,
              position: 94504.965,
            },
            {
              radius: -10000,
              position: 94504.965,
            },
            {
              radius: -10000,
              position: 95436.965,
            },
            {
              radius: 0,
              position: 95436.965,
            },
            {
              radius: 0,
              position: 95637.965,
            },
            {
              radius: 10000,
              position: 95637.965,
            },
            {
              radius: 10000,
              position: 96200.965,
            },
            {
              radius: 0,
              position: 96200.965,
            },
            {
              radius: 0,
              position: 99319.965,
            },
            {
              radius: -12500,
              position: 99319.965,
            },
            {
              radius: -12500,
              position: 99732.965,
            },
            {
              radius: 0,
              position: 99732.965,
            },
            {
              radius: 0,
              position: 100039.965,
            },
            {
              radius: 6667,
              position: 100039.965,
            },
            {
              radius: 6667,
              position: 101946.965,
            },
            {
              radius: 0,
              position: 101946.965,
            },
            {
              radius: 0,
              position: 102235.965,
            },
            {
              radius: -8333,
              position: 102235.965,
            },
            {
              radius: -8333,
              position: 104273.965,
            },
            {
              radius: 0,
              position: 104273.965,
            },
            {
              radius: 0,
              position: 106094.965,
            },
            {
              radius: -10000,
              position: 106094.965,
            },
            {
              radius: -10000,
              position: 108031.965,
            },
            {
              radius: 0,
              position: 108031.965,
            },
            {
              radius: 0,
              position: 108953.965,
            },
            {
              radius: 8333,
              position: 108953.965,
            },
            {
              radius: 8333,
              position: 112428.965,
            },
            {
              radius: 0,
              position: 112428.965,
            },
            {
              radius: 0,
              position: 115455.965,
            },
            {
              radius: -6000,
              position: 115455.965,
            },
            {
              radius: -6000,
              position: 117031.965,
            },
            {
              radius: 0,
              position: 117031.965,
            },
            {
              radius: 0,
              position: 117352.965,
            },
            {
              radius: 6000,
              position: 117352.965,
            },
            {
              radius: 6000,
              position: 120148.965,
            },
            {
              radius: 0,
              position: 120148.965,
            },
            {
              radius: 0,
              position: 120501.965,
            },
            {
              radius: -7143,
              position: 120501.965,
            },
            {
              radius: -7143,
              position: 121598.965,
            },
            {
              radius: 0,
              position: 121598.965,
            },
            {
              radius: 0,
              position: 122000.965,
            },
            {
              radius: 5000,
              position: 122000.965,
            },
            {
              radius: 5000,
              position: 124041.965,
            },
            {
              radius: 0,
              position: 124041.965,
            },
            {
              radius: 0,
              position: 124240.965,
            },
            {
              radius: -4545,
              position: 124240.965,
            },
            {
              radius: -4545,
              position: 127136.965,
            },
            {
              radius: 0,
              position: 127136.965,
            },
            {
              radius: 0,
              position: 129102.965,
            },
            {
              radius: -12500,
              position: 129102.965,
            },
            {
              radius: -12500,
              position: 129459.965,
            },
            {
              radius: 0,
              position: 129459.965,
            },
            {
              radius: 0,
              position: 129976.965,
            },
            {
              radius: 6502,
              position: 129976.965,
            },
            {
              radius: 6502,
              position: 130900.965,
            },
            {
              radius: -2500,
              position: 130900.965,
            },
            {
              radius: -2500,
              position: 131317.965,
            },
            {
              radius: 0,
              position: 131317.965,
            },
            {
              radius: 0,
              position: 132002.965,
            },
            {
              radius: 6250,
              position: 132002.965,
            },
            {
              radius: 6250,
              position: 132857.965,
            },
            {
              radius: 0,
              position: 132857.965,
            },
            {
              radius: 0,
              position: 133941.965,
            },
            {
              radius: -8333,
              position: 133941.965,
            },
            {
              radius: -8333,
              position: 138009.965,
            },
            {
              radius: 0,
              position: 138009.965,
            },
            {
              radius: 0,
              position: 139242.965,
            },
            {
              radius: 15000,
              position: 139242.965,
            },
            {
              radius: 15000,
              position: 140193.965,
            },
            {
              radius: 0,
              position: 140193.965,
            },
            {
              radius: 0,
              position: 140480.965,
            },
            {
              radius: -8333,
              position: 140480.965,
            },
            {
              radius: -8333,
              position: 142068.965,
            },
            {
              radius: 0,
              position: 142068.965,
            },
            {
              radius: 0,
              position: 143300.965,
            },
            {
              radius: -12500,
              position: 143300.965,
            },
            {
              radius: -12500,
              position: 143957.965,
            },
            {
              radius: 0,
              position: 143957.965,
            },
            {
              radius: 0,
              position: 144260.965,
            },
            {
              radius: 6250,
              position: 144260.965,
            },
            {
              radius: 6250,
              position: 146799.965,
            },
            {
              radius: 0,
              position: 146799.965,
            },
            {
              radius: 0,
              position: 147104.965,
            },
            {
              radius: -10000,
              position: 147104.965,
            },
            {
              radius: -10000,
              position: 147913.965,
            },
            {
              radius: 0,
              position: 147913.965,
            },
            {
              radius: 0,
              position: 149775.965,
            },
            {
              radius: 7143,
              position: 149775.965,
            },
            {
              radius: 7143,
              position: 151356.965,
            },
            {
              radius: 0,
              position: 151356.965,
            },
            {
              radius: 0,
              position: 151664.965,
            },
            {
              radius: -7143,
              position: 151664.965,
            },
            {
              radius: -7143,
              position: 153145.965,
            },
            {
              radius: 0,
              position: 153145.965,
            },
            {
              radius: 0,
              position: 154343.965,
            },
            {
              radius: -6250,
              position: 154343.965,
            },
            {
              radius: -6250,
              position: 155609.965,
            },
            {
              radius: 0,
              position: 155609.965,
            },
            {
              radius: 0,
              position: 155961.965,
            },
            {
              radius: 6250,
              position: 155961.965,
            },
            {
              radius: 6250,
              position: 157886.965,
            },
            {
              radius: 0,
              position: 157886.965,
            },
            {
              radius: 0,
              position: 159965.965,
            },
            {
              radius: 6250,
              position: 159965.965,
            },
            {
              radius: 6250,
              position: 161606.965,
            },
            {
              radius: 0,
              position: 161606.965,
            },
            {
              radius: 0,
              position: 161972.965,
            },
            {
              radius: -6250,
              position: 161972.965,
            },
            {
              radius: -6250,
              position: 163420.965,
            },
            {
              radius: 0,
              position: 163420.965,
            },
            {
              radius: 0,
              position: 163772.965,
            },
            {
              radius: 6250,
              position: 163772.965,
            },
            {
              radius: 6250,
              position: 164672.965,
            },
            {
              radius: 10000,
              position: 164672.965,
            },
            {
              radius: 10000,
              position: 165843.965,
            },
            {
              radius: 8333,
              position: 165843.965,
            },
            {
              radius: 8333,
              position: 167675.965,
            },
            {
              radius: 0,
              position: 167675.965,
            },
            {
              radius: 0,
              position: 168386.965,
            },
            {
              radius: -6250,
              position: 168386.965,
            },
            {
              radius: -6250,
              position: 171749.965,
            },
            {
              radius: 0,
              position: 171749.965,
            },
            {
              radius: 0,
              position: 172983.965,
            },
            {
              radius: -8333,
              position: 172983.965,
            },
            {
              radius: -8333,
              position: 173889.965,
            },
            {
              radius: 0,
              position: 173889.965,
            },
            {
              radius: 0,
              position: 175737.965,
            },
            {
              radius: -6250,
              position: 175737.965,
            },
            {
              radius: -6250,
              position: 178343.965,
            },
            {
              radius: 0,
              position: 178343.965,
            },
            {
              radius: 0,
              position: 179011.965,
            },
            {
              radius: 10000,
              position: 179011.965,
            },
            {
              radius: 10000,
              position: 179182.965,
            },
            {
              radius: 0,
              position: 179182.965,
            },
            {
              radius: 0,
              position: 179329.965,
            },
            {
              radius: 2000,
              position: 179329.965,
            },
            {
              radius: 2000,
              position: 181333.965,
            },
            {
              radius: 0,
              position: 181333.965,
            },
            {
              radius: 0,
              position: 192928.965,
            },
            {
              radius: -1818,
              position: 192928.965,
            },
            {
              radius: -1818,
              position: 193888.965,
            },
            {
              radius: 0,
              position: 193888.965,
            },
            {
              radius: 0,
              position: 194738.965,
            },
            {
              radius: 1852,
              position: 194738.965,
            },
            {
              radius: 1852,
              position: 195718.965,
            },
            {
              radius: 0,
              position: 195718.965,
            },
            {
              radius: 0,
              position: 199478.965,
            },
            {
              radius: -1220,
              position: 199478.965,
            },
            {
              radius: -1220,
              position: 199918.965,
            },
            {
              radius: -990,
              position: 199918.965,
            },
            {
              radius: -990,
              position: 200188.965,
            },
            {
              radius: -909,
              position: 200188.965,
            },
            {
              radius: -909,
              position: 200388.965,
            },
            {
              radius: 0,
              position: 200388.965,
            },
            {
              radius: 0,
              position: 201108.965,
            },
            {
              radius: -885,
              position: 201108.965,
            },
            {
              radius: -885,
              position: 201408.607,
            },
          ],
          base: {
            head_positions: [
              [
                {
                  time: 51300,
                  position: 0,
                },
                {
                  time: 51308,
                  position: 15.087681652230287,
                },
                {
                  time: 51316,
                  position: 59.95650969166121,
                },
                {
                  time: 51324,
                  position: 134.0825421380268,
                },
                {
                  time: 51332,
                  position: 236.98839247875625,
                },
                {
                  time: 51417.49827720566,
                  position: 1660.9650000000001,
                },
                {
                  time: 51423.49827720566,
                  position: 1767.7780072292762,
                },
                {
                  time: 51431.49827720566,
                  position: 1930.6174571559138,
                },
                {
                  time: 51441.49827720566,
                  position: 2161.1275570966345,
                },
                {
                  time: 51451.49827720566,
                  position: 2413.0298284954642,
                },
                {
                  time: 51463.49827720566,
                  position: 2738.1398383195615,
                },
                {
                  time: 51477.75174569455,
                  position: 3145.965,
                },
                {
                  time: 51502.43174569455,
                  position: 3770.858012400591,
                },
                {
                  time: 51516.43174569455,
                  position: 4156.964371844142,
                },
                {
                  time: 51526.43174569455,
                  position: 4459.229607497612,
                },
                {
                  time: 51538.43174569455,
                  position: 4850.376521303067,
                },
                {
                  time: 51550.43174569455,
                  position: 5270.281282169671,
                },
                {
                  time: 51562.43174569455,
                  position: 5716.242002875245,
                },
                {
                  time: 51572.43174569455,
                  position: 6106.035980221415,
                },
                {
                  time: 51580.43174569455,
                  position: 6435.579634345027,
                },
                {
                  time: 51590.43174569455,
                  position: 6868.595781383138,
                },
                {
                  time: 51616.43174569455,
                  position: 8020.071253348365,
                },
                {
                  time: 51644.43174569455,
                  position: 9210.531491201365,
                },
                {
                  time: 51650.43174569455,
                  position: 9484.128166707702,
                },
                {
                  time: 51656.43174569455,
                  position: 9771.392110422634,
                },
                {
                  time: 51664.43174569455,
                  position: 10172.427180640114,
                },
                {
                  time: 51670.43174569455,
                  position: 10486.693547932831,
                },
                {
                  time: 51759.935124907905,
                  position: 15453.965,
                },
                {
                  time: 51765.935124907905,
                  position: 15793.311759016024,
                },
                {
                  time: 51771.935124907905,
                  position: 16143.99757989964,
                },
                {
                  time: 51781.935124907905,
                  position: 16748.723176299554,
                },
                {
                  time: 51791.935124907905,
                  position: 17368.41050165773,
                },
                {
                  time: 51813.935124907905,
                  position: 18766.6763033138,
                },
                {
                  time: 51821.935124907905,
                  position: 19286.141310948067,
                },
                {
                  time: 51829.935124907905,
                  position: 19816.618864989814,
                },
                {
                  time: 51845.935124907905,
                  position: 20905.824840111123,
                },
                {
                  time: 51853.935124907905,
                  position: 21467.64995775713,
                },
                {
                  time: 51863.935124907905,
                  position: 22189.116288063826,
                },
                {
                  time: 51871.935124907905,
                  position: 22780.758499968604,
                },
                {
                  time: 51881.935124907905,
                  position: 23537.4561097713,
                },
                {
                  time: 51907.935124907905,
                  position: 25538.497935155963,
                },
                {
                  time: 51923.935124907905,
                  position: 26785.73730604492,
                },
                {
                  time: 51935.935124907905,
                  position: 27738.84707111232,
                },
                {
                  time: 51945.935124907905,
                  position: 28553.034185602537,
                },
                {
                  time: 52102.05770487142,
                  position: 41549.750324835055,
                },
                {
                  time: 52149.79815316909,
                  position: 45487.18384380568,
                },
                {
                  time: 52364.9010873366,
                  position: 63412.01822058594,
                },
                {
                  time: 52372.9010873366,
                  position: 64070.69104510256,
                },
                {
                  time: 52390.9010873366,
                  position: 65534.839081862076,
                },
                {
                  time: 52402.9010873366,
                  position: 66525.77093593446,
                },
                {
                  time: 52725.283525107196,
                  position: 93390.965,
                },
                {
                  time: 52752.84637979722,
                  position: 95661.12432035248,
                },
                {
                  time: 53179.282189231584,
                  position: 131190.965,
                },
                {
                  time: 53205.282189231584,
                  position: 133333.25559366634,
                },
                {
                  time: 53248.88092429429,
                  position: 136961.33569717835,
                },
                {
                  time: 53713.887332933846,
                  position: 175708.57652478074,
                },
                {
                  time: 53720.25390236885,
                  position: 176228.74277777784,
                },
                {
                  time: 53726.25390236885,
                  position: 176700.4094444445,
                },
                {
                  time: 53734.25390236885,
                  position: 177301.29833333337,
                },
                {
                  time: 53742.25390236885,
                  position: 177870.18722222224,
                },
                {
                  time: 53750.25390236885,
                  position: 178407.07611111112,
                },
                {
                  time: 53758.25390236885,
                  position: 178911.965,
                },
                {
                  time: 53778.48299327795,
                  position: 180147.2705093627,
                },
                {
                  time: 53792.48299327795,
                  position: 180991.56898009698,
                },
                {
                  time: 53806.48299327795,
                  position: 181823.81089114814,
                },
                {
                  time: 53830.48299327795,
                  position: 183234.1939976445,
                },
                {
                  time: 53850.48299327795,
                  position: 184435.50229204967,
                },
                {
                  time: 54057.92652920042,
                  position: 197111.8538888888,
                },
                {
                  time: 54065.92652920042,
                  position: 197582.96499999994,
                },
                {
                  time: 54069.92652920042,
                  position: 197806.5205555555,
                },
                {
                  time: 54075.92652920042,
                  position: 198126.85388888884,
                },
                {
                  time: 54083.92652920042,
                  position: 198525.96499999997,
                },
                {
                  time: 54091.92652920042,
                  position: 198893.0761111111,
                },
                {
                  time: 54099.92652920042,
                  position: 199228.18722222222,
                },
                {
                  time: 54110.29541808931,
                  position: 199627.96499999994,
                },
                {
                  time: 54116.29541808931,
                  position: 199839.63166666662,
                },
                {
                  time: 54124.29541808931,
                  position: 200093.85388888887,
                },
                {
                  time: 54147.26030786709,
                  position: 200732.607,
                },
                {
                  time: 54153.26030786709,
                  position: 200879.607,
                },
                {
                  time: 54159.26030786709,
                  position: 201008.607,
                },
                {
                  time: 54165.26030786709,
                  position: 201119.607,
                },
                {
                  time: 54173.26030786709,
                  position: 201239.607,
                },
                {
                  time: 54179.26030786709,
                  position: 201308.607,
                },
                {
                  time: 54187.26030786709,
                  position: 201372.607,
                },
                {
                  time: 54193.26030786709,
                  position: 201399.607,
                },
                {
                  time: 54200.26030786709,
                  position: 201408.607,
                },
              ],
            ],
            tail_positions: [
              [
                {
                  time: 51300,
                  position: 0,
                },
                {
                  time: 51308,
                  position: 0,
                },
                {
                  time: 51316,
                  position: 0,
                },
                {
                  time: 51324,
                  position: 0,
                },
                {
                  time: 51332,
                  position: 36.98839247875625,
                },
                {
                  time: 51417.49827720566,
                  position: 1460.9650000000001,
                },
                {
                  time: 51423.49827720566,
                  position: 1567.7780072292762,
                },
                {
                  time: 51431.49827720566,
                  position: 1730.6174571559138,
                },
                {
                  time: 51441.49827720566,
                  position: 1961.1275570966345,
                },
                {
                  time: 51451.49827720566,
                  position: 2213.0298284954642,
                },
                {
                  time: 51463.49827720566,
                  position: 2538.1398383195615,
                },
                {
                  time: 51477.75174569455,
                  position: 2945.965,
                },
                {
                  time: 51502.43174569455,
                  position: 3570.858012400591,
                },
                {
                  time: 51516.43174569455,
                  position: 3956.964371844142,
                },
                {
                  time: 51526.43174569455,
                  position: 4259.229607497612,
                },
                {
                  time: 51538.43174569455,
                  position: 4650.376521303067,
                },
                {
                  time: 51550.43174569455,
                  position: 5070.281282169671,
                },
                {
                  time: 51562.43174569455,
                  position: 5516.242002875245,
                },
                {
                  time: 51572.43174569455,
                  position: 5906.035980221415,
                },
                {
                  time: 51580.43174569455,
                  position: 6235.579634345027,
                },
                {
                  time: 51590.43174569455,
                  position: 6668.595781383138,
                },
                {
                  time: 51616.43174569455,
                  position: 7820.071253348365,
                },
                {
                  time: 51644.43174569455,
                  position: 9010.531491201365,
                },
                {
                  time: 51650.43174569455,
                  position: 9284.128166707702,
                },
                {
                  time: 51656.43174569455,
                  position: 9571.392110422634,
                },
                {
                  time: 51664.43174569455,
                  position: 9972.427180640114,
                },
                {
                  time: 51670.43174569455,
                  position: 10286.693547932831,
                },
                {
                  time: 51759.935124907905,
                  position: 15253.965,
                },
                {
                  time: 51765.935124907905,
                  position: 15593.311759016024,
                },
                {
                  time: 51771.935124907905,
                  position: 15943.99757989964,
                },
                {
                  time: 51781.935124907905,
                  position: 16548.723176299554,
                },
                {
                  time: 51791.935124907905,
                  position: 17168.41050165773,
                },
                {
                  time: 51813.935124907905,
                  position: 18566.6763033138,
                },
                {
                  time: 51821.935124907905,
                  position: 19086.141310948067,
                },
                {
                  time: 51829.935124907905,
                  position: 19616.618864989814,
                },
                {
                  time: 51845.935124907905,
                  position: 20705.824840111123,
                },
                {
                  time: 51853.935124907905,
                  position: 21267.64995775713,
                },
                {
                  time: 51863.935124907905,
                  position: 21989.116288063826,
                },
                {
                  time: 51871.935124907905,
                  position: 22580.758499968604,
                },
                {
                  time: 51881.935124907905,
                  position: 23337.4561097713,
                },
                {
                  time: 51907.935124907905,
                  position: 25338.497935155963,
                },
                {
                  time: 51923.935124907905,
                  position: 26585.73730604492,
                },
                {
                  time: 51935.935124907905,
                  position: 27538.84707111232,
                },
                {
                  time: 51945.935124907905,
                  position: 28353.034185602537,
                },
                {
                  time: 52102.05770487142,
                  position: 41349.750324835055,
                },
                {
                  time: 52149.79815316909,
                  position: 45287.18384380568,
                },
                {
                  time: 52364.9010873366,
                  position: 63212.01822058594,
                },
                {
                  time: 52372.9010873366,
                  position: 63870.69104510256,
                },
                {
                  time: 52390.9010873366,
                  position: 65334.839081862076,
                },
                {
                  time: 52402.9010873366,
                  position: 66325.77093593446,
                },
                {
                  time: 52725.283525107196,
                  position: 93190.965,
                },
                {
                  time: 52752.84637979722,
                  position: 95461.12432035248,
                },
                {
                  time: 53179.282189231584,
                  position: 130990.965,
                },
                {
                  time: 53205.282189231584,
                  position: 133133.25559366634,
                },
                {
                  time: 53248.88092429429,
                  position: 136761.33569717835,
                },
                {
                  time: 53713.887332933846,
                  position: 175508.57652478074,
                },
                {
                  time: 53720.25390236885,
                  position: 176028.74277777784,
                },
                {
                  time: 53726.25390236885,
                  position: 176500.4094444445,
                },
                {
                  time: 53734.25390236885,
                  position: 177101.29833333337,
                },
                {
                  time: 53742.25390236885,
                  position: 177670.18722222224,
                },
                {
                  time: 53750.25390236885,
                  position: 178207.07611111112,
                },
                {
                  time: 53758.25390236885,
                  position: 178711.965,
                },
                {
                  time: 53778.48299327795,
                  position: 179947.2705093627,
                },
                {
                  time: 53792.48299327795,
                  position: 180791.56898009698,
                },
                {
                  time: 53806.48299327795,
                  position: 181623.81089114814,
                },
                {
                  time: 53830.48299327795,
                  position: 183034.1939976445,
                },
                {
                  time: 53850.48299327795,
                  position: 184235.50229204967,
                },
                {
                  time: 54057.92652920042,
                  position: 196911.8538888888,
                },
                {
                  time: 54065.92652920042,
                  position: 197382.96499999994,
                },
                {
                  time: 54069.92652920042,
                  position: 197606.5205555555,
                },
                {
                  time: 54075.92652920042,
                  position: 197926.85388888884,
                },
                {
                  time: 54083.92652920042,
                  position: 198325.96499999997,
                },
                {
                  time: 54091.92652920042,
                  position: 198693.0761111111,
                },
                {
                  time: 54099.92652920042,
                  position: 199028.18722222222,
                },
                {
                  time: 54110.29541808931,
                  position: 199427.96499999994,
                },
                {
                  time: 54116.29541808931,
                  position: 199639.63166666662,
                },
                {
                  time: 54124.29541808931,
                  position: 199893.85388888887,
                },
                {
                  time: 54147.26030786709,
                  position: 200532.607,
                },
                {
                  time: 54153.26030786709,
                  position: 200679.607,
                },
                {
                  time: 54159.26030786709,
                  position: 200808.607,
                },
                {
                  time: 54165.26030786709,
                  position: 200919.607,
                },
                {
                  time: 54173.26030786709,
                  position: 201039.607,
                },
                {
                  time: 54179.26030786709,
                  position: 201108.607,
                },
                {
                  time: 54187.26030786709,
                  position: 201172.607,
                },
                {
                  time: 54193.26030786709,
                  position: 201199.607,
                },
                {
                  time: 54200.26030786709,
                  position: 201208.607,
                },
              ],
            ],
            speeds: [
              {
                time: 51300,
                position: 0,
                speed: 0,
              },
              {
                time: 51302,
                position: 0.9490586448983088,
                speed: 0.9490586448983088,
              },
              {
                time: 51304,
                position: 3.7876080685882414,
                speed: 1.8894907787916235,
              },
              {
                time: 51308,
                position: 15.08768165223028,
                speed: 3.7585662853925057,
              },
              {
                time: 51312,
                position: 33.83214516120702,
                speed: 5.6116489504209675,
              },
              {
                time: 51318,
                position: 75.76573617868836,
                speed: 8.360738040262225,
              },
              {
                time: 51322,
                position: 112.836826916906,
                speed: 10.17270700575389,
              },
              {
                time: 51328,
                position: 181.96120792333537,
                speed: 12.86480037753732,
              },
              {
                time: 51336.570030776566,
                position: 308.55995765996323,
                speed: 16.666666666666668,
              },
              {
                time: 51369.41433331696,
                position: 855.965,
                speed: 16.666666666666668,
              },
              {
                time: 51372.46016693547,
                position: 908.6938467914624,
                speed: 17.94572180176421,
              },
              {
                time: 51375.018277205665,
                position: 952.965,
                speed: 16.666666666666668,
              },
              {
                time: 51417.49827720566,
                position: 1660.965,
                speed: 16.666666666666668,
              },
              {
                time: 51429.49827720566,
                position: 1887.858671857618,
                speed: 21.056336905724773,
              },
              {
                time: 51439.49827720566,
                position: 2113.090781464639,
                speed: 23.80534114707529,
              },
              {
                time: 51451.49827720566,
                position: 2413.029828495464,
                speed: 26.105668045905404,
              },
              {
                time: 51472.46938812619,
                position: 2996.3655202844907,
                speed: 29.641178784176407,
              },
              {
                time: 51481.75174569455,
                position: 3249.965,
                speed: 25,
              },
              {
                time: 51496.43174569455,
                position: 3616.965,
                speed: 25,
              },
              {
                time: 51526.43174569455,
                position: 4459.229607497612,
                speed: 31.345374805946133,
              },
              {
                time: 51542.43174569455,
                position: 4987.250326566449,
                speed: 34.61553198154361,
              },
              {
                time: 51556.43174569455,
                position: 5490.174913149777,
                speed: 37.17209736732895,
              },
              {
                time: 51570.43174569455,
                position: 6026.6744400508705,
                speed: 39.45240892712816,
              },
              {
                time: 51582.43174569455,
                position: 6521.178532726996,
                speed: 43.07577255246863,
              },
              {
                time: 51586.43174569455,
                position: 6693.960154849802,
                speed: 43.33322615807421,
              },
              {
                time: 51594.43174569455,
                position: 7046.075111813276,
                speed: 44.70812670813125,
              },
              {
                time: 51598.43174569455,
                position: 7225.23599945501,
                speed: 44.77339358281161,
              },
              {
                time: 51614.43174569455,
                position: 7932.902880120726,
                speed: 43.69624472410094,
              },
              {
                time: 51634.43174569455,
                position: 8783.682799773613,
                speed: 41.324123750709546,
              },
              {
                time: 51640.43174569455,
                position: 9036.004387683512,
                speed: 42.89585277574626,
              },
              {
                time: 51652.43174569455,
                position: 9578.5172191259,
                speed: 47.55163379646402,
              },
              {
                time: 51668.43174569455,
                position: 10380.54788310116,
                speed: 52.69311822784173,
              },
              {
                time: 51675.47304653589,
                position: 10761.627312665774,
                speed: 55.55555555555556,
              },
              {
                time: 51759.935124907905,
                position: 15453.965,
                speed: 55.55555555555556,
              },
              {
                time: 51773.935124907905,
                position: 16263.167336376571,
                speed: 59.85825428880899,
              },
              {
                time: 51781.935124907905,
                position: 16748.723176299554,
                speed: 61.38572431306721,
              },
              {
                time: 51801.935124907905,
                position: 17999.134634225047,
                speed: 63.69031321436226,
              },
              {
                time: 51815.935124907905,
                position: 18895.395244128296,
                speed: 64.48409205077189,
              },
              {
                time: 51821.935124907905,
                position: 19286.141310948067,
                speed: 65.7013819681295,
              },
              {
                time: 51843.935124907905,
                position: 20767.50609335596,
                speed: 68.96061864834742,
              },
              {
                time: 51863.935124907905,
                position: 22189.116288063826,
                speed: 73.16914241504898,
              },
              {
                time: 51881.935124907905,
                position: 23537.4561097713,
                speed: 76.59368700768825,
              },
              {
                time: 51887.935124907905,
                position: 23999.409845542636,
                speed: 77.21262710092336,
              },
              {
                time: 51895.935124907905,
                position: 24614.388639609148,
                speed: 76.54905821591642,
              },
              {
                time: 51911.935124907905,
                position: 25848.712308372487,
                speed: 77.81157209750988,
              },
              {
                time: 51921.935124907905,
                position: 26629.081230660693,
                speed: 78.22486444596254,
              },
              {
                time: 51939.935124907905,
                position: 28062.013071366036,
                speed: 81.07716031674254,
              },
              {
                time: 51948.00122209541,
                position: 28724.57556097535,
                speed: 83.33333333333333,
              },
              {
                time: 51983.821895363704,
                position: 31709.6308858811,
                speed: 83.33255254776554,
              },
              {
                time: 51991.821895363704,
                position: 32373.97423797496,
                speed: 82.84657929799457,
              },
              {
                time: 51996.28919601914,
                position: 32745.1422452447,
                speed: 83.33333333333333,
              },
              {
                time: 52028.64706907621,
                position: 35441.63166666664,
                speed: 83.33333333333333,
              },
              {
                time: 52040.64706907621,
                position: 36436.43850406896,
                speed: 82.46245470354208,
              },
              {
                time: 52048.271514743516,
                position: 37068.449156007664,
                speed: 83.33333333333333,
              },
              {
                time: 52096.05770487142,
                position: 41050.63042815859,
                speed: 83.33209482526631,
              },
              {
                time: 52106.05770487142,
                position: 41881.54119684637,
                speed: 82.85385166361458,
              },
              {
                time: 52110.05770487142,
                position: 42213.107803883555,
                speed: 82.99070178839779,
              },
              {
                time: 52116.05770487142,
                position: 42709.14184618783,
                speed: 82.33330657037375,
              },
              {
                time: 52120.05770487142,
                position: 43038.745036132226,
                speed: 82.5128013855045,
              },
              {
                time: 52138.05770487142,
                position: 44518.880928441264,
                speed: 81.9430736672955,
              },
              {
                time: 52146.05770487142,
                position: 45176.816922214144,
                speed: 82.6780265594408,
              },
              {
                time: 52149.79815316909,
                position: 45487.18384380568,
                speed: 83.33333333333333,
              },
              {
                time: 52362.9010873366,
                position: 63245.63166666665,
                speed: 83.33333333333333,
              },
              {
                time: 52376.9010873366,
                position: 64395.74223491244,
                speed: 80.90874120181111,
              },
              {
                time: 52390.9010873366,
                position: 65534.83908186208,
                speed: 81.87944083610552,
              },
              {
                time: 52403.30390485196,
                position: 66559.3299787296,
                speed: 83.33333333333333,
              },
              {
                time: 52725.283525107196,
                position: 93390.965,
                speed: 83.33333333333333,
              },
              {
                time: 52739.283525107196,
                position: 94544.84906853344,
                speed: 81.3434987537168,
              },
              {
                time: 52752.84637979722,
                position: 95661.12432035248,
                speed: 83.33333333333333,
              },
              {
                time: 52926.32046795299,
                position: 110117.29833333335,
                speed: 83.33333333333333,
              },
              {
                time: 52938.32046795299,
                position: 111112.8984723236,
                speed: 82.65687277733876,
              },
              {
                time: 52944.36890575577,
                position: 111614.85804368171,
                speed: 83.33333333333333,
              },
              {
                time: 53179.282189231584,
                position: 131190.965,
                speed: 83.33333333333333,
              },
              {
                time: 53193.282189231584,
                position: 132346.46010255828,
                speed: 81.53146243137134,
              },
              {
                time: 53208.394743377554,
                position: 133592.0894357146,
                speed: 83.33333333333333,
              },
              {
                time: 53235.60525014898,
                position: 135859.63166666662,
                speed: 83.33333333333333,
              },
              {
                time: 53241.60525014898,
                position: 136357.82622933082,
                speed: 82.6938108810291,
              },
              {
                time: 53248.88092429429,
                position: 136961.33569717835,
                speed: 83.33333333333333,
              },
              {
                time: 53541.41198995405,
                position: 161338.29833333325,
                speed: 83.33333333333333,
              },
              {
                time: 53549.41198995405,
                position: 162003.15432985823,
                speed: 82.9128855540673,
              },
              {
                time: 53553.33211751481,
                position: 162328.99181158727,
                speed: 83.33333333333333,
              },
              {
                time: 53713.07979577577,
                position: 175641.2977278311,
                speed: 83.33272783120943,
              },
              {
                time: 53713.887332933846,
                position: 175708.57652478074,
                speed: 83.2943958286144,
              },
              {
                time: 53718.25390236885,
                position: 176067.52055555562,
                speed: 81.11111111111111,
              },
              {
                time: 53734.25390236885,
                position: 177301.29833333337,
                speed: 73.11111111111111,
              },
              {
                time: 53746.25390236885,
                position: 178142.63166666668,
                speed: 67.11111111111111,
              },
              {
                time: 53758.25390236885,
                position: 178911.965,
                speed: 61.11111111111111,
              },
              {
                time: 53774.48299327795,
                position: 179903.68796172203,
                speed: 61.05629505542252,
              },
              {
                time: 53816.48299327795,
                position: 182410.6124384856,
                speed: 58.3752119619226,
              },
              {
                time: 53855.07641105239,
                position: 184715.50716255856,
                speed: 61.11111111111111,
              },
              {
                time: 54057.482084755975,
                position: 197084.7427777777,
                speed: 61.11111111111111,
              },
              {
                time: 54067.92652920042,
                position: 197695.74277777772,
                speed: 55.888888888888886,
              },
              {
                time: 54079.92652920042,
                position: 198330.4094444444,
                speed: 49.888888888888886,
              },
              {
                time: 54089.92652920042,
                position: 198804.2983333333,
                speed: 44.888888888888886,
              },
              {
                time: 54101.92652920042,
                position: 199306.965,
                speed: 38.888888888888886,
              },
              {
                time: 54106.07319586709,
                position: 199468.2242592592,
                speed: 38.888888888888886,
              },
              {
                time: 54116.29541808931,
                position: 199839.63166666665,
                speed: 33.77777777777778,
              },
              {
                time: 54128.29541808931,
                position: 200208.965,
                speed: 27.77777777777778,
              },
              {
                time: 54143.70475231153,
                position: 200637.0020617284,
                speed: 27.77777777777778,
              },
              {
                time: 54151.26030786709,
                position: 200832.607,
                speed: 24,
              },
              {
                time: 54157.26030786709,
                position: 200967.607,
                speed: 21,
              },
              {
                time: 54163.26030786709,
                position: 201084.607,
                speed: 18,
              },
              {
                time: 54171.26030786709,
                position: 201212.607,
                speed: 14,
              },
              {
                time: 54177.26030786709,
                position: 201287.607,
                speed: 11,
              },
              {
                time: 54181.26030786709,
                position: 201327.607,
                speed: 9,
              },
              {
                time: 54185.26030786709,
                position: 201359.607,
                speed: 7,
              },
              {
                time: 54191.26030786709,
                position: 201392.607,
                speed: 4,
              },
              {
                time: 54195.26030786709,
                position: 201404.607,
                speed: 2,
              },
              {
                time: 54197.26030786709,
                position: 201407.607,
                speed: 1,
              },
              {
                time: 54200.26030786709,
                position: 201408.607,
                speed: 0,
              },
            ],
            stops: [
              {
                time: 51300,
                position: 0,
                duration: 0,
                id: null,
                name: null,
                line_code: 420000,
                track_number: 4467,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie 1 de  Paris-Montparnasse',
              },
              {
                time: 51368.143826091895,
                position: 838.965,
                duration: 0,
                id: 'd98aed70-6667-11e3-89ff-01f464e0362d',
                name: 'Paris-Montparnasse',
                line_code: 420000,
                track_number: 389,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V2 de Paris-Montparnasse à Brest',
              },
              {
                time: 51421.093344978406,
                position: 1724.965,
                duration: 0,
                id: 'd991522e-6667-11e3-89ff-01f464e0362d',
                name: 'Paris-Montparnasse',
                line_code: 553000,
                track_number: 505,
                line_name: "Ligne d'Ouest-Ceinture à Chartres",
                track_name: 'Voie 1',
              },
              {
                time: 51423.753104535186,
                position: 1772.965,
                duration: 0,
                id: 'd991522e-6667-11e3-89ff-01f464e0362d',
                name: 'Paris-Montparnasse',
                line_code: 420000,
                track_number: 13542,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie 80 de  Paris-Montparnasse',
              },
              {
                time: 51430.48366030956,
                position: 1909.965,
                duration: 0,
                id: 'd96dd23c-6667-11e3-89ff-01f464e0362d',
                name: 'Vanves-Malakoff',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51491.653901467784,
                position: 3497.965,
                duration: 0,
                id: 'd94b9e04-6667-11e3-89ff-01f464e0362d',
                name: 'Montrouge-Châtillon',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51556.53139637603,
                position: 5496.965,
                duration: 0,
                id: 'd9abaea4-6667-11e3-89ff-01f464e0362d',
                name: 'Montrouge-Châtillon',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51684.76144018352,
                position: 11281.965,
                duration: 0,
                id: 'd9b1afd2-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51717.35712466732,
                position: 13090.965,
                duration: 0,
                id: 'd98ef502-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51721.48338876173,
                position: 13319.965,
                duration: 0,
                id: 'd995be4a-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51729.087246612566,
                position: 13741.965,
                duration: 0,
                id: 'd9b63fde-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51736.27667619191,
                position: 14140.965,
                duration: 0,
                id: 'd9cce656-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 51897.208784237875,
                position: 24712.965,
                duration: 0,
                id: 'd99fe84e-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 12 Marcoussis',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52131.51135711593,
                position: 43978.965,
                duration: 0,
                id: 'd9c68ba6-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 13 St-Arnoult',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52269.846273795214,
                position: 55490.965,
                duration: 0,
                id: 'b5992bfa-51ee-11ec-80ff-0168b2273146',
                name: 'Poste 13 St-Arnoult',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52394.22070109625,
                position: 65808.965,
                duration: 0,
                id: 'bd3f33ec-91b6-11e6-b6ff-010c64e0362d',
                name: 'Poste 14 St-Léger',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52403.575416333384,
                position: 66581.965,
                duration: 0,
                id: 'd944e8be-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 14 St-Léger',
                line_code: 431000,
                track_number: 12304,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie 3 de St-Léger',
              },
              {
                time: 52410.3554186258,
                position: 67146.965,
                duration: 0,
                id: 'd944e8be-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 14 St-Léger',
                line_code: 431000,
                track_number: 12304,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie 3 de St-Léger',
              },
              {
                time: 52704.55951810013,
                position: 91663.965,
                duration: 0,
                id: 'd9e1d9fe-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 15 Rouvray',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52965.96731091809,
                position: 113417.965,
                duration: 0,
                id: 'd9d9a0c8-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 16 Dangeau',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 53160.654794242415,
                position: 129638.965,
                duration: 0,
                id: 'd99ac560-6667-11e3-89ff-01f464e0362d',
                name: 'Courtalain-TGV-Bifurcation',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 53205.81946335617,
                position: 133377.965,
                duration: 0,
                id: 'd991ca18-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 17',
                line_code: 429000,
                track_number: 396,
                line_name: 'Ligne de Courtalain à Connerré (LGV)',
                track_name: 'Voie 1',
              },
              {
                time: 53671.24037027163,
                position: 172154.965,
                duration: 0,
                id: 'd9c72694-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 32 Dollon',
                line_code: 429000,
                track_number: 396,
                line_name: 'Ligne de Courtalain à Connerré (LGV)',
                track_name: 'Voie 1',
              },
              {
                time: 53759.89148034092,
                position: 179011.965,
                duration: 0,
                id: 'bd3d7012-91b6-11e6-b6ff-010c64e0362d',
                name: 'Poste 33 Connerré',
                line_code: 429000,
                track_number: 396,
                line_name: 'Ligne de Courtalain à Connerré (LGV)',
                track_name: 'Voie 1',
              },
              {
                time: 53798.24279005697,
                position: 181333.965,
                duration: 0,
                id: 'd9b146e4-6667-11e3-89ff-01f464e0362d',
                name: 'Connerré-Beillé',
                line_code: 429310,
                track_number: 398,
                line_name: 'Raccordement de Connerré-Sud',
                track_name: 'Voie 1',
              },
              {
                time: 53812.7477440196,
                position: 182191.965,
                duration: 0,
                id: 'd990066a-6667-11e3-89ff-01f464e0362d',
                name: 'Connerré-Beillé',
                line_code: 420000,
                track_number: 389,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V2 de Paris-Montparnasse à Brest',
              },
              {
                time: 53847.84358268221,
                position: 184276.965,
                duration: 0,
                id: 'd97dc09a-6667-11e3-89ff-01f464e0362d',
                name: 'Montfort-le-Gesnois',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 53851.325160365515,
                position: 184486.965,
                duration: 0,
                id: 'd9d582aa-6667-11e3-89ff-01f464e0362d',
                name: 'Montfort-le-Gesnois',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 53941.96872895832,
                position: 190025.965,
                duration: 0,
                id: 'd9a52b18-6667-11e3-89ff-01f464e0362d',
                name: 'Champagné',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 54102.021632652955,
                position: 199308.965,
                duration: 0,
                id: 'd97a0c7c-6667-11e3-89ff-01f464e0362d',
                name: 'Le Mans',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 54129.224930758915,
                position: 200230.965,
                duration: 0,
                id: 'd9b6e040-6667-11e3-89ff-01f464e0362d',
                name: 'Le Mans',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 54200.26030786709,
                position: 201408.607,
                duration: 1,
                id: null,
                name: null,
                line_code: 450000,
                track_number: 424,
                line_name: 'Ligne du Mans à Angers-Maître-École',
                track_name: 'Voie 2',
              },
            ],
            route_aspects: [
              {
                signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
                time_start: 51300,
                time_end: 51337.314,
                position_start: 320.965,
                position_end: 605.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '69ca947c-6667-11e3-81ff-01f464e0362d',
                track_offset: 496,
              },
              {
                signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
                time_start: 51337.314,
                time_end: 51366.409,
                position_start: 320.965,
                position_end: 605.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '69ca947c-6667-11e3-81ff-01f464e0362d',
                track_offset: 496,
              },
              {
                signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
                time_start: 51366.409,
                time_end: 51414.491,
                position_start: 320.965,
                position_end: 605.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '69ca947c-6667-11e3-81ff-01f464e0362d',
                track_offset: 496,
              },
              {
                signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
                time_start: 51337.314,
                time_end: 51354.413,
                position_start: 605.965,
                position_end: 1410.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60c895c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 51,
              },
              {
                signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
                time_start: 51354.413,
                time_end: 51414.491,
                position_start: 605.965,
                position_end: 1410.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60c895c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 51,
              },
              {
                signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
                time_start: 51414.491,
                time_end: 51449.366,
                position_start: 605.965,
                position_end: 1410.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60c895c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 51,
              },
              {
                signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
                time_start: 51378.49,
                time_end: 51402.49,
                position_start: 1410.965,
                position_end: 2157.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '61a60592-6667-11e3-81ff-01f464e0362d',
                track_offset: 358,
              },
              {
                signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
                time_start: 51402.49,
                time_end: 51449.366,
                position_start: 1410.965,
                position_end: 2157.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '61a60592-6667-11e3-81ff-01f464e0362d',
                track_offset: 358,
              },
              {
                signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
                time_start: 51449.366,
                time_end: 51485.344,
                position_start: 1410.965,
                position_end: 2157.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '61a60592-6667-11e3-81ff-01f464e0362d',
                track_offset: 358,
              },
              {
                signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
                time_start: 51422.969,
                time_end: 51441.36,
                position_start: 2157.965,
                position_end: 3139.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '61a460c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 248,
              },
              {
                signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
                time_start: 51441.36,
                time_end: 51485.344,
                position_start: 2157.965,
                position_end: 3139.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '61a460c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 248,
              },
              {
                signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
                time_start: 51485.344,
                time_end: 51545.395,
                position_start: 2157.965,
                position_end: 3139.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '61a460c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 248,
              },
              {
                signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
                time_start: 51463.556,
                time_end: 51477.522,
                position_start: 3139.965,
                position_end: 4890.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '61a465bc-6667-11e3-81ff-01f464e0362d',
                track_offset: 544,
              },
              {
                signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
                time_start: 51477.522,
                time_end: 51545.395,
                position_start: 3139.965,
                position_end: 4890.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '61a465bc-6667-11e3-81ff-01f464e0362d',
                track_offset: 544,
              },
              {
                signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
                time_start: 51545.395,
                time_end: 51583.463,
                position_start: 3139.965,
                position_end: 4890.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '61a465bc-6667-11e3-81ff-01f464e0362d',
                track_offset: 544,
              },
              {
                signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
                time_start: 51527.432,
                time_end: 51539.619,
                position_start: 4890.965,
                position_end: 6365.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8b696-6667-11e3-81ff-01f464e0362d',
                track_offset: 1393,
              },
              {
                signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
                time_start: 51539.619,
                time_end: 51583.463,
                position_start: 4890.965,
                position_end: 6365.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8b696-6667-11e3-81ff-01f464e0362d',
                track_offset: 1393,
              },
              {
                signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
                time_start: 51583.463,
                time_end: 51636.164,
                position_start: 4890.965,
                position_end: 6365.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8b696-6667-11e3-81ff-01f464e0362d',
                track_offset: 1393,
              },
              {
                signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
                time_start: 51568.88,
                time_end: 51578.776,
                position_start: 6365.965,
                position_end: 8655.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 869,
              },
              {
                signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
                time_start: 51578.776,
                time_end: 51636.164,
                position_start: 6365.965,
                position_end: 8655.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 869,
              },
              {
                signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
                time_start: 51636.164,
                time_end: 51677.883,
                position_start: 6365.965,
                position_end: 8655.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 869,
              },
              {
                signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
                time_start: 51621.903,
                time_end: 51631.348,
                position_start: 8655.965,
                position_end: 10695.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 3159,
              },
              {
                signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
                time_start: 51631.348,
                time_end: 51677.883,
                position_start: 8655.965,
                position_end: 10695.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 3159,
              },
              {
                signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
                time_start: 51677.883,
                time_end: 51723.329,
                position_start: 8655.965,
                position_end: 10695.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 3159,
              },
              {
                signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
                time_start: 51666.81,
                time_end: 51674.278,
                position_start: 10695.965,
                position_end: 13220.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 5199,
              },
              {
                signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
                time_start: 51674.278,
                time_end: 51723.329,
                position_start: 10695.965,
                position_end: 13220.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 5199,
              },
              {
                signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
                time_start: 51723.329,
                time_end: 51761.71,
                position_start: 10695.965,
                position_end: 13220.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 5199,
              },
              {
                signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
                time_start: 51712.531,
                time_end: 51719.73,
                position_start: 13220.965,
                position_end: 15353.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
                track_offset: 10,
              },
              {
                signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
                time_start: 51719.73,
                time_end: 51761.71,
                position_start: 13220.965,
                position_end: 15353.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
                track_offset: 10,
              },
              {
                signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
                time_start: 53768.402,
                time_end: 53774.949,
                position_start: 179935.965,
                position_end: 181568.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
                track_offset: 924,
              },
              {
                signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
                time_start: 53774.949,
                time_end: 53805.492,
                position_start: 179935.965,
                position_end: 181568.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
                track_offset: 924,
              },
              {
                signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
                time_start: 53805.492,
                time_end: 53840.385,
                position_start: 179935.965,
                position_end: 181568.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
                track_offset: 924,
              },
              {
                signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
                time_start: 53795.388,
                time_end: 53802.113,
                position_start: 181568.965,
                position_end: 183628.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
                track_offset: 235,
              },
              {
                signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
                time_start: 53802.113,
                time_end: 53840.385,
                position_start: 181568.965,
                position_end: 183628.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
                track_offset: 235,
              },
              {
                signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
                time_start: 53840.385,
                time_end: 53867.834,
                position_start: 181568.965,
                position_end: 183628.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
                track_offset: 235,
              },
              {
                signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
                time_start: 53830.332,
                time_end: 53837.048,
                position_start: 183628.965,
                position_end: 185298.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 1140,
              },
              {
                signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
                time_start: 53837.048,
                time_end: 53867.834,
                position_start: 183628.965,
                position_end: 185298.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 1140,
              },
              {
                signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
                time_start: 53867.834,
                time_end: 53895.488,
                position_start: 183628.965,
                position_end: 185298.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 1140,
              },
              {
                signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
                time_start: 53858.016,
                time_end: 53864.561,
                position_start: 185298.965,
                position_end: 186988.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 2810,
              },
              {
                signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
                time_start: 53864.561,
                time_end: 53895.488,
                position_start: 185298.965,
                position_end: 186988.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 2810,
              },
              {
                signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
                time_start: 53895.488,
                time_end: 53922.161,
                position_start: 185298.965,
                position_end: 186988.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 2810,
              },
              {
                signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
                time_start: 53885.67,
                time_end: 53892.215,
                position_start: 186988.965,
                position_end: 188618.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 4500,
              },
              {
                signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
                time_start: 53892.215,
                time_end: 53922.161,
                position_start: 186988.965,
                position_end: 188618.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 4500,
              },
              {
                signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
                time_start: 53922.161,
                time_end: 53949.061,
                position_start: 186988.965,
                position_end: 188618.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 4500,
              },
              {
                signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
                time_start: 53912.342,
                time_end: 53918.888,
                position_start: 188618.965,
                position_end: 190262.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 6130,
              },
              {
                signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
                time_start: 53918.888,
                time_end: 53949.061,
                position_start: 188618.965,
                position_end: 190262.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 6130,
              },
              {
                signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
                time_start: 53949.061,
                time_end: 53976.698,
                position_start: 188618.965,
                position_end: 190262.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 6130,
              },
              {
                signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
                time_start: 53939.244,
                time_end: 53945.789,
                position_start: 190262.965,
                position_end: 191951.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca4278-6667-11e3-81ff-01f464e0362d',
                track_offset: 264,
              },
              {
                signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
                time_start: 53945.789,
                time_end: 53976.698,
                position_start: 190262.965,
                position_end: 191951.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca4278-6667-11e3-81ff-01f464e0362d',
                track_offset: 264,
              },
              {
                signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
                time_start: 53976.698,
                time_end: 54008.312,
                position_start: 190262.965,
                position_end: 191951.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca4278-6667-11e3-81ff-01f464e0362d',
                track_offset: 264,
              },
              {
                signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
                time_start: 53966.88,
                time_end: 53973.425,
                position_start: 191951.965,
                position_end: 193883.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 1085,
              },
              {
                signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
                time_start: 53973.425,
                time_end: 54008.312,
                position_start: 191951.965,
                position_end: 193883.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 1085,
              },
              {
                signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
                time_start: 54008.312,
                time_end: 54040.303,
                position_start: 191951.965,
                position_end: 193883.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 1085,
              },
              {
                signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
                time_start: 53998.494,
                time_end: 54005.039,
                position_start: 193883.965,
                position_end: 195838.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 3017,
              },
              {
                signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
                time_start: 54005.039,
                time_end: 54040.303,
                position_start: 193883.965,
                position_end: 195838.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 3017,
              },
              {
                signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
                time_start: 54040.303,
                time_end: 54067.971,
                position_start: 193883.965,
                position_end: 195838.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 3017,
              },
              {
                signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
                time_start: 54030.485,
                time_end: 54037.03,
                position_start: 195838.965,
                position_end: 197501.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 4972,
              },
              {
                signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
                time_start: 54037.03,
                time_end: 54067.971,
                position_start: 195838.965,
                position_end: 197501.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 4972,
              },
              {
                signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
                time_start: 54067.971,
                time_end: 54101.398,
                position_start: 195838.965,
                position_end: 197501.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 4972,
              },
              {
                signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
                time_start: 54057.698,
                time_end: 54064.444,
                position_start: 197501.965,
                position_end: 199088.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 6635,
              },
              {
                signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
                time_start: 54064.444,
                time_end: 54101.398,
                position_start: 197501.965,
                position_end: 199088.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 6635,
              },
              {
                signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
                time_start: 54101.398,
                time_end: 54127.654,
                position_start: 197501.965,
                position_end: 199088.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 6635,
              },
              {
                signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
                time_start: 54087.326,
                time_end: 54096.442,
                position_start: 199088.965,
                position_end: 199992.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 8222,
              },
              {
                signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
                time_start: 54096.442,
                time_end: 54127.654,
                position_start: 199088.965,
                position_end: 199992.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 8222,
              },
              {
                signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
                time_start: 54127.654,
                time_end: 54152.86,
                position_start: 199088.965,
                position_end: 199992.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 8222,
              },
              {
                signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
                time_start: 54109.282,
                time_end: 54120.931,
                position_start: 199992.965,
                position_end: 200671.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
                track_offset: 684,
              },
              {
                signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
                time_start: 54120.931,
                time_end: 54152.86,
                position_start: 199992.965,
                position_end: 200671.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
                track_offset: 684,
              },
              {
                signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
                time_start: 54152.86,
                time_end: 54200.26030786709,
                position_start: 199992.965,
                position_end: 200671.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
                track_offset: 684,
              },
              {
                signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
                time_start: 54130.495,
                time_end: 54144.91,
                position_start: 200671.965,
                position_end: 201657.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
                track_offset: 12,
              },
              {
                signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
                time_start: 54144.91,
                time_end: 54200.26030786709,
                position_start: 200671.965,
                position_end: 201657.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
                track_offset: 12,
              },
              {
                signal_id: 'b564cfd6-4964-11e4-9bff-012064e0362d',
                time_start: 51300,
                time_end: 54200.26030786709,
                position_start: 201657.965,
                position_end: 201657.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '6058b958-6667-11e3-81ff-01f464e0362d',
                track_offset: 705,
              },
            ],
            mechanical_energy_consumed: 12083466761.106243,
          },
          speed_limit_tags: 'Aucune composition',
          electrification_ranges: [
            {
              electrificationUsage: {
                mode: '1500V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 0,
              stop: 6503.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: true,
                object_type: 'Neutral',
              },
              start: 6503.965,
              stop: 7106.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 7106.965,
              stop: 63305.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 63305.965,
              stop: 63996.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 63996.965,
              stop: 93473.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 93473.965,
              stop: 94165.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 94165.965,
              stop: 131273.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 131273.965,
              stop: 131965.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 131965.965,
              stop: 179005.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 179005.965,
              stop: 179011.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 179011.965,
              stop: 179841.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: true,
                object_type: 'Neutral',
              },
              start: 179841.965,
              stop: 180550.965,
            },
            {
              electrificationUsage: {
                mode: '1500V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 180550.965,
              stop: 201408.607,
            },
          ],
          power_restriction_ranges: [],
        },
        {
          id: 12,
          labels: [],
          path: 4,
          name: 'sample 5',
          vmax: [
            {
              position: 0,
              speed: 16.666666666666668,
            },
            {
              position: 320.96500000000003,
              speed: 16.666666666666668,
            },
            {
              position: 320.96500000000003,
              speed: 16.666666666666668,
            },
            {
              position: 394.965,
              speed: 16.666666666666668,
            },
            {
              position: 394.965,
              speed: 16.666666666666668,
            },
            {
              position: 420.965,
              speed: 16.666666666666668,
            },
            {
              position: 420.965,
              speed: 16.666666666666668,
            },
            {
              position: 477.965,
              speed: 16.666666666666668,
            },
            {
              position: 477.965,
              speed: 16.666666666666668,
            },
            {
              position: 511.965,
              speed: 16.666666666666668,
            },
            {
              position: 511.965,
              speed: 16.666666666666668,
            },
            {
              position: 551.965,
              speed: 16.666666666666668,
            },
            {
              position: 551.965,
              speed: 16.666666666666668,
            },
            {
              position: 554.965,
              speed: 16.666666666666668,
            },
            {
              position: 554.965,
              speed: 16.666666666666668,
            },
            {
              position: 605.965,
              speed: 16.666666666666668,
            },
            {
              position: 605.965,
              speed: 25,
            },
            {
              position: 637.965,
              speed: 25,
            },
            {
              position: 637.965,
              speed: 25,
            },
            {
              position: 677.965,
              speed: 25,
            },
            {
              position: 677.965,
              speed: 25,
            },
            {
              position: 756.965,
              speed: 25,
            },
            {
              position: 756.965,
              speed: 25,
            },
            {
              position: 802.965,
              speed: 25,
            },
            {
              position: 802.965,
              speed: 25,
            },
            {
              position: 838.965,
              speed: 25,
            },
            {
              position: 838.965,
              speed: 25,
            },
            {
              position: 892.965,
              speed: 25,
            },
            {
              position: 892.965,
              speed: 25,
            },
            {
              position: 951.965,
              speed: 25,
            },
            {
              position: 951.965,
              speed: 30.555555555555554,
            },
            {
              position: 982.965,
              speed: 30.555555555555554,
            },
            {
              position: 982.965,
              speed: 30.555555555555554,
            },
            {
              position: 1052.965,
              speed: 30.555555555555554,
            },
            {
              position: 1052.965,
              speed: 16.666666666666668,
            },
            {
              position: 1066.965,
              speed: 16.666666666666668,
            },
            {
              position: 1066.965,
              speed: 16.666666666666668,
            },
            {
              position: 1410.965,
              speed: 16.666666666666668,
            },
            {
              position: 1410.965,
              speed: 25,
            },
            {
              position: 1425.965,
              speed: 25,
            },
            {
              position: 1425.965,
              speed: 25,
            },
            {
              position: 1724.965,
              speed: 25,
            },
            {
              position: 1724.965,
              speed: 36.11111111111111,
            },
            {
              position: 1772.965,
              speed: 36.11111111111111,
            },
            {
              position: 1772.965,
              speed: 41.666666666666664,
            },
            {
              position: 1780.965,
              speed: 41.666666666666664,
            },
            {
              position: 1780.965,
              speed: 41.666666666666664,
            },
            {
              position: 1909.965,
              speed: 41.666666666666664,
            },
            {
              position: 1909.965,
              speed: 41.666666666666664,
            },
            {
              position: 2157.965,
              speed: 41.666666666666664,
            },
            {
              position: 2157.965,
              speed: 41.666666666666664,
            },
            {
              position: 2595.965,
              speed: 41.666666666666664,
            },
            {
              position: 2595.965,
              speed: 41.666666666666664,
            },
            {
              position: 3139.965,
              speed: 41.666666666666664,
            },
            {
              position: 3139.965,
              speed: 41.666666666666664,
            },
            {
              position: 3349.965,
              speed: 41.666666666666664,
            },
            {
              position: 3349.965,
              speed: 25,
            },
            {
              position: 3366.965,
              speed: 25,
            },
            {
              position: 3366.965,
              speed: 41.666666666666664,
            },
            {
              position: 3367.965,
              speed: 41.666666666666664,
            },
            {
              position: 3367.965,
              speed: 41.666666666666664,
            },
            {
              position: 3494.965,
              speed: 41.666666666666664,
            },
            {
              position: 3494.965,
              speed: 41.666666666666664,
            },
            {
              position: 3497.965,
              speed: 41.666666666666664,
            },
            {
              position: 3497.965,
              speed: 41.666666666666664,
            },
            {
              position: 3625.965,
              speed: 41.666666666666664,
            },
            {
              position: 3625.965,
              speed: 41.666666666666664,
            },
            {
              position: 4890.965,
              speed: 41.666666666666664,
            },
            {
              position: 4890.965,
              speed: 41.666666666666664,
            },
            {
              position: 4975.965,
              speed: 41.666666666666664,
            },
            {
              position: 4975.965,
              speed: 55.55555555555556,
            },
            {
              position: 5496.965,
              speed: 55.55555555555556,
            },
            {
              position: 5496.965,
              speed: 55.55555555555556,
            },
            {
              position: 6365.965,
              speed: 55.55555555555556,
            },
            {
              position: 6365.965,
              speed: 55.55555555555556,
            },
            {
              position: 7591.965,
              speed: 55.55555555555556,
            },
            {
              position: 7591.965,
              speed: 55.55555555555556,
            },
            {
              position: 10695.965,
              speed: 55.55555555555556,
            },
            {
              position: 10695.965,
              speed: 55.55555555555556,
            },
            {
              position: 11201.965,
              speed: 55.55555555555556,
            },
            {
              position: 11201.965,
              speed: 55.55555555555556,
            },
            {
              position: 11281.965,
              speed: 55.55555555555556,
            },
            {
              position: 11281.965,
              speed: 55.55555555555556,
            },
            {
              position: 12870.965,
              speed: 55.55555555555556,
            },
            {
              position: 12870.965,
              speed: 55.55555555555556,
            },
            {
              position: 12880.965,
              speed: 55.55555555555556,
            },
            {
              position: 12880.965,
              speed: 55.55555555555556,
            },
            {
              position: 12955.965,
              speed: 55.55555555555556,
            },
            {
              position: 12955.965,
              speed: 55.55555555555556,
            },
            {
              position: 13210.965,
              speed: 55.55555555555556,
            },
            {
              position: 13210.965,
              speed: 55.55555555555556,
            },
            {
              position: 13220.965,
              speed: 55.55555555555556,
            },
            {
              position: 13220.965,
              speed: 55.55555555555556,
            },
            {
              position: 13301.965,
              speed: 55.55555555555556,
            },
            {
              position: 13301.965,
              speed: 55.55555555555556,
            },
            {
              position: 13319.965,
              speed: 55.55555555555556,
            },
            {
              position: 13319.965,
              speed: 55.55555555555556,
            },
            {
              position: 13741.965,
              speed: 55.55555555555556,
            },
            {
              position: 13741.965,
              speed: 55.55555555555556,
            },
            {
              position: 14140.965,
              speed: 55.55555555555556,
            },
            {
              position: 14140.965,
              speed: 55.55555555555556,
            },
            {
              position: 15203.965,
              speed: 55.55555555555556,
            },
            {
              position: 15203.965,
              speed: 61.11111111111111,
            },
            {
              position: 15353.965,
              speed: 61.11111111111111,
            },
            {
              position: 15353.965,
              speed: 75,
            },
            {
              position: 15365.965,
              speed: 75,
            },
            {
              position: 15365.965,
              speed: 83.33333333333333,
            },
            {
              position: 17246.965,
              speed: 83.33333333333333,
            },
            {
              position: 17246.965,
              speed: 83.33333333333333,
            },
            {
              position: 18895.965,
              speed: 83.33333333333333,
            },
            {
              position: 18895.965,
              speed: 83.33333333333333,
            },
            {
              position: 20763.965,
              speed: 83.33333333333333,
            },
            {
              position: 20763.965,
              speed: 83.33333333333333,
            },
            {
              position: 22909.965,
              speed: 83.33333333333333,
            },
            {
              position: 22909.965,
              speed: 83.33333333333333,
            },
            {
              position: 24630.965,
              speed: 83.33333333333333,
            },
            {
              position: 24630.965,
              speed: 83.33333333333333,
            },
            {
              position: 25414.965,
              speed: 83.33333333333333,
            },
            {
              position: 25414.965,
              speed: 83.33333333333333,
            },
            {
              position: 25494.965,
              speed: 83.33333333333333,
            },
            {
              position: 25494.965,
              speed: 83.33333333333333,
            },
            {
              position: 25768.965,
              speed: 83.33333333333333,
            },
            {
              position: 25768.965,
              speed: 83.33333333333333,
            },
            {
              position: 26965.965,
              speed: 83.33333333333333,
            },
            {
              position: 26965.965,
              speed: 83.33333333333333,
            },
            {
              position: 27028.965,
              speed: 83.33333333333333,
            },
            {
              position: 27028.965,
              speed: 83.33333333333333,
            },
            {
              position: 31122.965,
              speed: 83.33333333333333,
            },
            {
              position: 31122.965,
              speed: 83.33333333333333,
            },
            {
              position: 33524.965,
              speed: 83.33333333333333,
            },
            {
              position: 33524.965,
              speed: 83.33333333333333,
            },
            {
              position: 35697.965,
              speed: 83.33333333333333,
            },
            {
              position: 35697.965,
              speed: 83.33333333333333,
            },
            {
              position: 40073.965,
              speed: 83.33333333333333,
            },
            {
              position: 40073.965,
              speed: 83.33333333333333,
            },
            {
              position: 42824.965,
              speed: 83.33333333333333,
            },
            {
              position: 42824.965,
              speed: 83.33333333333333,
            },
            {
              position: 43318.965,
              speed: 83.33333333333333,
            },
            {
              position: 43318.965,
              speed: 83.33333333333333,
            },
            {
              position: 43950.965,
              speed: 83.33333333333333,
            },
            {
              position: 43950.965,
              speed: 83.33333333333333,
            },
            {
              position: 45287.965,
              speed: 83.33333333333333,
            },
            {
              position: 45287.965,
              speed: 83.33333333333333,
            },
            {
              position: 47558.965,
              speed: 83.33333333333333,
            },
            {
              position: 47558.965,
              speed: 83.33333333333333,
            },
            {
              position: 49678.965,
              speed: 83.33333333333333,
            },
            {
              position: 49678.965,
              speed: 83.33333333333333,
            },
            {
              position: 51800.965,
              speed: 83.33333333333333,
            },
            {
              position: 51800.965,
              speed: 83.33333333333333,
            },
            {
              position: 53887.965,
              speed: 83.33333333333333,
            },
            {
              position: 53887.965,
              speed: 83.33333333333333,
            },
            {
              position: 55490.965,
              speed: 83.33333333333333,
            },
            {
              position: 55490.965,
              speed: 83.33333333333333,
            },
            {
              position: 55975.965,
              speed: 83.33333333333333,
            },
            {
              position: 55975.965,
              speed: 83.33333333333333,
            },
            {
              position: 60045.965,
              speed: 83.33333333333333,
            },
            {
              position: 60045.965,
              speed: 83.33333333333333,
            },
            {
              position: 62328.965,
              speed: 83.33333333333333,
            },
            {
              position: 62328.965,
              speed: 83.33333333333333,
            },
            {
              position: 64579.965,
              speed: 83.33333333333333,
            },
            {
              position: 64579.965,
              speed: 83.33333333333333,
            },
            {
              position: 65809.965,
              speed: 83.33333333333333,
            },
            {
              position: 65809.965,
              speed: 83.33333333333333,
            },
            {
              position: 66069.965,
              speed: 83.33333333333333,
            },
            {
              position: 66069.965,
              speed: 83.33333333333333,
            },
            {
              position: 66344.965,
              speed: 83.33333333333333,
            },
            {
              position: 66344.965,
              speed: 83.33333333333333,
            },
            {
              position: 66384.965,
              speed: 83.33333333333333,
            },
            {
              position: 66384.965,
              speed: 83.33333333333333,
            },
            {
              position: 66538.965,
              speed: 83.33333333333333,
            },
            {
              position: 66538.965,
              speed: 83.33333333333333,
            },
            {
              position: 67146.965,
              speed: 83.33333333333333,
            },
            {
              position: 67146.965,
              speed: 83.33333333333333,
            },
            {
              position: 67194.965,
              speed: 83.33333333333333,
            },
            {
              position: 67194.965,
              speed: 83.33333333333333,
            },
            {
              position: 67349.965,
              speed: 83.33333333333333,
            },
            {
              position: 67349.965,
              speed: 83.33333333333333,
            },
            {
              position: 67389.965,
              speed: 83.33333333333333,
            },
            {
              position: 67389.965,
              speed: 83.33333333333333,
            },
            {
              position: 67664.965,
              speed: 83.33333333333333,
            },
            {
              position: 67664.965,
              speed: 83.33333333333333,
            },
            {
              position: 69177.965,
              speed: 83.33333333333333,
            },
            {
              position: 69177.965,
              speed: 83.33333333333333,
            },
            {
              position: 71344.965,
              speed: 83.33333333333333,
            },
            {
              position: 71344.965,
              speed: 83.33333333333333,
            },
            {
              position: 73511.965,
              speed: 83.33333333333333,
            },
            {
              position: 73511.965,
              speed: 83.33333333333333,
            },
            {
              position: 75663.965,
              speed: 83.33333333333333,
            },
            {
              position: 75663.965,
              speed: 83.33333333333333,
            },
            {
              position: 77852.965,
              speed: 83.33333333333333,
            },
            {
              position: 77852.965,
              speed: 83.33333333333333,
            },
            {
              position: 80001.965,
              speed: 83.33333333333333,
            },
            {
              position: 80001.965,
              speed: 83.33333333333333,
            },
            {
              position: 82179.965,
              speed: 83.33333333333333,
            },
            {
              position: 82179.965,
              speed: 83.33333333333333,
            },
            {
              position: 84345.965,
              speed: 83.33333333333333,
            },
            {
              position: 84345.965,
              speed: 83.33333333333333,
            },
            {
              position: 86513.965,
              speed: 83.33333333333333,
            },
            {
              position: 86513.965,
              speed: 83.33333333333333,
            },
            {
              position: 88680.965,
              speed: 83.33333333333333,
            },
            {
              position: 88680.965,
              speed: 83.33333333333333,
            },
            {
              position: 90845.965,
              speed: 83.33333333333333,
            },
            {
              position: 90845.965,
              speed: 83.33333333333333,
            },
            {
              position: 91607.965,
              speed: 83.33333333333333,
            },
            {
              position: 91607.965,
              speed: 83.33333333333333,
            },
            {
              position: 92236.965,
              speed: 83.33333333333333,
            },
            {
              position: 92236.965,
              speed: 83.33333333333333,
            },
            {
              position: 92937.965,
              speed: 83.33333333333333,
            },
            {
              position: 92937.965,
              speed: 83.33333333333333,
            },
            {
              position: 95023.965,
              speed: 83.33333333333333,
            },
            {
              position: 95023.965,
              speed: 83.33333333333333,
            },
            {
              position: 97273.965,
              speed: 83.33333333333333,
            },
            {
              position: 97273.965,
              speed: 83.33333333333333,
            },
            {
              position: 99525.965,
              speed: 83.33333333333333,
            },
            {
              position: 99525.965,
              speed: 83.33333333333333,
            },
            {
              position: 101777.965,
              speed: 83.33333333333333,
            },
            {
              position: 101777.965,
              speed: 83.33333333333333,
            },
            {
              position: 104018.965,
              speed: 83.33333333333333,
            },
            {
              position: 104018.965,
              speed: 83.33333333333333,
            },
            {
              position: 106281.965,
              speed: 83.33333333333333,
            },
            {
              position: 106281.965,
              speed: 83.33333333333333,
            },
            {
              position: 108533.965,
              speed: 83.33333333333333,
            },
            {
              position: 108533.965,
              speed: 83.33333333333333,
            },
            {
              position: 111188.965,
              speed: 83.33333333333333,
            },
            {
              position: 111188.965,
              speed: 83.33333333333333,
            },
            {
              position: 112626.965,
              speed: 83.33333333333333,
            },
            {
              position: 112626.965,
              speed: 83.33333333333333,
            },
            {
              position: 113559.965,
              speed: 83.33333333333333,
            },
            {
              position: 113559.965,
              speed: 83.33333333333333,
            },
            {
              position: 114221.965,
              speed: 83.33333333333333,
            },
            {
              position: 114221.965,
              speed: 83.33333333333333,
            },
            {
              position: 115729.965,
              speed: 83.33333333333333,
            },
            {
              position: 115729.965,
              speed: 83.33333333333333,
            },
            {
              position: 117865.965,
              speed: 83.33333333333333,
            },
            {
              position: 117865.965,
              speed: 83.33333333333333,
            },
            {
              position: 120019.965,
              speed: 83.33333333333333,
            },
            {
              position: 120019.965,
              speed: 83.33333333333333,
            },
            {
              position: 124073.965,
              speed: 83.33333333333333,
            },
            {
              position: 124073.965,
              speed: 83.33333333333333,
            },
            {
              position: 126210.965,
              speed: 83.33333333333333,
            },
            {
              position: 126210.965,
              speed: 83.33333333333333,
            },
            {
              position: 128143.965,
              speed: 83.33333333333333,
            },
            {
              position: 128143.965,
              speed: 83.33333333333333,
            },
            {
              position: 129638.965,
              speed: 83.33333333333333,
            },
            {
              position: 129638.965,
              speed: 83.33333333333333,
            },
            {
              position: 130644.965,
              speed: 83.33333333333333,
            },
            {
              position: 130644.965,
              speed: 83.33333333333333,
            },
            {
              position: 130900.965,
              speed: 83.33333333333333,
            },
            {
              position: 130900.965,
              speed: 83.33333333333333,
            },
            {
              position: 132862.965,
              speed: 83.33333333333333,
            },
            {
              position: 132862.965,
              speed: 83.33333333333333,
            },
            {
              position: 132865.965,
              speed: 83.33333333333333,
            },
            {
              position: 132865.965,
              speed: 83.33333333333333,
            },
            {
              position: 132942.965,
              speed: 83.33333333333333,
            },
            {
              position: 132942.965,
              speed: 83.33333333333333,
            },
            {
              position: 133377.965,
              speed: 83.33333333333333,
            },
            {
              position: 133377.965,
              speed: 83.33333333333333,
            },
            {
              position: 133457.965,
              speed: 83.33333333333333,
            },
            {
              position: 133457.965,
              speed: 83.33333333333333,
            },
            {
              position: 134942.965,
              speed: 83.33333333333333,
            },
            {
              position: 134942.965,
              speed: 83.33333333333333,
            },
            {
              position: 137363.965,
              speed: 83.33333333333333,
            },
            {
              position: 137363.965,
              speed: 83.33333333333333,
            },
            {
              position: 139603.965,
              speed: 83.33333333333333,
            },
            {
              position: 139603.965,
              speed: 83.33333333333333,
            },
            {
              position: 141935.965,
              speed: 83.33333333333333,
            },
            {
              position: 141935.965,
              speed: 83.33333333333333,
            },
            {
              position: 144265.965,
              speed: 83.33333333333333,
            },
            {
              position: 144265.965,
              speed: 83.33333333333333,
            },
            {
              position: 146602.965,
              speed: 83.33333333333333,
            },
            {
              position: 146602.965,
              speed: 83.33333333333333,
            },
            {
              position: 148279.965,
              speed: 83.33333333333333,
            },
            {
              position: 148279.965,
              speed: 83.33333333333333,
            },
            {
              position: 148319.965,
              speed: 83.33333333333333,
            },
            {
              position: 148319.965,
              speed: 83.33333333333333,
            },
            {
              position: 148945.965,
              speed: 83.33333333333333,
            },
            {
              position: 148945.965,
              speed: 83.33333333333333,
            },
            {
              position: 149283.965,
              speed: 83.33333333333333,
            },
            {
              position: 149283.965,
              speed: 83.33333333333333,
            },
            {
              position: 149323.965,
              speed: 83.33333333333333,
            },
            {
              position: 149323.965,
              speed: 83.33333333333333,
            },
            {
              position: 151085.965,
              speed: 83.33333333333333,
            },
            {
              position: 151085.965,
              speed: 83.33333333333333,
            },
            {
              position: 153316.965,
              speed: 83.33333333333333,
            },
            {
              position: 153316.965,
              speed: 83.33333333333333,
            },
            {
              position: 155693.965,
              speed: 83.33333333333333,
            },
            {
              position: 155693.965,
              speed: 83.33333333333333,
            },
            {
              position: 157928.965,
              speed: 83.33333333333333,
            },
            {
              position: 157928.965,
              speed: 83.33333333333333,
            },
            {
              position: 159754.965,
              speed: 83.33333333333333,
            },
            {
              position: 159754.965,
              speed: 83.33333333333333,
            },
            {
              position: 161590.965,
              speed: 83.33333333333333,
            },
            {
              position: 161590.965,
              speed: 83.33333333333333,
            },
            {
              position: 163491.965,
              speed: 83.33333333333333,
            },
            {
              position: 163491.965,
              speed: 83.33333333333333,
            },
            {
              position: 166348.965,
              speed: 83.33333333333333,
            },
            {
              position: 166348.965,
              speed: 83.33333333333333,
            },
            {
              position: 168818.965,
              speed: 83.33333333333333,
            },
            {
              position: 168818.965,
              speed: 83.33333333333333,
            },
            {
              position: 170892.965,
              speed: 83.33333333333333,
            },
            {
              position: 170892.965,
              speed: 83.33333333333333,
            },
            {
              position: 172121.965,
              speed: 83.33333333333333,
            },
            {
              position: 172121.965,
              speed: 83.33333333333333,
            },
            {
              position: 172201.965,
              speed: 83.33333333333333,
            },
            {
              position: 172201.965,
              speed: 83.33333333333333,
            },
            {
              position: 173001.965,
              speed: 83.33333333333333,
            },
            {
              position: 173001.965,
              speed: 83.33333333333333,
            },
            {
              position: 175240.965,
              speed: 83.33333333333333,
            },
            {
              position: 175240.965,
              speed: 83.33333333333333,
            },
            {
              position: 177510.965,
              speed: 83.33333333333333,
            },
            {
              position: 177510.965,
              speed: 83.33333333333333,
            },
            {
              position: 178970.965,
              speed: 83.33333333333333,
            },
            {
              position: 178970.965,
              speed: 83.33333333333333,
            },
            {
              position: 179011.965,
              speed: 83.33333333333333,
            },
            {
              position: 179011.965,
              speed: 61.11111111111111,
            },
            {
              position: 179935.965,
              speed: 61.11111111111111,
            },
            {
              position: 179935.965,
              speed: 61.11111111111111,
            },
            {
              position: 181333.965,
              speed: 61.11111111111111,
            },
            {
              position: 181333.965,
              speed: 61.11111111111111,
            },
            {
              position: 181568.965,
              speed: 61.11111111111111,
            },
            {
              position: 181568.965,
              speed: 61.11111111111111,
            },
            {
              position: 181688.965,
              speed: 61.11111111111111,
            },
            {
              position: 181688.965,
              speed: 61.11111111111111,
            },
            {
              position: 181898.965,
              speed: 61.11111111111111,
            },
            {
              position: 181898.965,
              speed: 61.11111111111111,
            },
            {
              position: 182191.965,
              speed: 61.11111111111111,
            },
            {
              position: 182191.965,
              speed: 61.11111111111111,
            },
            {
              position: 182260.965,
              speed: 61.11111111111111,
            },
            {
              position: 182260.965,
              speed: 61.11111111111111,
            },
            {
              position: 182488.965,
              speed: 61.11111111111111,
            },
            {
              position: 182488.965,
              speed: 61.11111111111111,
            },
            {
              position: 185298.965,
              speed: 61.11111111111111,
            },
            {
              position: 185298.965,
              speed: 61.11111111111111,
            },
            {
              position: 188618.965,
              speed: 61.11111111111111,
            },
            {
              position: 188618.965,
              speed: 61.11111111111111,
            },
            {
              position: 189798.965,
              speed: 61.11111111111111,
            },
            {
              position: 189798.965,
              speed: 61.11111111111111,
            },
            {
              position: 189998.965,
              speed: 61.11111111111111,
            },
            {
              position: 189998.965,
              speed: 61.11111111111111,
            },
            {
              position: 190262.965,
              speed: 61.11111111111111,
            },
            {
              position: 190262.965,
              speed: 61.11111111111111,
            },
            {
              position: 190396.965,
              speed: 61.11111111111111,
            },
            {
              position: 190396.965,
              speed: 61.11111111111111,
            },
            {
              position: 190866.965,
              speed: 61.11111111111111,
            },
            {
              position: 190866.965,
              speed: 61.11111111111111,
            },
            {
              position: 191951.965,
              speed: 61.11111111111111,
            },
            {
              position: 191951.965,
              speed: 61.11111111111111,
            },
            {
              position: 199088.965,
              speed: 61.11111111111111,
            },
            {
              position: 199088.965,
              speed: 61.11111111111111,
            },
            {
              position: 199294.965,
              speed: 61.11111111111111,
            },
            {
              position: 199294.965,
              speed: 61.11111111111111,
            },
            {
              position: 199308.965,
              speed: 61.11111111111111,
            },
            {
              position: 199308.965,
              speed: 61.11111111111111,
            },
            {
              position: 199406.965,
              speed: 61.11111111111111,
            },
            {
              position: 199406.965,
              speed: 38.888888888888886,
            },
            {
              position: 199505.965,
              speed: 38.888888888888886,
            },
            {
              position: 199505.965,
              speed: 44.44444444444444,
            },
            {
              position: 199992.965,
              speed: 44.44444444444444,
            },
            {
              position: 199992.965,
              speed: 44.44444444444444,
            },
            {
              position: 200175.965,
              speed: 44.44444444444444,
            },
            {
              position: 200175.965,
              speed: 44.44444444444444,
            },
            {
              position: 200186.965,
              speed: 44.44444444444444,
            },
            {
              position: 200186.965,
              speed: 44.44444444444444,
            },
            {
              position: 200230.965,
              speed: 44.44444444444444,
            },
            {
              position: 200230.965,
              speed: 44.44444444444444,
            },
            {
              position: 200308.965,
              speed: 44.44444444444444,
            },
            {
              position: 200308.965,
              speed: 27.77777777777778,
            },
            {
              position: 200434.965,
              speed: 27.77777777777778,
            },
            {
              position: 200434.965,
              speed: 27.77777777777778,
            },
            {
              position: 200659.965,
              speed: 27.77777777777778,
            },
            {
              position: 200659.965,
              speed: 27.77777777777778,
            },
            {
              position: 200671.965,
              speed: 27.77777777777778,
            },
            {
              position: 200671.965,
              speed: 27.77777777777778,
            },
            {
              position: 200683.965,
              speed: 27.77777777777778,
            },
            {
              position: 200683.965,
              speed: 27.77777777777778,
            },
            {
              position: 200754.965,
              speed: 27.77777777777778,
            },
            {
              position: 200754.965,
              speed: 27.77777777777778,
            },
            {
              position: 200952.965,
              speed: 27.77777777777778,
            },
            {
              position: 200952.965,
              speed: 27.77777777777778,
            },
            {
              position: 201408.607,
              speed: 27.77777777777778,
            },
          ],
          slopes: [
            {
              gradient: 0,
              position: 0,
            },
            {
              gradient: 0,
              position: 551.965,
            },
            {
              gradient: 7.7,
              position: 551.965,
            },
            {
              gradient: 7.7,
              position: 565.965,
            },
            {
              gradient: 4.1,
              position: 565.965,
            },
            {
              gradient: 4.1,
              position: 637.965,
            },
            {
              gradient: 0,
              position: 637.965,
            },
            {
              gradient: 0,
              position: 802.965,
            },
            {
              gradient: 3.3,
              position: 802.965,
            },
            {
              gradient: 3.3,
              position: 892.965,
            },
            {
              gradient: 0,
              position: 892.965,
            },
            {
              gradient: 0,
              position: 1365.965,
            },
            {
              gradient: 8.4,
              position: 1365.965,
            },
            {
              gradient: 8.4,
              position: 1565.965,
            },
            {
              gradient: 4.2,
              position: 1565.965,
            },
            {
              gradient: 4.2,
              position: 1724.965,
            },
            {
              gradient: 0,
              position: 1724.965,
            },
            {
              gradient: 0,
              position: 1772.965,
            },
            {
              gradient: 5,
              position: 1772.965,
            },
            {
              gradient: 5,
              position: 1905.965,
            },
            {
              gradient: 9.3,
              position: 1905.965,
            },
            {
              gradient: 9.3,
              position: 2015.965,
            },
            {
              gradient: 11.5,
              position: 2015.965,
            },
            {
              gradient: 11.5,
              position: 2487.965,
            },
            {
              gradient: 11.3,
              position: 2487.965,
            },
            {
              gradient: 11.3,
              position: 2776.965,
            },
            {
              gradient: 0,
              position: 2776.965,
            },
            {
              gradient: 0,
              position: 2891.965,
            },
            {
              gradient: 7.1,
              position: 2891.965,
            },
            {
              gradient: 7.1,
              position: 3157.965,
            },
            {
              gradient: 10,
              position: 3157.965,
            },
            {
              gradient: 10,
              position: 3367.965,
            },
            {
              gradient: 0,
              position: 3367.965,
            },
            {
              gradient: 0,
              position: 3494.965,
            },
            {
              gradient: 10,
              position: 3494.965,
            },
            {
              gradient: 10,
              position: 3892.965,
            },
            {
              gradient: 1.1,
              position: 3892.965,
            },
            {
              gradient: 1.1,
              position: 4144.965,
            },
            {
              gradient: 0.4,
              position: 4144.965,
            },
            {
              gradient: 0.4,
              position: 4429.965,
            },
            {
              gradient: 0.9,
              position: 4429.965,
            },
            {
              gradient: 0.9,
              position: 4706.965,
            },
            {
              gradient: 0.3,
              position: 4706.965,
            },
            {
              gradient: 0.3,
              position: 5034.965,
            },
            {
              gradient: 1.1,
              position: 5034.965,
            },
            {
              gradient: 1.1,
              position: 5571.965,
            },
            {
              gradient: 1.6,
              position: 5571.965,
            },
            {
              gradient: 1.6,
              position: 5743.965,
            },
            {
              gradient: 2,
              position: 5743.965,
            },
            {
              gradient: 2,
              position: 5775.965,
            },
            {
              gradient: 0,
              position: 5775.965,
            },
            {
              gradient: 0,
              position: 5993.965,
            },
            {
              gradient: -20,
              position: 5993.965,
            },
            {
              gradient: -20,
              position: 6460.965,
            },
            {
              gradient: 0,
              position: 6460.965,
            },
            {
              gradient: 0,
              position: 6557.965,
            },
            {
              gradient: -25,
              position: 6557.965,
            },
            {
              gradient: -25,
              position: 6991.965,
            },
            {
              gradient: 0,
              position: 6991.965,
            },
            {
              gradient: 0,
              position: 7273.965,
            },
            {
              gradient: 3,
              position: 7273.965,
            },
            {
              gradient: 3,
              position: 7702.965,
            },
            {
              gradient: 0,
              position: 7702.965,
            },
            {
              gradient: 0,
              position: 7920.965,
            },
            {
              gradient: 25,
              position: 7920.965,
            },
            {
              gradient: 25,
              position: 8029.965,
            },
            {
              gradient: 0,
              position: 8029.965,
            },
            {
              gradient: 0,
              position: 8209.965,
            },
            {
              gradient: 7,
              position: 8209.965,
            },
            {
              gradient: 7,
              position: 8331.965,
            },
            {
              gradient: 0,
              position: 8331.965,
            },
            {
              gradient: 0,
              position: 8457.965,
            },
            {
              gradient: 16,
              position: 8457.965,
            },
            {
              gradient: 16,
              position: 8877.965,
            },
            {
              gradient: 0,
              position: 8877.965,
            },
            {
              gradient: 0,
              position: 9189.965,
            },
            {
              gradient: -10,
              position: 9189.965,
            },
            {
              gradient: -10,
              position: 9332.965,
            },
            {
              gradient: 0,
              position: 9332.965,
            },
            {
              gradient: 0,
              position: 9490.965,
            },
            {
              gradient: 3,
              position: 9490.965,
            },
            {
              gradient: 3,
              position: 9782.965,
            },
            {
              gradient: 0,
              position: 9782.965,
            },
            {
              gradient: 0,
              position: 9848.965,
            },
            {
              gradient: 8.5,
              position: 9848.965,
            },
            {
              gradient: 8.5,
              position: 9978.965,
            },
            {
              gradient: 0,
              position: 9978.965,
            },
            {
              gradient: 0,
              position: 10346.965,
            },
            {
              gradient: -14.5,
              position: 10346.965,
            },
            {
              gradient: -14.5,
              position: 10618.965,
            },
            {
              gradient: 0,
              position: 10618.965,
            },
            {
              gradient: 0,
              position: 10690.965,
            },
            {
              gradient: -10,
              position: 10690.965,
            },
            {
              gradient: -10,
              position: 11647.965,
            },
            {
              gradient: 0,
              position: 11647.965,
            },
            {
              gradient: 0,
              position: 11759.965,
            },
            {
              gradient: -3.1,
              position: 11759.965,
            },
            {
              gradient: -3.1,
              position: 12015.965,
            },
            {
              gradient: 0,
              position: 12015.965,
            },
            {
              gradient: 0,
              position: 12115.965,
            },
            {
              gradient: 2,
              position: 12115.965,
            },
            {
              gradient: 2,
              position: 12358.965,
            },
            {
              gradient: 0,
              position: 12358.965,
            },
            {
              gradient: 0,
              position: 12502.965,
            },
            {
              gradient: 14,
              position: 12502.965,
            },
            {
              gradient: 14,
              position: 13084.965,
            },
            {
              gradient: 0,
              position: 13084.965,
            },
            {
              gradient: 0,
              position: 13258.965,
            },
            {
              gradient: -0.5,
              position: 13258.965,
            },
            {
              gradient: -0.5,
              position: 14550.965,
            },
            {
              gradient: 0,
              position: 14550.965,
            },
            {
              gradient: 0,
              position: 14724.965,
            },
            {
              gradient: -15,
              position: 14724.965,
            },
            {
              gradient: -15,
              position: 14886.965,
            },
            {
              gradient: 0,
              position: 14886.965,
            },
            {
              gradient: 0,
              position: 14976.965,
            },
            {
              gradient: -12,
              position: 14976.965,
            },
            {
              gradient: -12,
              position: 15383.965,
            },
            {
              gradient: 0,
              position: 15383.965,
            },
            {
              gradient: 0,
              position: 15479.965,
            },
            {
              gradient: -4,
              position: 15479.965,
            },
            {
              gradient: -4,
              position: 15854.965,
            },
            {
              gradient: 0,
              position: 15854.965,
            },
            {
              gradient: 0,
              position: 15944.965,
            },
            {
              gradient: -1,
              position: 15944.965,
            },
            {
              gradient: -1,
              position: 16126.965,
            },
            {
              gradient: 0,
              position: 16126.965,
            },
            {
              gradient: 0,
              position: 16322.965,
            },
            {
              gradient: 13,
              position: 16322.965,
            },
            {
              gradient: 13,
              position: 16557.965,
            },
            {
              gradient: 0,
              position: 16557.965,
            },
            {
              gradient: 0,
              position: 16637.965,
            },
            {
              gradient: 15,
              position: 16637.965,
            },
            {
              gradient: 15,
              position: 17659.965,
            },
            {
              gradient: 0,
              position: 17659.965,
            },
            {
              gradient: 0,
              position: 17784.965,
            },
            {
              gradient: 20,
              position: 17784.965,
            },
            {
              gradient: 20,
              position: 18035.965,
            },
            {
              gradient: 20.6,
              position: 18035.965,
            },
            {
              gradient: 20.6,
              position: 18135.965,
            },
            {
              gradient: 20,
              position: 18135.965,
            },
            {
              gradient: 20,
              position: 18743.965,
            },
            {
              gradient: 0,
              position: 18743.965,
            },
            {
              gradient: 0,
              position: 19068.965,
            },
            {
              gradient: 7,
              position: 19068.965,
            },
            {
              gradient: 7,
              position: 20600.965,
            },
            {
              gradient: 0,
              position: 20600.965,
            },
            {
              gradient: 0,
              position: 20850.965,
            },
            {
              gradient: -3,
              position: 20850.965,
            },
            {
              gradient: -3,
              position: 23000.965,
            },
            {
              gradient: 0,
              position: 23000.965,
            },
            {
              gradient: 0,
              position: 23080.965,
            },
            {
              gradient: -6.2,
              position: 23080.965,
            },
            {
              gradient: -6.2,
              position: 23311.965,
            },
            {
              gradient: 0,
              position: 23311.965,
            },
            {
              gradient: 0,
              position: 23811.965,
            },
            {
              gradient: 25,
              position: 23811.965,
            },
            {
              gradient: 25,
              position: 24561.965,
            },
            {
              gradient: 0,
              position: 24561.965,
            },
            {
              gradient: 0,
              position: 24831.965,
            },
            {
              gradient: 11.5,
              position: 24831.965,
            },
            {
              gradient: 11.5,
              position: 25494.965,
            },
            {
              gradient: 0,
              position: 25494.965,
            },
            {
              gradient: 0,
              position: 25768.965,
            },
            {
              gradient: 11.5,
              position: 25768.965,
            },
            {
              gradient: 11.5,
              position: 26573.965,
            },
            {
              gradient: 0,
              position: 26573.965,
            },
            {
              gradient: 0,
              position: 26869.965,
            },
            {
              gradient: -7,
              position: 26869.965,
            },
            {
              gradient: -7,
              position: 27033.965,
            },
            {
              gradient: 0,
              position: 27033.965,
            },
            {
              gradient: 0,
              position: 27113.965,
            },
            {
              gradient: -5,
              position: 27113.965,
            },
            {
              gradient: -5,
              position: 27806.965,
            },
            {
              gradient: 0,
              position: 27806.965,
            },
            {
              gradient: 0,
              position: 28046.965,
            },
            {
              gradient: -20,
              position: 28046.965,
            },
            {
              gradient: -20,
              position: 28759.965,
            },
            {
              gradient: 0,
              position: 28759.965,
            },
            {
              gradient: 0,
              position: 28884.965,
            },
            {
              gradient: -25,
              position: 28884.965,
            },
            {
              gradient: -25,
              position: 29483.965,
            },
            {
              gradient: 0,
              position: 29483.965,
            },
            {
              gradient: 0,
              position: 29623.965,
            },
            {
              gradient: -18,
              position: 29623.965,
            },
            {
              gradient: -18,
              position: 30558.965,
            },
            {
              gradient: 0,
              position: 30558.965,
            },
            {
              gradient: 0,
              position: 31508.965,
            },
            {
              gradient: 20,
              position: 31508.965,
            },
            {
              gradient: 20,
              position: 32233.965,
            },
            {
              gradient: 0,
              position: 32233.965,
            },
            {
              gradient: 0,
              position: 32808.965,
            },
            {
              gradient: -3,
              position: 32808.965,
            },
            {
              gradient: -3,
              position: 34958.965,
            },
            {
              gradient: 0,
              position: 34958.965,
            },
            {
              gradient: 0,
              position: 35326.965,
            },
            {
              gradient: 20,
              position: 35326.965,
            },
            {
              gradient: 20,
              position: 35523.965,
            },
            {
              gradient: 0,
              position: 35523.965,
            },
            {
              gradient: 0,
              position: 35603.965,
            },
            {
              gradient: 25,
              position: 35603.965,
            },
            {
              gradient: 25,
              position: 36252.965,
            },
            {
              gradient: 0,
              position: 36252.965,
            },
            {
              gradient: 0,
              position: 37052.965,
            },
            {
              gradient: -25,
              position: 37052.965,
            },
            {
              gradient: -25,
              position: 38579.965,
            },
            {
              gradient: 0,
              position: 38579.965,
            },
            {
              gradient: 0,
              position: 39129.965,
            },
            {
              gradient: -3,
              position: 39129.965,
            },
            {
              gradient: -3,
              position: 39846.965,
            },
            {
              gradient: 0,
              position: 39846.965,
            },
            {
              gradient: 0,
              position: 39946.965,
            },
            {
              gradient: 1,
              position: 39946.965,
            },
            {
              gradient: 1,
              position: 40421.965,
            },
            {
              gradient: 0,
              position: 40421.965,
            },
            {
              gradient: 0,
              position: 40821.965,
            },
            {
              gradient: 17,
              position: 40821.965,
            },
            {
              gradient: 17,
              position: 41905.965,
            },
            {
              gradient: 0,
              position: 41905.965,
            },
            {
              gradient: 0,
              position: 42105.965,
            },
            {
              gradient: 25,
              position: 42105.965,
            },
            {
              gradient: 25,
              position: 42670.965,
            },
            {
              gradient: 0,
              position: 42670.965,
            },
            {
              gradient: 0,
              position: 42895.965,
            },
            {
              gradient: 16,
              position: 42895.965,
            },
            {
              gradient: 16,
              position: 44526.965,
            },
            {
              gradient: 0,
              position: 44526.965,
            },
            {
              gradient: 0,
              position: 45201.965,
            },
            {
              gradient: -11,
              position: 45201.965,
            },
            {
              gradient: -11,
              position: 46232.965,
            },
            {
              gradient: -10,
              position: 46232.965,
            },
            {
              gradient: -10,
              position: 46837.965,
            },
            {
              gradient: 0,
              position: 46837.965,
            },
            {
              gradient: 0,
              position: 47437.965,
            },
            {
              gradient: 14,
              position: 47437.965,
            },
            {
              gradient: 14,
              position: 47904.965,
            },
            {
              gradient: 0,
              position: 47904.965,
            },
            {
              gradient: 0,
              position: 48379.965,
            },
            {
              gradient: -5,
              position: 48379.965,
            },
            {
              gradient: -5,
              position: 48864.965,
            },
            {
              gradient: 0,
              position: 48864.965,
            },
            {
              gradient: 0,
              position: 49014.965,
            },
            {
              gradient: 1,
              position: 49014.965,
            },
            {
              gradient: 1,
              position: 50045.965,
            },
            {
              gradient: 0,
              position: 50045.965,
            },
            {
              gradient: 0,
              position: 50255.965,
            },
            {
              gradient: 16,
              position: 50255.965,
            },
            {
              gradient: 16,
              position: 50435.965,
            },
            {
              gradient: 0,
              position: 50435.965,
            },
            {
              gradient: 0,
              position: 50931.965,
            },
            {
              gradient: -15,
              position: 50931.965,
            },
            {
              gradient: -15,
              position: 51445.965,
            },
            {
              gradient: 0,
              position: 51445.965,
            },
            {
              gradient: 0,
              position: 51669.965,
            },
            {
              gradient: 1,
              position: 51669.965,
            },
            {
              gradient: 1,
              position: 55391.965,
            },
            {
              gradient: 2,
              position: 55391.965,
            },
            {
              gradient: 2,
              position: 56425.965,
            },
            {
              gradient: 0,
              position: 56425.965,
            },
            {
              gradient: 0,
              position: 56510.965,
            },
            {
              gradient: -1.4,
              position: 56510.965,
            },
            {
              gradient: -1.4,
              position: 58009.965,
            },
            {
              gradient: 0,
              position: 58009.965,
            },
            {
              gradient: 0,
              position: 58162.965,
            },
            {
              gradient: -7.6,
              position: 58162.965,
            },
            {
              gradient: -7.6,
              position: 58733.965,
            },
            {
              gradient: 0,
              position: 58733.965,
            },
            {
              gradient: 0,
              position: 58885.965,
            },
            {
              gradient: -1.5,
              position: 58885.965,
            },
            {
              gradient: -1.5,
              position: 59237.965,
            },
            {
              gradient: 0,
              position: 59237.965,
            },
            {
              gradient: 0,
              position: 59312.965,
            },
            {
              gradient: 1.5,
              position: 59312.965,
            },
            {
              gradient: 1.5,
              position: 59689.965,
            },
            {
              gradient: 0,
              position: 59689.965,
            },
            {
              gradient: 0,
              position: 59777.965,
            },
            {
              gradient: -2,
              position: 59777.965,
            },
            {
              gradient: -2,
              position: 61117.965,
            },
            {
              gradient: 0,
              position: 61117.965,
            },
            {
              gradient: 0,
              position: 61442.965,
            },
            {
              gradient: -15,
              position: 61442.965,
            },
            {
              gradient: -15,
              position: 61589.965,
            },
            {
              gradient: 0,
              position: 61589.965,
            },
            {
              gradient: 0,
              position: 61814.965,
            },
            {
              gradient: -6,
              position: 61814.965,
            },
            {
              gradient: -6,
              position: 62096.965,
            },
            {
              gradient: 0,
              position: 62096.965,
            },
            {
              gradient: 0,
              position: 62346.965,
            },
            {
              gradient: 4,
              position: 62346.965,
            },
            {
              gradient: 4,
              position: 62507.965,
            },
            {
              gradient: 0,
              position: 62507.965,
            },
            {
              gradient: 0,
              position: 62745.965,
            },
            {
              gradient: 13.5,
              position: 62745.965,
            },
            {
              gradient: 13.5,
              position: 62865.965,
            },
            {
              gradient: 0,
              position: 62865.965,
            },
            {
              gradient: 0,
              position: 63077.965,
            },
            {
              gradient: 5,
              position: 63077.965,
            },
            {
              gradient: 5,
              position: 65498.965,
            },
            {
              gradient: 0,
              position: 65498.965,
            },
            {
              gradient: 0,
              position: 65648.965,
            },
            {
              gradient: -1,
              position: 65648.965,
            },
            {
              gradient: -1,
              position: 66069.965,
            },
            {
              gradient: 0,
              position: 66069.965,
            },
            {
              gradient: 0,
              position: 66344.965,
            },
            {
              gradient: -1,
              position: 66344.965,
            },
            {
              gradient: -1,
              position: 66384.965,
            },
            {
              gradient: 0,
              position: 66384.965,
            },
            {
              gradient: 0,
              position: 67349.965,
            },
            {
              gradient: -1,
              position: 67349.965,
            },
            {
              gradient: -1,
              position: 67389.965,
            },
            {
              gradient: 0,
              position: 67389.965,
            },
            {
              gradient: 0,
              position: 67664.965,
            },
            {
              gradient: -1,
              position: 67664.965,
            },
            {
              gradient: -1,
              position: 67993.965,
            },
            {
              gradient: 0,
              position: 67993.965,
            },
            {
              gradient: 0,
              position: 68193.965,
            },
            {
              gradient: -9,
              position: 68193.965,
            },
            {
              gradient: -9,
              position: 68577.965,
            },
            {
              gradient: 0,
              position: 68577.965,
            },
            {
              gradient: 0,
              position: 68702.965,
            },
            {
              gradient: -4,
              position: 68702.965,
            },
            {
              gradient: -4,
              position: 69075.965,
            },
            {
              gradient: 0,
              position: 69075.965,
            },
            {
              gradient: 0,
              position: 69337.965,
            },
            {
              gradient: 6.5,
              position: 69337.965,
            },
            {
              gradient: 6.5,
              position: 69709.965,
            },
            {
              gradient: 0,
              position: 69709.965,
            },
            {
              gradient: 0,
              position: 69971.965,
            },
            {
              gradient: -4,
              position: 69971.965,
            },
            {
              gradient: -4,
              position: 70131.965,
            },
            {
              gradient: 0,
              position: 70131.965,
            },
            {
              gradient: 0,
              position: 70269.965,
            },
            {
              gradient: 1.5,
              position: 70269.965,
            },
            {
              gradient: 1.5,
              position: 70625.965,
            },
            {
              gradient: 0,
              position: 70625.965,
            },
            {
              gradient: 0,
              position: 70765.965,
            },
            {
              gradient: -2,
              position: 70765.965,
            },
            {
              gradient: -2,
              position: 71235.965,
            },
            {
              gradient: 0,
              position: 71235.965,
            },
            {
              gradient: 0,
              position: 71435.965,
            },
            {
              gradient: 3,
              position: 71435.965,
            },
            {
              gradient: 3,
              position: 72930.965,
            },
            {
              gradient: 0,
              position: 72930.965,
            },
            {
              gradient: 0,
              position: 73110.965,
            },
            {
              gradient: -1.5,
              position: 73110.965,
            },
            {
              gradient: -1.5,
              position: 73784.965,
            },
            {
              gradient: 0,
              position: 73784.965,
            },
            {
              gradient: 0,
              position: 73904.965,
            },
            {
              gradient: 1.5,
              position: 73904.965,
            },
            {
              gradient: 1.5,
              position: 74459.965,
            },
            {
              gradient: 0,
              position: 74459.965,
            },
            {
              gradient: 0,
              position: 74619.965,
            },
            {
              gradient: -2.5,
              position: 74619.965,
            },
            {
              gradient: -2.5,
              position: 76032.965,
            },
            {
              gradient: 0,
              position: 76032.965,
            },
            {
              gradient: 0,
              position: 76212.965,
            },
            {
              gradient: 2,
              position: 76212.965,
            },
            {
              gradient: 2,
              position: 76752.965,
            },
            {
              gradient: 0,
              position: 76752.965,
            },
            {
              gradient: 0,
              position: 76912.965,
            },
            {
              gradient: -2,
              position: 76912.965,
            },
            {
              gradient: -2,
              position: 77266.965,
            },
            {
              gradient: 0,
              position: 77266.965,
            },
            {
              gradient: 0,
              position: 77426.965,
            },
            {
              gradient: 2,
              position: 77426.965,
            },
            {
              gradient: 2,
              position: 77800.965,
            },
            {
              gradient: 0,
              position: 77800.965,
            },
            {
              gradient: 0,
              position: 77920.965,
            },
            {
              gradient: -1,
              position: 77920.965,
            },
            {
              gradient: -1,
              position: 78737.965,
            },
            {
              gradient: 0,
              position: 78737.965,
            },
            {
              gradient: 0,
              position: 78777.965,
            },
            {
              gradient: -2,
              position: 78777.965,
            },
            {
              gradient: -2,
              position: 80953.965,
            },
            {
              gradient: 0,
              position: 80953.965,
            },
            {
              gradient: 0,
              position: 81203.965,
            },
            {
              gradient: 8,
              position: 81203.965,
            },
            {
              gradient: 8,
              position: 81906.965,
            },
            {
              gradient: 0,
              position: 81906.965,
            },
            {
              gradient: 0,
              position: 82810.965,
            },
            {
              gradient: -10,
              position: 82810.965,
            },
            {
              gradient: -10,
              position: 83352.965,
            },
            {
              gradient: 0,
              position: 83352.965,
            },
            {
              gradient: 0,
              position: 83794.965,
            },
            {
              gradient: 7.7,
              position: 83794.965,
            },
            {
              gradient: 7.7,
              position: 84792.965,
            },
            {
              gradient: 0,
              position: 84792.965,
            },
            {
              gradient: 0,
              position: 85034.965,
            },
            {
              gradient: -2,
              position: 85034.965,
            },
            {
              gradient: -2,
              position: 86877.965,
            },
            {
              gradient: 0,
              position: 86877.965,
            },
            {
              gradient: 0,
              position: 86997.965,
            },
            {
              gradient: -5,
              position: 86997.965,
            },
            {
              gradient: -5,
              position: 87809.965,
            },
            {
              gradient: 0,
              position: 87809.965,
            },
            {
              gradient: 0,
              position: 88089.965,
            },
            {
              gradient: 2,
              position: 88089.965,
            },
            {
              gradient: 2,
              position: 88589.965,
            },
            {
              gradient: 0,
              position: 88589.965,
            },
            {
              gradient: 0,
              position: 88749.965,
            },
            {
              gradient: -2,
              position: 88749.965,
            },
            {
              gradient: -2,
              position: 89005.965,
            },
            {
              gradient: 0,
              position: 89005.965,
            },
            {
              gradient: 0,
              position: 89065.965,
            },
            {
              gradient: -0.5,
              position: 89065.965,
            },
            {
              gradient: -0.5,
              position: 90087.965,
            },
            {
              gradient: 0,
              position: 90087.965,
            },
            {
              gradient: 0,
              position: 90335.965,
            },
            {
              gradient: 5.7,
              position: 90335.965,
            },
            {
              gradient: 5.7,
              position: 90845.965,
            },
            {
              gradient: 0,
              position: 90845.965,
            },
            {
              gradient: 0,
              position: 91215.965,
            },
            {
              gradient: -5,
              position: 91215.965,
            },
            {
              gradient: -5,
              position: 92361.965,
            },
            {
              gradient: 0,
              position: 92361.965,
            },
            {
              gradient: 0,
              position: 92598.965,
            },
            {
              gradient: 4.5,
              position: 92598.965,
            },
            {
              gradient: 4.5,
              position: 92886.965,
            },
            {
              gradient: 0,
              position: 92886.965,
            },
            {
              gradient: 0,
              position: 93073.965,
            },
            {
              gradient: -3,
              position: 93073.965,
            },
            {
              gradient: -3,
              position: 93439.965,
            },
            {
              gradient: 0,
              position: 93439.965,
            },
            {
              gradient: 0,
              position: 93719.965,
            },
            {
              gradient: 4,
              position: 93719.965,
            },
            {
              gradient: 4,
              position: 94304.965,
            },
            {
              gradient: 0,
              position: 94304.965,
            },
            {
              gradient: 0,
              position: 94504.965,
            },
            {
              gradient: -4,
              position: 94504.965,
            },
            {
              gradient: -4,
              position: 95828.965,
            },
            {
              gradient: 0,
              position: 95828.965,
            },
            {
              gradient: 0,
              position: 95953.965,
            },
            {
              gradient: 1,
              position: 95953.965,
            },
            {
              gradient: 1,
              position: 96910.965,
            },
            {
              gradient: 0,
              position: 96910.965,
            },
            {
              gradient: 0,
              position: 97110.965,
            },
            {
              gradient: 6,
              position: 97110.965,
            },
            {
              gradient: 6,
              position: 97483.965,
            },
            {
              gradient: 0,
              position: 97483.965,
            },
            {
              gradient: 0,
              position: 97758.965,
            },
            {
              gradient: -5,
              position: 97758.965,
            },
            {
              gradient: -5,
              position: 98540.965,
            },
            {
              gradient: 0,
              position: 98540.965,
            },
            {
              gradient: 0,
              position: 99141.965,
            },
            {
              gradient: -2.5,
              position: 99141.965,
            },
            {
              gradient: -2.5,
              position: 99731.965,
            },
            {
              gradient: 0,
              position: 99731.965,
            },
            {
              gradient: 0,
              position: 99951.965,
            },
            {
              gradient: 3,
              position: 99951.965,
            },
            {
              gradient: 3,
              position: 100554.965,
            },
            {
              gradient: 0,
              position: 100554.965,
            },
            {
              gradient: 0,
              position: 101022.965,
            },
            {
              gradient: -4,
              position: 101022.965,
            },
            {
              gradient: -4,
              position: 101391.965,
            },
            {
              gradient: 0,
              position: 101391.965,
            },
            {
              gradient: 0,
              position: 101471.965,
            },
            {
              gradient: -2,
              position: 101471.965,
            },
            {
              gradient: -2,
              position: 103763.965,
            },
            {
              gradient: 0,
              position: 103763.965,
            },
            {
              gradient: 0,
              position: 104025.965,
            },
            {
              gradient: 8.5,
              position: 104025.965,
            },
            {
              gradient: 8.5,
              position: 104327.965,
            },
            {
              gradient: 0,
              position: 104327.965,
            },
            {
              gradient: 0,
              position: 104827.965,
            },
            {
              gradient: -11.5,
              position: 104827.965,
            },
            {
              gradient: -11.5,
              position: 105048.965,
            },
            {
              gradient: 0,
              position: 105048.965,
            },
            {
              gradient: 0,
              position: 105286.965,
            },
            {
              gradient: -2,
              position: 105286.965,
            },
            {
              gradient: -2,
              position: 106852.965,
            },
            {
              gradient: 0,
              position: 106852.965,
            },
            {
              gradient: 0,
              position: 107127.965,
            },
            {
              gradient: 9,
              position: 107127.965,
            },
            {
              gradient: 9,
              position: 108119.965,
            },
            {
              gradient: 0,
              position: 108119.965,
            },
            {
              gradient: 0,
              position: 108294.965,
            },
            {
              gradient: 2,
              position: 108294.965,
            },
            {
              gradient: 2,
              position: 108562.965,
            },
            {
              gradient: 0,
              position: 108562.965,
            },
            {
              gradient: 0,
              position: 108787.965,
            },
            {
              gradient: 11,
              position: 108787.965,
            },
            {
              gradient: 11,
              position: 109810.965,
            },
            {
              gradient: 0,
              position: 109810.965,
            },
            {
              gradient: 0,
              position: 110035.965,
            },
            {
              gradient: 20,
              position: 110035.965,
            },
            {
              gradient: 20,
              position: 110958.965,
            },
            {
              gradient: 0,
              position: 110958.965,
            },
            {
              gradient: 0,
              position: 111508.965,
            },
            {
              gradient: -2,
              position: 111508.965,
            },
            {
              gradient: -2,
              position: 112521.965,
            },
            {
              gradient: -1,
              position: 112521.965,
            },
            {
              gradient: -1,
              position: 114320.965,
            },
            {
              gradient: 0,
              position: 114320.965,
            },
            {
              gradient: 0,
              position: 114520.965,
            },
            {
              gradient: -9,
              position: 114520.965,
            },
            {
              gradient: -9,
              position: 115000.965,
            },
            {
              gradient: 0,
              position: 115000.965,
            },
            {
              gradient: 0,
              position: 115150.965,
            },
            {
              gradient: -3,
              position: 115150.965,
            },
            {
              gradient: -3,
              position: 115335.965,
            },
            {
              gradient: 0,
              position: 115335.965,
            },
            {
              gradient: 0,
              position: 115825.965,
            },
            {
              gradient: 2,
              position: 115825.965,
            },
            {
              gradient: 2,
              position: 115997.965,
            },
            {
              gradient: 0,
              position: 115997.965,
            },
            {
              gradient: 0,
              position: 116147.965,
            },
            {
              gradient: -4,
              position: 116147.965,
            },
            {
              gradient: -4,
              position: 116491.965,
            },
            {
              gradient: 0,
              position: 116491.965,
            },
            {
              gradient: 0,
              position: 116691.965,
            },
            {
              gradient: 4,
              position: 116691.965,
            },
            {
              gradient: 4,
              position: 117119.965,
            },
            {
              gradient: 0,
              position: 117119.965,
            },
            {
              gradient: 0,
              position: 117269.965,
            },
            {
              gradient: -2,
              position: 117269.965,
            },
            {
              gradient: -2,
              position: 118651.965,
            },
            {
              gradient: 0,
              position: 118651.965,
            },
            {
              gradient: 0,
              position: 118751.965,
            },
            {
              gradient: 2,
              position: 118751.965,
            },
            {
              gradient: 2,
              position: 119642.965,
            },
            {
              gradient: 0,
              position: 119642.965,
            },
            {
              gradient: 0,
              position: 119742.965,
            },
            {
              gradient: -2,
              position: 119742.965,
            },
            {
              gradient: -2,
              position: 120276.965,
            },
            {
              gradient: 0,
              position: 120276.965,
            },
            {
              gradient: 0,
              position: 120451.965,
            },
            {
              gradient: -9,
              position: 120451.965,
            },
            {
              gradient: -9,
              position: 120968.965,
            },
            {
              gradient: 0,
              position: 120968.965,
            },
            {
              gradient: 0,
              position: 121243.965,
            },
            {
              gradient: 2,
              position: 121243.965,
            },
            {
              gradient: 2,
              position: 122529.965,
            },
            {
              gradient: 0,
              position: 122529.965,
            },
            {
              gradient: 0,
              position: 122654.965,
            },
            {
              gradient: -3,
              position: 122654.965,
            },
            {
              gradient: -3,
              position: 123012.965,
            },
            {
              gradient: 0,
              position: 123012.965,
            },
            {
              gradient: 0,
              position: 123152.965,
            },
            {
              gradient: -6.5,
              position: 123152.965,
            },
            {
              gradient: -6.5,
              position: 123577.965,
            },
            {
              gradient: 0,
              position: 123577.965,
            },
            {
              gradient: 0,
              position: 123789.965,
            },
            {
              gradient: 2,
              position: 123789.965,
            },
            {
              gradient: 2,
              position: 124578.965,
            },
            {
              gradient: 0,
              position: 124578.965,
            },
            {
              gradient: 0,
              position: 124753.965,
            },
            {
              gradient: -5,
              position: 124753.965,
            },
            {
              gradient: -5,
              position: 125412.965,
            },
            {
              gradient: -4,
              position: 125412.965,
            },
            {
              gradient: -4,
              position: 126287.965,
            },
            {
              gradient: 0,
              position: 126287.965,
            },
            {
              gradient: 0,
              position: 126537.965,
            },
            {
              gradient: 6,
              position: 126537.965,
            },
            {
              gradient: 6,
              position: 126751.965,
            },
            {
              gradient: 7,
              position: 126751.965,
            },
            {
              gradient: 7,
              position: 127135.965,
            },
            {
              gradient: 8,
              position: 127135.965,
            },
            {
              gradient: 8,
              position: 127652.965,
            },
            {
              gradient: 0,
              position: 127652.965,
            },
            {
              gradient: 0,
              position: 128452.965,
            },
            {
              gradient: -24,
              position: 128452.965,
            },
            {
              gradient: -24,
              position: 128625.965,
            },
            {
              gradient: 0,
              position: 128625.965,
            },
            {
              gradient: 0,
              position: 129431.965,
            },
            {
              gradient: 7.5,
              position: 129431.965,
            },
            {
              gradient: 7.5,
              position: 130675.965,
            },
            {
              gradient: 6.5,
              position: 130675.965,
            },
            {
              gradient: 6.5,
              position: 130900.965,
            },
            {
              gradient: 0,
              position: 130900.965,
            },
            {
              gradient: 0,
              position: 130902.965,
            },
            {
              gradient: -2,
              position: 130902.965,
            },
            {
              gradient: -2,
              position: 131626.965,
            },
            {
              gradient: 0,
              position: 131626.965,
            },
            {
              gradient: 0,
              position: 131826.965,
            },
            {
              gradient: 3,
              position: 131826.965,
            },
            {
              gradient: 3,
              position: 132297.965,
            },
            {
              gradient: 0,
              position: 132297.965,
            },
            {
              gradient: 0,
              position: 132447.965,
            },
            {
              gradient: -3,
              position: 132447.965,
            },
            {
              gradient: -3,
              position: 132861.965,
            },
            {
              gradient: 0,
              position: 132861.965,
            },
            {
              gradient: 0,
              position: 133931.965,
            },
            {
              gradient: 2,
              position: 133931.965,
            },
            {
              gradient: 2,
              position: 134706.965,
            },
            {
              gradient: 0,
              position: 134706.965,
            },
            {
              gradient: 0,
              position: 134856.965,
            },
            {
              gradient: 8,
              position: 134856.965,
            },
            {
              gradient: 8,
              position: 135340.965,
            },
            {
              gradient: 0,
              position: 135340.965,
            },
            {
              gradient: 0,
              position: 135765.965,
            },
            {
              gradient: 25,
              position: 135765.965,
            },
            {
              gradient: 25,
              position: 136318.965,
            },
            {
              gradient: 0,
              position: 136318.965,
            },
            {
              gradient: 0,
              position: 137058.965,
            },
            {
              gradient: -12,
              position: 137058.965,
            },
            {
              gradient: -12,
              position: 137501.965,
            },
            {
              gradient: 0,
              position: 137501.965,
            },
            {
              gradient: 0,
              position: 138161.965,
            },
            {
              gradient: 6,
              position: 138161.965,
            },
            {
              gradient: 6,
              position: 138952.965,
            },
            {
              gradient: 0,
              position: 138952.965,
            },
            {
              gradient: 0,
              position: 139152.965,
            },
            {
              gradient: -2,
              position: 139152.965,
            },
            {
              gradient: -2,
              position: 140294.965,
            },
            {
              gradient: 0,
              position: 140294.965,
            },
            {
              gradient: 0,
              position: 140374.965,
            },
            {
              gradient: -4,
              position: 140374.965,
            },
            {
              gradient: -4,
              position: 140699.965,
            },
            {
              gradient: 0,
              position: 140699.965,
            },
            {
              gradient: 0,
              position: 140849.965,
            },
            {
              gradient: 2,
              position: 140849.965,
            },
            {
              gradient: 2,
              position: 141637.965,
            },
            {
              gradient: 0,
              position: 141637.965,
            },
            {
              gradient: 0,
              position: 141797.965,
            },
            {
              gradient: -2,
              position: 141797.965,
            },
            {
              gradient: -2,
              position: 142241.965,
            },
            {
              gradient: 0,
              position: 142241.965,
            },
            {
              gradient: 0,
              position: 142566.965,
            },
            {
              gradient: -15,
              position: 142566.965,
            },
            {
              gradient: -15,
              position: 143079.965,
            },
            {
              gradient: 0,
              position: 143079.965,
            },
            {
              gradient: 0,
              position: 143404.965,
            },
            {
              gradient: -2,
              position: 143404.965,
            },
            {
              gradient: -2,
              position: 144116.965,
            },
            {
              gradient: 0,
              position: 144116.965,
            },
            {
              gradient: 0,
              position: 144241.965,
            },
            {
              gradient: 3,
              position: 144241.965,
            },
            {
              gradient: 3,
              position: 145182.965,
            },
            {
              gradient: 0,
              position: 145182.965,
            },
            {
              gradient: 0,
              position: 145307.965,
            },
            {
              gradient: -2,
              position: 145307.965,
            },
            {
              gradient: -2,
              position: 146320.965,
            },
            {
              gradient: -1,
              position: 146320.965,
            },
            {
              gradient: -1,
              position: 146935.965,
            },
            {
              gradient: 0,
              position: 146935.965,
            },
            {
              gradient: 0,
              position: 146972.965,
            },
            {
              gradient: 0.5,
              position: 146972.965,
            },
            {
              gradient: 0.5,
              position: 147328.965,
            },
            {
              gradient: 0,
              position: 147328.965,
            },
            {
              gradient: 0,
              position: 147416.965,
            },
            {
              gradient: -3,
              position: 147416.965,
            },
            {
              gradient: -3,
              position: 147661.965,
            },
            {
              gradient: 0,
              position: 147661.965,
            },
            {
              gradient: 0,
              position: 147711.965,
            },
            {
              gradient: -1,
              position: 147711.965,
            },
            {
              gradient: -1,
              position: 149697.965,
            },
            {
              gradient: 0,
              position: 149697.965,
            },
            {
              gradient: 0,
              position: 149772.965,
            },
            {
              gradient: -4,
              position: 149772.965,
            },
            {
              gradient: -4,
              position: 150943.965,
            },
            {
              gradient: 0,
              position: 150943.965,
            },
            {
              gradient: 0,
              position: 151093.965,
            },
            {
              gradient: 2,
              position: 151093.965,
            },
            {
              gradient: 2,
              position: 151951.965,
            },
            {
              gradient: 0,
              position: 151951.965,
            },
            {
              gradient: 0,
              position: 152226.965,
            },
            {
              gradient: -9,
              position: 152226.965,
            },
            {
              gradient: -9,
              position: 153832.965,
            },
            {
              gradient: 0,
              position: 153832.965,
            },
            {
              gradient: 0,
              position: 153932.965,
            },
            {
              gradient: -11.5,
              position: 153932.965,
            },
            {
              gradient: -11.5,
              position: 154657.965,
            },
            {
              gradient: 0,
              position: 154657.965,
            },
            {
              gradient: 0,
              position: 154757.965,
            },
            {
              gradient: -7.5,
              position: 154757.965,
            },
            {
              gradient: -7.5,
              position: 155637.965,
            },
            {
              gradient: 0,
              position: 155637.965,
            },
            {
              gradient: 0,
              position: 155737.965,
            },
            {
              gradient: -5,
              position: 155737.965,
            },
            {
              gradient: -5,
              position: 156477.965,
            },
            {
              gradient: -6,
              position: 156477.965,
            },
            {
              gradient: -6,
              position: 157691.965,
            },
            {
              gradient: 0,
              position: 157691.965,
            },
            {
              gradient: 0,
              position: 159021.965,
            },
            {
              gradient: 20,
              position: 159021.965,
            },
            {
              gradient: 20,
              position: 159410.965,
            },
            {
              gradient: 0,
              position: 159410.965,
            },
            {
              gradient: 0,
              position: 159810.965,
            },
            {
              gradient: 4,
              position: 159810.965,
            },
            {
              gradient: 4,
              position: 160851.965,
            },
            {
              gradient: 0,
              position: 160851.965,
            },
            {
              gradient: 0,
              position: 161251.965,
            },
            {
              gradient: 20,
              position: 161251.965,
            },
            {
              gradient: 20,
              position: 161867.965,
            },
            {
              gradient: 0,
              position: 161867.965,
            },
            {
              gradient: 0,
              position: 162492.965,
            },
            {
              gradient: -5,
              position: 162492.965,
            },
            {
              gradient: -5,
              position: 162623.965,
            },
            {
              gradient: 0,
              position: 162623.965,
            },
            {
              gradient: 0,
              position: 162898.965,
            },
            {
              gradient: 6,
              position: 162898.965,
            },
            {
              gradient: 6,
              position: 163712.965,
            },
            {
              gradient: 0,
              position: 163712.965,
            },
            {
              gradient: 0,
              position: 164487.965,
            },
            {
              gradient: -25,
              position: 164487.965,
            },
            {
              gradient: -25,
              position: 166000.965,
            },
            {
              gradient: 0,
              position: 166000.965,
            },
            {
              gradient: 0,
              position: 166400.965,
            },
            {
              gradient: -9,
              position: 166400.965,
            },
            {
              gradient: -9,
              position: 167129.965,
            },
            {
              gradient: 0,
              position: 167129.965,
            },
            {
              gradient: 0,
              position: 167259.965,
            },
            {
              gradient: -14.6,
              position: 167259.965,
            },
            {
              gradient: -14.6,
              position: 168027.965,
            },
            {
              gradient: 0,
              position: 168027.965,
            },
            {
              gradient: 0,
              position: 168280.965,
            },
            {
              gradient: -4.5,
              position: 168280.965,
            },
            {
              gradient: -4.5,
              position: 169671.965,
            },
            {
              gradient: 0,
              position: 169671.965,
            },
            {
              gradient: 0,
              position: 169883.965,
            },
            {
              gradient: 4,
              position: 169883.965,
            },
            {
              gradient: 4,
              position: 171156.965,
            },
            {
              gradient: 0,
              position: 171156.965,
            },
            {
              gradient: 0,
              position: 171306.965,
            },
            {
              gradient: -2,
              position: 171306.965,
            },
            {
              gradient: -2,
              position: 172575.965,
            },
            {
              gradient: 0,
              position: 172575.965,
            },
            {
              gradient: 0,
              position: 172850.965,
            },
            {
              gradient: -13,
              position: 172850.965,
            },
            {
              gradient: -13,
              position: 174001.965,
            },
            {
              gradient: 0,
              position: 174001.965,
            },
            {
              gradient: 0,
              position: 174376.965,
            },
            {
              gradient: 2,
              position: 174376.965,
            },
            {
              gradient: 2,
              position: 175037.965,
            },
            {
              gradient: 0,
              position: 175037.965,
            },
            {
              gradient: 0,
              position: 175412.965,
            },
            {
              gradient: 17,
              position: 175412.965,
            },
            {
              gradient: 17,
              position: 176014.965,
            },
            {
              gradient: 0,
              position: 176014.965,
            },
            {
              gradient: 0,
              position: 176489.965,
            },
            {
              gradient: -2,
              position: 176489.965,
            },
            {
              gradient: -2,
              position: 177767.965,
            },
            {
              gradient: 0,
              position: 177767.965,
            },
            {
              gradient: 0,
              position: 178055.965,
            },
            {
              gradient: -20,
              position: 178055.965,
            },
            {
              gradient: -20,
              position: 178435.965,
            },
            {
              gradient: 0,
              position: 178435.965,
            },
            {
              gradient: 0,
              position: 178563.965,
            },
            {
              gradient: -12,
              position: 178563.965,
            },
            {
              gradient: -12,
              position: 178970.965,
            },
            {
              gradient: 0,
              position: 178970.965,
            },
            {
              gradient: 0,
              position: 179011.965,
            },
            {
              gradient: -12,
              position: 179011.965,
            },
            {
              gradient: -12,
              position: 179377.965,
            },
            {
              gradient: 0,
              position: 179377.965,
            },
            {
              gradient: 0,
              position: 179999.965,
            },
            {
              gradient: -2.1,
              position: 179999.965,
            },
            {
              gradient: -2.1,
              position: 180716.965,
            },
            {
              gradient: -1.8,
              position: 180716.965,
            },
            {
              gradient: -1.8,
              position: 181037.965,
            },
            {
              gradient: -2.1,
              position: 181037.965,
            },
            {
              gradient: -2.1,
              position: 181538.965,
            },
            {
              gradient: -1.5,
              position: 181538.965,
            },
            {
              gradient: -1.5,
              position: 181688.965,
            },
            {
              gradient: 0,
              position: 181688.965,
            },
            {
              gradient: 0,
              position: 181898.965,
            },
            {
              gradient: -1.5,
              position: 181898.965,
            },
            {
              gradient: -1.5,
              position: 182088.965,
            },
            {
              gradient: 0.2,
              position: 182088.965,
            },
            {
              gradient: 0.2,
              position: 182138.965,
            },
            {
              gradient: -0.2,
              position: 182138.965,
            },
            {
              gradient: -0.2,
              position: 182260.965,
            },
            {
              gradient: 0,
              position: 182260.965,
            },
            {
              gradient: 0,
              position: 182488.965,
            },
            {
              gradient: 0.2,
              position: 182488.965,
            },
            {
              gradient: 0.2,
              position: 182538.965,
            },
            {
              gradient: 0,
              position: 182538.965,
            },
            {
              gradient: 0,
              position: 182638.965,
            },
            {
              gradient: 0.4,
              position: 182638.965,
            },
            {
              gradient: 0.4,
              position: 182888.965,
            },
            {
              gradient: -0.4,
              position: 182888.965,
            },
            {
              gradient: -0.4,
              position: 182938.965,
            },
            {
              gradient: -1.7,
              position: 182938.965,
            },
            {
              gradient: -1.7,
              position: 184438.965,
            },
            {
              gradient: -1.2,
              position: 184438.965,
            },
            {
              gradient: -1.2,
              position: 184788.965,
            },
            {
              gradient: -2.4,
              position: 184788.965,
            },
            {
              gradient: -2.4,
              position: 184888.965,
            },
            {
              gradient: -1.3,
              position: 184888.965,
            },
            {
              gradient: -1.3,
              position: 186338.965,
            },
            {
              gradient: 0,
              position: 186338.965,
            },
            {
              gradient: 0,
              position: 186438.965,
            },
            {
              gradient: -0.2,
              position: 186438.965,
            },
            {
              gradient: -0.2,
              position: 186538.965,
            },
            {
              gradient: 0,
              position: 186538.965,
            },
            {
              gradient: 0,
              position: 186638.965,
            },
            {
              gradient: -0.3,
              position: 186638.965,
            },
            {
              gradient: -0.3,
              position: 187088.965,
            },
            {
              gradient: 0.9,
              position: 187088.965,
            },
            {
              gradient: 0.9,
              position: 189188.965,
            },
            {
              gradient: 2.2,
              position: 189188.965,
            },
            {
              gradient: 2.2,
              position: 189888.965,
            },
            {
              gradient: 1.6,
              position: 189888.965,
            },
            {
              gradient: 1.6,
              position: 190038.965,
            },
            {
              gradient: 0,
              position: 190038.965,
            },
            {
              gradient: 0,
              position: 190138.965,
            },
            {
              gradient: 0.4,
              position: 190138.965,
            },
            {
              gradient: 0.4,
              position: 190188.965,
            },
            {
              gradient: -0.6,
              position: 190188.965,
            },
            {
              gradient: -0.6,
              position: 190388.965,
            },
            {
              gradient: 0,
              position: 190388.965,
            },
            {
              gradient: 0,
              position: 190488.965,
            },
            {
              gradient: 0.5,
              position: 190488.965,
            },
            {
              gradient: 0.5,
              position: 190588.965,
            },
            {
              gradient: -0.5,
              position: 190588.965,
            },
            {
              gradient: -0.5,
              position: 190688.965,
            },
            {
              gradient: 0.2,
              position: 190688.965,
            },
            {
              gradient: 0.2,
              position: 190888.965,
            },
            {
              gradient: -0.2,
              position: 190888.965,
            },
            {
              gradient: -0.2,
              position: 191038.965,
            },
            {
              gradient: 0,
              position: 191038.965,
            },
            {
              gradient: 0,
              position: 191138.965,
            },
            {
              gradient: -0.2,
              position: 191138.965,
            },
            {
              gradient: -0.2,
              position: 191238.965,
            },
            {
              gradient: 0.1,
              position: 191238.965,
            },
            {
              gradient: 0.1,
              position: 191338.965,
            },
            {
              gradient: -0.9,
              position: 191338.965,
            },
            {
              gradient: -0.9,
              position: 192588.965,
            },
            {
              gradient: -3.1,
              position: 192588.965,
            },
            {
              gradient: -3.1,
              position: 192838.965,
            },
            {
              gradient: -4.1,
              position: 192838.965,
            },
            {
              gradient: -4.1,
              position: 193288.965,
            },
            {
              gradient: -3.2,
              position: 193288.965,
            },
            {
              gradient: -3.2,
              position: 193438.965,
            },
            {
              gradient: -4.8,
              position: 193438.965,
            },
            {
              gradient: -4.8,
              position: 193488.965,
            },
            {
              gradient: -3.1,
              position: 193488.965,
            },
            {
              gradient: -3.1,
              position: 194388.965,
            },
            {
              gradient: -2.8,
              position: 194388.965,
            },
            {
              gradient: -2.8,
              position: 194938.965,
            },
            {
              gradient: -0.8,
              position: 194938.965,
            },
            {
              gradient: -0.8,
              position: 195288.965,
            },
            {
              gradient: 0,
              position: 195288.965,
            },
            {
              gradient: 0,
              position: 195838.965,
            },
            {
              gradient: -0.2,
              position: 195838.965,
            },
            {
              gradient: -0.2,
              position: 196288.965,
            },
            {
              gradient: -1.8,
              position: 196288.965,
            },
            {
              gradient: -1.8,
              position: 197388.965,
            },
            {
              gradient: -1.7,
              position: 197388.965,
            },
            {
              gradient: -1.7,
              position: 197758.965,
            },
            {
              gradient: -0.5,
              position: 197758.965,
            },
            {
              gradient: -0.5,
              position: 197913.965,
            },
            {
              gradient: -2.6,
              position: 197913.965,
            },
            {
              gradient: -2.6,
              position: 198127.965,
            },
            {
              gradient: -1.5,
              position: 198127.965,
            },
            {
              gradient: -1.5,
              position: 198288.965,
            },
            {
              gradient: -1.4,
              position: 198288.965,
            },
            {
              gradient: -1.4,
              position: 199438.965,
            },
            {
              gradient: -2.4,
              position: 199438.965,
            },
            {
              gradient: -2.4,
              position: 199488.965,
            },
            {
              gradient: -1.3,
              position: 199488.965,
            },
            {
              gradient: -1.3,
              position: 199838.965,
            },
            {
              gradient: 0.6,
              position: 199838.965,
            },
            {
              gradient: 0.6,
              position: 199888.965,
            },
            {
              gradient: 2.9,
              position: 199888.965,
            },
            {
              gradient: 2.9,
              position: 199988.965,
            },
            {
              gradient: 5.5,
              position: 199988.965,
            },
            {
              gradient: 5.5,
              position: 200288.965,
            },
            {
              gradient: 3.8,
              position: 200288.965,
            },
            {
              gradient: 3.8,
              position: 200338.965,
            },
            {
              gradient: 1,
              position: 200338.965,
            },
            {
              gradient: 1,
              position: 200388.965,
            },
            {
              gradient: -0.8,
              position: 200388.965,
            },
            {
              gradient: -0.8,
              position: 200488.965,
            },
            {
              gradient: -2.4,
              position: 200488.965,
            },
            {
              gradient: -2.4,
              position: 200588.965,
            },
            {
              gradient: -1.3,
              position: 200588.965,
            },
            {
              gradient: -1.3,
              position: 200688.965,
            },
            {
              gradient: 2,
              position: 200688.965,
            },
            {
              gradient: 2,
              position: 200754.965,
            },
            {
              gradient: 0,
              position: 200754.965,
            },
            {
              gradient: 0,
              position: 201408.607,
            },
          ],
          curves: [
            {
              radius: -526,
              position: 0,
            },
            {
              radius: -526,
              position: 115.965,
            },
            {
              radius: 806,
              position: 115.965,
            },
            {
              radius: 806,
              position: 175.965,
            },
            {
              radius: -8333,
              position: 175.965,
            },
            {
              radius: -8333,
              position: 255.965,
            },
            {
              radius: 776,
              position: 255.965,
            },
            {
              radius: 776,
              position: 335.965,
            },
            {
              radius: 485,
              position: 335.965,
            },
            {
              radius: 485,
              position: 394.965,
            },
            {
              radius: 1500,
              position: 394.965,
            },
            {
              radius: 1500,
              position: 395.965,
            },
            {
              radius: 0,
              position: 395.965,
            },
            {
              radius: 0,
              position: 1772.965,
            },
            {
              radius: -10000,
              position: 1772.965,
            },
            {
              radius: -10000,
              position: 2015.965,
            },
            {
              radius: -1162,
              position: 2015.965,
            },
            {
              radius: -1162,
              position: 2195.965,
            },
            {
              radius: 1612,
              position: 2195.965,
            },
            {
              radius: 1612,
              position: 2395.965,
            },
            {
              radius: 757,
              position: 2395.965,
            },
            {
              radius: 757,
              position: 2795.965,
            },
            {
              radius: 552,
              position: 2795.965,
            },
            {
              radius: 552,
              position: 2975.965,
            },
            {
              radius: 466,
              position: 2975.965,
            },
            {
              radius: 466,
              position: 3275.965,
            },
            {
              radius: 0,
              position: 3275.965,
            },
            {
              radius: 0,
              position: 3674.965,
            },
            {
              radius: -840,
              position: 3674.965,
            },
            {
              radius: -840,
              position: 4555.965,
            },
            {
              radius: -2941,
              position: 4555.965,
            },
            {
              radius: -2941,
              position: 5014.965,
            },
            {
              radius: 0,
              position: 5014.965,
            },
            {
              radius: 0,
              position: 5655.965,
            },
            {
              radius: 1639,
              position: 5655.965,
            },
            {
              radius: 1639,
              position: 6269.965,
            },
            {
              radius: -1650,
              position: 6269.965,
            },
            {
              radius: -1650,
              position: 6789.965,
            },
            {
              radius: 1650,
              position: 6789.965,
            },
            {
              radius: 1650,
              position: 7478.965,
            },
            {
              radius: 0,
              position: 7478.965,
            },
            {
              radius: 0,
              position: 8061.965,
            },
            {
              radius: 6000,
              position: 8061.965,
            },
            {
              radius: 6000,
              position: 8855.965,
            },
            {
              radius: 0,
              position: 8855.965,
            },
            {
              radius: 0,
              position: 9584.965,
            },
            {
              radius: -2900,
              position: 9584.965,
            },
            {
              radius: -2900,
              position: 10833.965,
            },
            {
              radius: 0,
              position: 10833.965,
            },
            {
              radius: 0,
              position: 11776.965,
            },
            {
              radius: 10000,
              position: 11776.965,
            },
            {
              radius: 10000,
              position: 11984.965,
            },
            {
              radius: 0,
              position: 11984.965,
            },
            {
              radius: 0,
              position: 12607.965,
            },
            {
              radius: -1600,
              position: 12607.965,
            },
            {
              radius: -1600,
              position: 13309.965,
            },
            {
              radius: 0,
              position: 13309.965,
            },
            {
              radius: 0,
              position: 14150.965,
            },
            {
              radius: 1600,
              position: 14150.965,
            },
            {
              radius: 1600,
              position: 15179.965,
            },
            {
              radius: 0,
              position: 15179.965,
            },
            {
              radius: 0,
              position: 15289.965,
            },
            {
              radius: -5000,
              position: 15289.965,
            },
            {
              radius: -5000,
              position: 15572.965,
            },
            {
              radius: 0,
              position: 15572.965,
            },
            {
              radius: 0,
              position: 15700.965,
            },
            {
              radius: 7000,
              position: 15700.965,
            },
            {
              radius: 7000,
              position: 16105.965,
            },
            {
              radius: 0,
              position: 16105.965,
            },
            {
              radius: 0,
              position: 16324.965,
            },
            {
              radius: -4000,
              position: 16324.965,
            },
            {
              radius: -4000,
              position: 17587.965,
            },
            {
              radius: -6000,
              position: 17587.965,
            },
            {
              radius: -6000,
              position: 18038.965,
            },
            {
              radius: -3500,
              position: 18038.965,
            },
            {
              radius: -3500,
              position: 19747.965,
            },
            {
              radius: 0,
              position: 19747.965,
            },
            {
              radius: 0,
              position: 21601.965,
            },
            {
              radius: 5000,
              position: 21601.965,
            },
            {
              radius: 5000,
              position: 23495.965,
            },
            {
              radius: 0,
              position: 23495.965,
            },
            {
              radius: 0,
              position: 23724.965,
            },
            {
              radius: -4545,
              position: 23724.965,
            },
            {
              radius: -4545,
              position: 24903.965,
            },
            {
              radius: 0,
              position: 24903.965,
            },
            {
              radius: 0,
              position: 26540.965,
            },
            {
              radius: 4000,
              position: 26540.965,
            },
            {
              radius: 4000,
              position: 28316.965,
            },
            {
              radius: -4000,
              position: 28316.965,
            },
            {
              radius: -4000,
              position: 31892.965,
            },
            {
              radius: 15000,
              position: 31892.965,
            },
            {
              radius: 15000,
              position: 33016.965,
            },
            {
              radius: 0,
              position: 33016.965,
            },
            {
              radius: 0,
              position: 34674.965,
            },
            {
              radius: 4545,
              position: 34674.965,
            },
            {
              radius: 4545,
              position: 36341.965,
            },
            {
              radius: -5000,
              position: 36341.965,
            },
            {
              radius: -5000,
              position: 37443.965,
            },
            {
              radius: 0,
              position: 37443.965,
            },
            {
              radius: 0,
              position: 38123.965,
            },
            {
              radius: 4545,
              position: 38123.965,
            },
            {
              radius: 4545,
              position: 39399.965,
            },
            {
              radius: -15000,
              position: 39399.965,
            },
            {
              radius: -15000,
              position: 40032.965,
            },
            {
              radius: 0,
              position: 40032.965,
            },
            {
              radius: 0,
              position: 40980.965,
            },
            {
              radius: -4545,
              position: 40980.965,
            },
            {
              radius: -4545,
              position: 43171.965,
            },
            {
              radius: 0,
              position: 43171.965,
            },
            {
              radius: 0,
              position: 44133.965,
            },
            {
              radius: 4167,
              position: 44133.965,
            },
            {
              radius: 4167,
              position: 48823.965,
            },
            {
              radius: 0,
              position: 48823.965,
            },
            {
              radius: 0,
              position: 51393.965,
            },
            {
              radius: -5000,
              position: 51393.965,
            },
            {
              radius: -5000,
              position: 55280.965,
            },
            {
              radius: 0,
              position: 55280.965,
            },
            {
              radius: 0,
              position: 57696.965,
            },
            {
              radius: -5000,
              position: 57696.965,
            },
            {
              radius: -5000,
              position: 59157.965,
            },
            {
              radius: 0,
              position: 59157.965,
            },
            {
              radius: 0,
              position: 59393.965,
            },
            {
              radius: 4545,
              position: 59393.965,
            },
            {
              radius: 4545,
              position: 62101.965,
            },
            {
              radius: 0,
              position: 62101.965,
            },
            {
              radius: 0,
              position: 62358.965,
            },
            {
              radius: -8000,
              position: 62358.965,
            },
            {
              radius: -8000,
              position: 63365.965,
            },
            {
              radius: 0,
              position: 63365.965,
            },
            {
              radius: 0,
              position: 63709.965,
            },
            {
              radius: 5000,
              position: 63709.965,
            },
            {
              radius: 5000,
              position: 65478.965,
            },
            {
              radius: 0,
              position: 65478.965,
            },
            {
              radius: 0,
              position: 69016.965,
            },
            {
              radius: 25000,
              position: 69016.965,
            },
            {
              radius: 25000,
              position: 69411.965,
            },
            {
              radius: -6250,
              position: 69411.965,
            },
            {
              radius: -6250,
              position: 70558.965,
            },
            {
              radius: 25000,
              position: 70558.965,
            },
            {
              radius: 25000,
              position: 70956.965,
            },
            {
              radius: 0,
              position: 70956.965,
            },
            {
              radius: 0,
              position: 74164.965,
            },
            {
              radius: 6250,
              position: 74164.965,
            },
            {
              radius: 6250,
              position: 75638.965,
            },
            {
              radius: 0,
              position: 75638.965,
            },
            {
              radius: 0,
              position: 81197.965,
            },
            {
              radius: -6500,
              position: 81197.965,
            },
            {
              radius: -6500,
              position: 84749.965,
            },
            {
              radius: 0,
              position: 84749.965,
            },
            {
              radius: 0,
              position: 85031.965,
            },
            {
              radius: 6500,
              position: 85031.965,
            },
            {
              radius: 6500,
              position: 86842.965,
            },
            {
              radius: 0,
              position: 86842.965,
            },
            {
              radius: 0,
              position: 87119.965,
            },
            {
              radius: -6250,
              position: 87119.965,
            },
            {
              radius: -6250,
              position: 90744.965,
            },
            {
              radius: 11111,
              position: 90744.965,
            },
            {
              radius: 11111,
              position: 91408.965,
            },
            {
              radius: 0,
              position: 91408.965,
            },
            {
              radius: 0,
              position: 93745.965,
            },
            {
              radius: 10000,
              position: 93745.965,
            },
            {
              radius: 10000,
              position: 94307.965,
            },
            {
              radius: 0,
              position: 94307.965,
            },
            {
              radius: 0,
              position: 94504.965,
            },
            {
              radius: -10000,
              position: 94504.965,
            },
            {
              radius: -10000,
              position: 95436.965,
            },
            {
              radius: 0,
              position: 95436.965,
            },
            {
              radius: 0,
              position: 95637.965,
            },
            {
              radius: 10000,
              position: 95637.965,
            },
            {
              radius: 10000,
              position: 96200.965,
            },
            {
              radius: 0,
              position: 96200.965,
            },
            {
              radius: 0,
              position: 99319.965,
            },
            {
              radius: -12500,
              position: 99319.965,
            },
            {
              radius: -12500,
              position: 99732.965,
            },
            {
              radius: 0,
              position: 99732.965,
            },
            {
              radius: 0,
              position: 100039.965,
            },
            {
              radius: 6667,
              position: 100039.965,
            },
            {
              radius: 6667,
              position: 101946.965,
            },
            {
              radius: 0,
              position: 101946.965,
            },
            {
              radius: 0,
              position: 102235.965,
            },
            {
              radius: -8333,
              position: 102235.965,
            },
            {
              radius: -8333,
              position: 104273.965,
            },
            {
              radius: 0,
              position: 104273.965,
            },
            {
              radius: 0,
              position: 106094.965,
            },
            {
              radius: -10000,
              position: 106094.965,
            },
            {
              radius: -10000,
              position: 108031.965,
            },
            {
              radius: 0,
              position: 108031.965,
            },
            {
              radius: 0,
              position: 108953.965,
            },
            {
              radius: 8333,
              position: 108953.965,
            },
            {
              radius: 8333,
              position: 112428.965,
            },
            {
              radius: 0,
              position: 112428.965,
            },
            {
              radius: 0,
              position: 115455.965,
            },
            {
              radius: -6000,
              position: 115455.965,
            },
            {
              radius: -6000,
              position: 117031.965,
            },
            {
              radius: 0,
              position: 117031.965,
            },
            {
              radius: 0,
              position: 117352.965,
            },
            {
              radius: 6000,
              position: 117352.965,
            },
            {
              radius: 6000,
              position: 120148.965,
            },
            {
              radius: 0,
              position: 120148.965,
            },
            {
              radius: 0,
              position: 120501.965,
            },
            {
              radius: -7143,
              position: 120501.965,
            },
            {
              radius: -7143,
              position: 121598.965,
            },
            {
              radius: 0,
              position: 121598.965,
            },
            {
              radius: 0,
              position: 122000.965,
            },
            {
              radius: 5000,
              position: 122000.965,
            },
            {
              radius: 5000,
              position: 124041.965,
            },
            {
              radius: 0,
              position: 124041.965,
            },
            {
              radius: 0,
              position: 124240.965,
            },
            {
              radius: -4545,
              position: 124240.965,
            },
            {
              radius: -4545,
              position: 127136.965,
            },
            {
              radius: 0,
              position: 127136.965,
            },
            {
              radius: 0,
              position: 129102.965,
            },
            {
              radius: -12500,
              position: 129102.965,
            },
            {
              radius: -12500,
              position: 129459.965,
            },
            {
              radius: 0,
              position: 129459.965,
            },
            {
              radius: 0,
              position: 129976.965,
            },
            {
              radius: 6502,
              position: 129976.965,
            },
            {
              radius: 6502,
              position: 130900.965,
            },
            {
              radius: -2500,
              position: 130900.965,
            },
            {
              radius: -2500,
              position: 131317.965,
            },
            {
              radius: 0,
              position: 131317.965,
            },
            {
              radius: 0,
              position: 132002.965,
            },
            {
              radius: 6250,
              position: 132002.965,
            },
            {
              radius: 6250,
              position: 132857.965,
            },
            {
              radius: 0,
              position: 132857.965,
            },
            {
              radius: 0,
              position: 133941.965,
            },
            {
              radius: -8333,
              position: 133941.965,
            },
            {
              radius: -8333,
              position: 138009.965,
            },
            {
              radius: 0,
              position: 138009.965,
            },
            {
              radius: 0,
              position: 139242.965,
            },
            {
              radius: 15000,
              position: 139242.965,
            },
            {
              radius: 15000,
              position: 140193.965,
            },
            {
              radius: 0,
              position: 140193.965,
            },
            {
              radius: 0,
              position: 140480.965,
            },
            {
              radius: -8333,
              position: 140480.965,
            },
            {
              radius: -8333,
              position: 142068.965,
            },
            {
              radius: 0,
              position: 142068.965,
            },
            {
              radius: 0,
              position: 143300.965,
            },
            {
              radius: -12500,
              position: 143300.965,
            },
            {
              radius: -12500,
              position: 143957.965,
            },
            {
              radius: 0,
              position: 143957.965,
            },
            {
              radius: 0,
              position: 144260.965,
            },
            {
              radius: 6250,
              position: 144260.965,
            },
            {
              radius: 6250,
              position: 146799.965,
            },
            {
              radius: 0,
              position: 146799.965,
            },
            {
              radius: 0,
              position: 147104.965,
            },
            {
              radius: -10000,
              position: 147104.965,
            },
            {
              radius: -10000,
              position: 147913.965,
            },
            {
              radius: 0,
              position: 147913.965,
            },
            {
              radius: 0,
              position: 149775.965,
            },
            {
              radius: 7143,
              position: 149775.965,
            },
            {
              radius: 7143,
              position: 151356.965,
            },
            {
              radius: 0,
              position: 151356.965,
            },
            {
              radius: 0,
              position: 151664.965,
            },
            {
              radius: -7143,
              position: 151664.965,
            },
            {
              radius: -7143,
              position: 153145.965,
            },
            {
              radius: 0,
              position: 153145.965,
            },
            {
              radius: 0,
              position: 154343.965,
            },
            {
              radius: -6250,
              position: 154343.965,
            },
            {
              radius: -6250,
              position: 155609.965,
            },
            {
              radius: 0,
              position: 155609.965,
            },
            {
              radius: 0,
              position: 155961.965,
            },
            {
              radius: 6250,
              position: 155961.965,
            },
            {
              radius: 6250,
              position: 157886.965,
            },
            {
              radius: 0,
              position: 157886.965,
            },
            {
              radius: 0,
              position: 159965.965,
            },
            {
              radius: 6250,
              position: 159965.965,
            },
            {
              radius: 6250,
              position: 161606.965,
            },
            {
              radius: 0,
              position: 161606.965,
            },
            {
              radius: 0,
              position: 161972.965,
            },
            {
              radius: -6250,
              position: 161972.965,
            },
            {
              radius: -6250,
              position: 163420.965,
            },
            {
              radius: 0,
              position: 163420.965,
            },
            {
              radius: 0,
              position: 163772.965,
            },
            {
              radius: 6250,
              position: 163772.965,
            },
            {
              radius: 6250,
              position: 164672.965,
            },
            {
              radius: 10000,
              position: 164672.965,
            },
            {
              radius: 10000,
              position: 165843.965,
            },
            {
              radius: 8333,
              position: 165843.965,
            },
            {
              radius: 8333,
              position: 167675.965,
            },
            {
              radius: 0,
              position: 167675.965,
            },
            {
              radius: 0,
              position: 168386.965,
            },
            {
              radius: -6250,
              position: 168386.965,
            },
            {
              radius: -6250,
              position: 171749.965,
            },
            {
              radius: 0,
              position: 171749.965,
            },
            {
              radius: 0,
              position: 172983.965,
            },
            {
              radius: -8333,
              position: 172983.965,
            },
            {
              radius: -8333,
              position: 173889.965,
            },
            {
              radius: 0,
              position: 173889.965,
            },
            {
              radius: 0,
              position: 175737.965,
            },
            {
              radius: -6250,
              position: 175737.965,
            },
            {
              radius: -6250,
              position: 178343.965,
            },
            {
              radius: 0,
              position: 178343.965,
            },
            {
              radius: 0,
              position: 179011.965,
            },
            {
              radius: 10000,
              position: 179011.965,
            },
            {
              radius: 10000,
              position: 179182.965,
            },
            {
              radius: 0,
              position: 179182.965,
            },
            {
              radius: 0,
              position: 179329.965,
            },
            {
              radius: 2000,
              position: 179329.965,
            },
            {
              radius: 2000,
              position: 181333.965,
            },
            {
              radius: 0,
              position: 181333.965,
            },
            {
              radius: 0,
              position: 192928.965,
            },
            {
              radius: -1818,
              position: 192928.965,
            },
            {
              radius: -1818,
              position: 193888.965,
            },
            {
              radius: 0,
              position: 193888.965,
            },
            {
              radius: 0,
              position: 194738.965,
            },
            {
              radius: 1852,
              position: 194738.965,
            },
            {
              radius: 1852,
              position: 195718.965,
            },
            {
              radius: 0,
              position: 195718.965,
            },
            {
              radius: 0,
              position: 199478.965,
            },
            {
              radius: -1220,
              position: 199478.965,
            },
            {
              radius: -1220,
              position: 199918.965,
            },
            {
              radius: -990,
              position: 199918.965,
            },
            {
              radius: -990,
              position: 200188.965,
            },
            {
              radius: -909,
              position: 200188.965,
            },
            {
              radius: -909,
              position: 200388.965,
            },
            {
              radius: 0,
              position: 200388.965,
            },
            {
              radius: 0,
              position: 201108.965,
            },
            {
              radius: -885,
              position: 201108.965,
            },
            {
              radius: -885,
              position: 201408.607,
            },
          ],
          base: {
            head_positions: [
              [
                {
                  time: 52200,
                  position: 0,
                },
                {
                  time: 52208,
                  position: 15.087681652230287,
                },
                {
                  time: 52216,
                  position: 59.95650969166121,
                },
                {
                  time: 52224,
                  position: 134.0825421380268,
                },
                {
                  time: 52232,
                  position: 236.98839247875625,
                },
                {
                  time: 52317.49827720566,
                  position: 1660.9650000000001,
                },
                {
                  time: 52323.49827720566,
                  position: 1767.7780072292762,
                },
                {
                  time: 52331.49827720566,
                  position: 1930.6174571559138,
                },
                {
                  time: 52341.49827720566,
                  position: 2161.1275570966345,
                },
                {
                  time: 52351.49827720566,
                  position: 2413.0298284954642,
                },
                {
                  time: 52363.49827720566,
                  position: 2738.1398383195615,
                },
                {
                  time: 52377.75174569455,
                  position: 3145.965,
                },
                {
                  time: 52402.43174569455,
                  position: 3770.858012400591,
                },
                {
                  time: 52416.43174569455,
                  position: 4156.964371844142,
                },
                {
                  time: 52426.43174569455,
                  position: 4459.229607497612,
                },
                {
                  time: 52438.43174569455,
                  position: 4850.376521303067,
                },
                {
                  time: 52450.43174569455,
                  position: 5270.281282169671,
                },
                {
                  time: 52462.43174569455,
                  position: 5716.242002875245,
                },
                {
                  time: 52472.43174569455,
                  position: 6106.035980221415,
                },
                {
                  time: 52480.43174569455,
                  position: 6435.579634345027,
                },
                {
                  time: 52490.43174569455,
                  position: 6868.595781383138,
                },
                {
                  time: 52516.43174569455,
                  position: 8020.071253348365,
                },
                {
                  time: 52544.43174569455,
                  position: 9210.531491201365,
                },
                {
                  time: 52550.43174569455,
                  position: 9484.128166707702,
                },
                {
                  time: 52556.43174569455,
                  position: 9771.392110422634,
                },
                {
                  time: 52564.43174569455,
                  position: 10172.427180640114,
                },
                {
                  time: 52570.43174569455,
                  position: 10486.693547932831,
                },
                {
                  time: 52659.935124907905,
                  position: 15453.965,
                },
                {
                  time: 52665.935124907905,
                  position: 15793.311759016024,
                },
                {
                  time: 52671.935124907905,
                  position: 16143.99757989964,
                },
                {
                  time: 52681.935124907905,
                  position: 16748.723176299554,
                },
                {
                  time: 52691.935124907905,
                  position: 17368.41050165773,
                },
                {
                  time: 52713.935124907905,
                  position: 18766.6763033138,
                },
                {
                  time: 52721.935124907905,
                  position: 19286.141310948067,
                },
                {
                  time: 52729.935124907905,
                  position: 19816.618864989814,
                },
                {
                  time: 52745.935124907905,
                  position: 20905.824840111123,
                },
                {
                  time: 52753.935124907905,
                  position: 21467.64995775713,
                },
                {
                  time: 52763.935124907905,
                  position: 22189.116288063826,
                },
                {
                  time: 52771.935124907905,
                  position: 22780.758499968604,
                },
                {
                  time: 52781.935124907905,
                  position: 23537.4561097713,
                },
                {
                  time: 52807.935124907905,
                  position: 25538.497935155963,
                },
                {
                  time: 52823.935124907905,
                  position: 26785.73730604492,
                },
                {
                  time: 52835.935124907905,
                  position: 27738.84707111232,
                },
                {
                  time: 52845.935124907905,
                  position: 28553.034185602537,
                },
                {
                  time: 53002.05770487142,
                  position: 41549.750324835055,
                },
                {
                  time: 53049.79815316909,
                  position: 45487.18384380568,
                },
                {
                  time: 53264.9010873366,
                  position: 63412.01822058594,
                },
                {
                  time: 53272.9010873366,
                  position: 64070.69104510256,
                },
                {
                  time: 53290.9010873366,
                  position: 65534.839081862076,
                },
                {
                  time: 53302.9010873366,
                  position: 66525.77093593446,
                },
                {
                  time: 53625.283525107196,
                  position: 93390.965,
                },
                {
                  time: 53652.84637979722,
                  position: 95661.12432035248,
                },
                {
                  time: 54079.282189231584,
                  position: 131190.965,
                },
                {
                  time: 54105.282189231584,
                  position: 133333.25559366634,
                },
                {
                  time: 54148.88092429429,
                  position: 136961.33569717835,
                },
                {
                  time: 54613.887332933846,
                  position: 175708.57652478074,
                },
                {
                  time: 54620.25390236885,
                  position: 176228.74277777784,
                },
                {
                  time: 54626.25390236885,
                  position: 176700.4094444445,
                },
                {
                  time: 54634.25390236885,
                  position: 177301.29833333337,
                },
                {
                  time: 54642.25390236885,
                  position: 177870.18722222224,
                },
                {
                  time: 54650.25390236885,
                  position: 178407.07611111112,
                },
                {
                  time: 54658.25390236885,
                  position: 178911.965,
                },
                {
                  time: 54678.48299327795,
                  position: 180147.2705093627,
                },
                {
                  time: 54692.48299327795,
                  position: 180991.56898009698,
                },
                {
                  time: 54706.48299327795,
                  position: 181823.81089114814,
                },
                {
                  time: 54730.48299327795,
                  position: 183234.1939976445,
                },
                {
                  time: 54750.48299327795,
                  position: 184435.50229204967,
                },
                {
                  time: 54957.92652920042,
                  position: 197111.8538888888,
                },
                {
                  time: 54965.92652920042,
                  position: 197582.96499999994,
                },
                {
                  time: 54969.92652920042,
                  position: 197806.5205555555,
                },
                {
                  time: 54975.92652920042,
                  position: 198126.85388888884,
                },
                {
                  time: 54983.92652920042,
                  position: 198525.96499999997,
                },
                {
                  time: 54991.92652920042,
                  position: 198893.0761111111,
                },
                {
                  time: 54999.92652920042,
                  position: 199228.18722222222,
                },
                {
                  time: 55010.29541808931,
                  position: 199627.96499999994,
                },
                {
                  time: 55016.29541808931,
                  position: 199839.63166666662,
                },
                {
                  time: 55024.29541808931,
                  position: 200093.85388888887,
                },
                {
                  time: 55047.26030786709,
                  position: 200732.607,
                },
                {
                  time: 55053.26030786709,
                  position: 200879.607,
                },
                {
                  time: 55059.26030786709,
                  position: 201008.607,
                },
                {
                  time: 55065.26030786709,
                  position: 201119.607,
                },
                {
                  time: 55073.26030786709,
                  position: 201239.607,
                },
                {
                  time: 55079.26030786709,
                  position: 201308.607,
                },
                {
                  time: 55087.26030786709,
                  position: 201372.607,
                },
                {
                  time: 55093.26030786709,
                  position: 201399.607,
                },
                {
                  time: 55100.26030786709,
                  position: 201408.607,
                },
              ],
            ],
            tail_positions: [
              [
                {
                  time: 52200,
                  position: 0,
                },
                {
                  time: 52208,
                  position: 0,
                },
                {
                  time: 52216,
                  position: 0,
                },
                {
                  time: 52224,
                  position: 0,
                },
                {
                  time: 52232,
                  position: 36.98839247875625,
                },
                {
                  time: 52317.49827720566,
                  position: 1460.9650000000001,
                },
                {
                  time: 52323.49827720566,
                  position: 1567.7780072292762,
                },
                {
                  time: 52331.49827720566,
                  position: 1730.6174571559138,
                },
                {
                  time: 52341.49827720566,
                  position: 1961.1275570966345,
                },
                {
                  time: 52351.49827720566,
                  position: 2213.0298284954642,
                },
                {
                  time: 52363.49827720566,
                  position: 2538.1398383195615,
                },
                {
                  time: 52377.75174569455,
                  position: 2945.965,
                },
                {
                  time: 52402.43174569455,
                  position: 3570.858012400591,
                },
                {
                  time: 52416.43174569455,
                  position: 3956.964371844142,
                },
                {
                  time: 52426.43174569455,
                  position: 4259.229607497612,
                },
                {
                  time: 52438.43174569455,
                  position: 4650.376521303067,
                },
                {
                  time: 52450.43174569455,
                  position: 5070.281282169671,
                },
                {
                  time: 52462.43174569455,
                  position: 5516.242002875245,
                },
                {
                  time: 52472.43174569455,
                  position: 5906.035980221415,
                },
                {
                  time: 52480.43174569455,
                  position: 6235.579634345027,
                },
                {
                  time: 52490.43174569455,
                  position: 6668.595781383138,
                },
                {
                  time: 52516.43174569455,
                  position: 7820.071253348365,
                },
                {
                  time: 52544.43174569455,
                  position: 9010.531491201365,
                },
                {
                  time: 52550.43174569455,
                  position: 9284.128166707702,
                },
                {
                  time: 52556.43174569455,
                  position: 9571.392110422634,
                },
                {
                  time: 52564.43174569455,
                  position: 9972.427180640114,
                },
                {
                  time: 52570.43174569455,
                  position: 10286.693547932831,
                },
                {
                  time: 52659.935124907905,
                  position: 15253.965,
                },
                {
                  time: 52665.935124907905,
                  position: 15593.311759016024,
                },
                {
                  time: 52671.935124907905,
                  position: 15943.99757989964,
                },
                {
                  time: 52681.935124907905,
                  position: 16548.723176299554,
                },
                {
                  time: 52691.935124907905,
                  position: 17168.41050165773,
                },
                {
                  time: 52713.935124907905,
                  position: 18566.6763033138,
                },
                {
                  time: 52721.935124907905,
                  position: 19086.141310948067,
                },
                {
                  time: 52729.935124907905,
                  position: 19616.618864989814,
                },
                {
                  time: 52745.935124907905,
                  position: 20705.824840111123,
                },
                {
                  time: 52753.935124907905,
                  position: 21267.64995775713,
                },
                {
                  time: 52763.935124907905,
                  position: 21989.116288063826,
                },
                {
                  time: 52771.935124907905,
                  position: 22580.758499968604,
                },
                {
                  time: 52781.935124907905,
                  position: 23337.4561097713,
                },
                {
                  time: 52807.935124907905,
                  position: 25338.497935155963,
                },
                {
                  time: 52823.935124907905,
                  position: 26585.73730604492,
                },
                {
                  time: 52835.935124907905,
                  position: 27538.84707111232,
                },
                {
                  time: 52845.935124907905,
                  position: 28353.034185602537,
                },
                {
                  time: 53002.05770487142,
                  position: 41349.750324835055,
                },
                {
                  time: 53049.79815316909,
                  position: 45287.18384380568,
                },
                {
                  time: 53264.9010873366,
                  position: 63212.01822058594,
                },
                {
                  time: 53272.9010873366,
                  position: 63870.69104510256,
                },
                {
                  time: 53290.9010873366,
                  position: 65334.839081862076,
                },
                {
                  time: 53302.9010873366,
                  position: 66325.77093593446,
                },
                {
                  time: 53625.283525107196,
                  position: 93190.965,
                },
                {
                  time: 53652.84637979722,
                  position: 95461.12432035248,
                },
                {
                  time: 54079.282189231584,
                  position: 130990.965,
                },
                {
                  time: 54105.282189231584,
                  position: 133133.25559366634,
                },
                {
                  time: 54148.88092429429,
                  position: 136761.33569717835,
                },
                {
                  time: 54613.887332933846,
                  position: 175508.57652478074,
                },
                {
                  time: 54620.25390236885,
                  position: 176028.74277777784,
                },
                {
                  time: 54626.25390236885,
                  position: 176500.4094444445,
                },
                {
                  time: 54634.25390236885,
                  position: 177101.29833333337,
                },
                {
                  time: 54642.25390236885,
                  position: 177670.18722222224,
                },
                {
                  time: 54650.25390236885,
                  position: 178207.07611111112,
                },
                {
                  time: 54658.25390236885,
                  position: 178711.965,
                },
                {
                  time: 54678.48299327795,
                  position: 179947.2705093627,
                },
                {
                  time: 54692.48299327795,
                  position: 180791.56898009698,
                },
                {
                  time: 54706.48299327795,
                  position: 181623.81089114814,
                },
                {
                  time: 54730.48299327795,
                  position: 183034.1939976445,
                },
                {
                  time: 54750.48299327795,
                  position: 184235.50229204967,
                },
                {
                  time: 54957.92652920042,
                  position: 196911.8538888888,
                },
                {
                  time: 54965.92652920042,
                  position: 197382.96499999994,
                },
                {
                  time: 54969.92652920042,
                  position: 197606.5205555555,
                },
                {
                  time: 54975.92652920042,
                  position: 197926.85388888884,
                },
                {
                  time: 54983.92652920042,
                  position: 198325.96499999997,
                },
                {
                  time: 54991.92652920042,
                  position: 198693.0761111111,
                },
                {
                  time: 54999.92652920042,
                  position: 199028.18722222222,
                },
                {
                  time: 55010.29541808931,
                  position: 199427.96499999994,
                },
                {
                  time: 55016.29541808931,
                  position: 199639.63166666662,
                },
                {
                  time: 55024.29541808931,
                  position: 199893.85388888887,
                },
                {
                  time: 55047.26030786709,
                  position: 200532.607,
                },
                {
                  time: 55053.26030786709,
                  position: 200679.607,
                },
                {
                  time: 55059.26030786709,
                  position: 200808.607,
                },
                {
                  time: 55065.26030786709,
                  position: 200919.607,
                },
                {
                  time: 55073.26030786709,
                  position: 201039.607,
                },
                {
                  time: 55079.26030786709,
                  position: 201108.607,
                },
                {
                  time: 55087.26030786709,
                  position: 201172.607,
                },
                {
                  time: 55093.26030786709,
                  position: 201199.607,
                },
                {
                  time: 55100.26030786709,
                  position: 201208.607,
                },
              ],
            ],
            speeds: [
              {
                time: 52200,
                position: 0,
                speed: 0,
              },
              {
                time: 52202,
                position: 0.9490586448983088,
                speed: 0.9490586448983088,
              },
              {
                time: 52204,
                position: 3.7876080685882414,
                speed: 1.8894907787916235,
              },
              {
                time: 52208,
                position: 15.08768165223028,
                speed: 3.7585662853925057,
              },
              {
                time: 52212,
                position: 33.83214516120702,
                speed: 5.6116489504209675,
              },
              {
                time: 52218,
                position: 75.76573617868836,
                speed: 8.360738040262225,
              },
              {
                time: 52222,
                position: 112.836826916906,
                speed: 10.17270700575389,
              },
              {
                time: 52228,
                position: 181.96120792333537,
                speed: 12.86480037753732,
              },
              {
                time: 52236.570030776566,
                position: 308.55995765996323,
                speed: 16.666666666666668,
              },
              {
                time: 52269.41433331696,
                position: 855.965,
                speed: 16.666666666666668,
              },
              {
                time: 52272.46016693547,
                position: 908.6938467914624,
                speed: 17.94572180176421,
              },
              {
                time: 52275.018277205665,
                position: 952.965,
                speed: 16.666666666666668,
              },
              {
                time: 52317.49827720566,
                position: 1660.965,
                speed: 16.666666666666668,
              },
              {
                time: 52329.49827720566,
                position: 1887.858671857618,
                speed: 21.056336905724773,
              },
              {
                time: 52339.49827720566,
                position: 2113.090781464639,
                speed: 23.80534114707529,
              },
              {
                time: 52351.49827720566,
                position: 2413.029828495464,
                speed: 26.105668045905404,
              },
              {
                time: 52372.46938812619,
                position: 2996.3655202844907,
                speed: 29.641178784176407,
              },
              {
                time: 52381.75174569455,
                position: 3249.965,
                speed: 25,
              },
              {
                time: 52396.43174569455,
                position: 3616.965,
                speed: 25,
              },
              {
                time: 52426.43174569455,
                position: 4459.229607497612,
                speed: 31.345374805946133,
              },
              {
                time: 52442.43174569455,
                position: 4987.250326566449,
                speed: 34.61553198154361,
              },
              {
                time: 52456.43174569455,
                position: 5490.174913149777,
                speed: 37.17209736732895,
              },
              {
                time: 52470.43174569455,
                position: 6026.6744400508705,
                speed: 39.45240892712816,
              },
              {
                time: 52482.43174569455,
                position: 6521.178532726996,
                speed: 43.07577255246863,
              },
              {
                time: 52486.43174569455,
                position: 6693.960154849802,
                speed: 43.33322615807421,
              },
              {
                time: 52494.43174569455,
                position: 7046.075111813276,
                speed: 44.70812670813125,
              },
              {
                time: 52498.43174569455,
                position: 7225.23599945501,
                speed: 44.77339358281161,
              },
              {
                time: 52514.43174569455,
                position: 7932.902880120726,
                speed: 43.69624472410094,
              },
              {
                time: 52534.43174569455,
                position: 8783.682799773613,
                speed: 41.324123750709546,
              },
              {
                time: 52540.43174569455,
                position: 9036.004387683512,
                speed: 42.89585277574626,
              },
              {
                time: 52552.43174569455,
                position: 9578.5172191259,
                speed: 47.55163379646402,
              },
              {
                time: 52568.43174569455,
                position: 10380.54788310116,
                speed: 52.69311822784173,
              },
              {
                time: 52575.47304653589,
                position: 10761.627312665774,
                speed: 55.55555555555556,
              },
              {
                time: 52659.935124907905,
                position: 15453.965,
                speed: 55.55555555555556,
              },
              {
                time: 52673.935124907905,
                position: 16263.167336376571,
                speed: 59.85825428880899,
              },
              {
                time: 52681.935124907905,
                position: 16748.723176299554,
                speed: 61.38572431306721,
              },
              {
                time: 52701.935124907905,
                position: 17999.134634225047,
                speed: 63.69031321436226,
              },
              {
                time: 52715.935124907905,
                position: 18895.395244128296,
                speed: 64.48409205077189,
              },
              {
                time: 52721.935124907905,
                position: 19286.141310948067,
                speed: 65.7013819681295,
              },
              {
                time: 52743.935124907905,
                position: 20767.50609335596,
                speed: 68.96061864834742,
              },
              {
                time: 52763.935124907905,
                position: 22189.116288063826,
                speed: 73.16914241504898,
              },
              {
                time: 52781.935124907905,
                position: 23537.4561097713,
                speed: 76.59368700768825,
              },
              {
                time: 52787.935124907905,
                position: 23999.409845542636,
                speed: 77.21262710092336,
              },
              {
                time: 52795.935124907905,
                position: 24614.388639609148,
                speed: 76.54905821591642,
              },
              {
                time: 52811.935124907905,
                position: 25848.712308372487,
                speed: 77.81157209750988,
              },
              {
                time: 52821.935124907905,
                position: 26629.081230660693,
                speed: 78.22486444596254,
              },
              {
                time: 52839.935124907905,
                position: 28062.013071366036,
                speed: 81.07716031674254,
              },
              {
                time: 52848.00122209541,
                position: 28724.57556097535,
                speed: 83.33333333333333,
              },
              {
                time: 52883.821895363704,
                position: 31709.6308858811,
                speed: 83.33255254776554,
              },
              {
                time: 52891.821895363704,
                position: 32373.97423797496,
                speed: 82.84657929799457,
              },
              {
                time: 52896.28919601914,
                position: 32745.1422452447,
                speed: 83.33333333333333,
              },
              {
                time: 52928.64706907621,
                position: 35441.63166666664,
                speed: 83.33333333333333,
              },
              {
                time: 52940.64706907621,
                position: 36436.43850406896,
                speed: 82.46245470354208,
              },
              {
                time: 52948.271514743516,
                position: 37068.449156007664,
                speed: 83.33333333333333,
              },
              {
                time: 52996.05770487142,
                position: 41050.63042815859,
                speed: 83.33209482526631,
              },
              {
                time: 53006.05770487142,
                position: 41881.54119684637,
                speed: 82.85385166361458,
              },
              {
                time: 53010.05770487142,
                position: 42213.107803883555,
                speed: 82.99070178839779,
              },
              {
                time: 53016.05770487142,
                position: 42709.14184618783,
                speed: 82.33330657037375,
              },
              {
                time: 53020.05770487142,
                position: 43038.745036132226,
                speed: 82.5128013855045,
              },
              {
                time: 53038.05770487142,
                position: 44518.880928441264,
                speed: 81.9430736672955,
              },
              {
                time: 53046.05770487142,
                position: 45176.816922214144,
                speed: 82.6780265594408,
              },
              {
                time: 53049.79815316909,
                position: 45487.18384380568,
                speed: 83.33333333333333,
              },
              {
                time: 53262.9010873366,
                position: 63245.63166666665,
                speed: 83.33333333333333,
              },
              {
                time: 53276.9010873366,
                position: 64395.74223491244,
                speed: 80.90874120181111,
              },
              {
                time: 53290.9010873366,
                position: 65534.83908186208,
                speed: 81.87944083610552,
              },
              {
                time: 53303.30390485196,
                position: 66559.3299787296,
                speed: 83.33333333333333,
              },
              {
                time: 53625.283525107196,
                position: 93390.965,
                speed: 83.33333333333333,
              },
              {
                time: 53639.283525107196,
                position: 94544.84906853344,
                speed: 81.3434987537168,
              },
              {
                time: 53652.84637979722,
                position: 95661.12432035248,
                speed: 83.33333333333333,
              },
              {
                time: 53826.32046795299,
                position: 110117.29833333335,
                speed: 83.33333333333333,
              },
              {
                time: 53838.32046795299,
                position: 111112.8984723236,
                speed: 82.65687277733876,
              },
              {
                time: 53844.36890575577,
                position: 111614.85804368171,
                speed: 83.33333333333333,
              },
              {
                time: 54079.282189231584,
                position: 131190.965,
                speed: 83.33333333333333,
              },
              {
                time: 54093.282189231584,
                position: 132346.46010255828,
                speed: 81.53146243137134,
              },
              {
                time: 54108.394743377554,
                position: 133592.0894357146,
                speed: 83.33333333333333,
              },
              {
                time: 54135.60525014898,
                position: 135859.63166666662,
                speed: 83.33333333333333,
              },
              {
                time: 54141.60525014898,
                position: 136357.82622933082,
                speed: 82.6938108810291,
              },
              {
                time: 54148.88092429429,
                position: 136961.33569717835,
                speed: 83.33333333333333,
              },
              {
                time: 54441.41198995405,
                position: 161338.29833333325,
                speed: 83.33333333333333,
              },
              {
                time: 54449.41198995405,
                position: 162003.15432985823,
                speed: 82.9128855540673,
              },
              {
                time: 54453.33211751481,
                position: 162328.99181158727,
                speed: 83.33333333333333,
              },
              {
                time: 54613.07979577577,
                position: 175641.2977278311,
                speed: 83.33272783120943,
              },
              {
                time: 54613.887332933846,
                position: 175708.57652478074,
                speed: 83.2943958286144,
              },
              {
                time: 54618.25390236885,
                position: 176067.52055555562,
                speed: 81.11111111111111,
              },
              {
                time: 54634.25390236885,
                position: 177301.29833333337,
                speed: 73.11111111111111,
              },
              {
                time: 54646.25390236885,
                position: 178142.63166666668,
                speed: 67.11111111111111,
              },
              {
                time: 54658.25390236885,
                position: 178911.965,
                speed: 61.11111111111111,
              },
              {
                time: 54674.48299327795,
                position: 179903.68796172203,
                speed: 61.05629505542252,
              },
              {
                time: 54716.48299327795,
                position: 182410.6124384856,
                speed: 58.3752119619226,
              },
              {
                time: 54755.07641105239,
                position: 184715.50716255856,
                speed: 61.11111111111111,
              },
              {
                time: 54957.482084755975,
                position: 197084.7427777777,
                speed: 61.11111111111111,
              },
              {
                time: 54967.92652920042,
                position: 197695.74277777772,
                speed: 55.888888888888886,
              },
              {
                time: 54979.92652920042,
                position: 198330.4094444444,
                speed: 49.888888888888886,
              },
              {
                time: 54989.92652920042,
                position: 198804.2983333333,
                speed: 44.888888888888886,
              },
              {
                time: 55001.92652920042,
                position: 199306.965,
                speed: 38.888888888888886,
              },
              {
                time: 55006.07319586709,
                position: 199468.2242592592,
                speed: 38.888888888888886,
              },
              {
                time: 55016.29541808931,
                position: 199839.63166666665,
                speed: 33.77777777777778,
              },
              {
                time: 55028.29541808931,
                position: 200208.965,
                speed: 27.77777777777778,
              },
              {
                time: 55043.70475231153,
                position: 200637.0020617284,
                speed: 27.77777777777778,
              },
              {
                time: 55051.26030786709,
                position: 200832.607,
                speed: 24,
              },
              {
                time: 55057.26030786709,
                position: 200967.607,
                speed: 21,
              },
              {
                time: 55063.26030786709,
                position: 201084.607,
                speed: 18,
              },
              {
                time: 55071.26030786709,
                position: 201212.607,
                speed: 14,
              },
              {
                time: 55077.26030786709,
                position: 201287.607,
                speed: 11,
              },
              {
                time: 55081.26030786709,
                position: 201327.607,
                speed: 9,
              },
              {
                time: 55085.26030786709,
                position: 201359.607,
                speed: 7,
              },
              {
                time: 55091.26030786709,
                position: 201392.607,
                speed: 4,
              },
              {
                time: 55095.26030786709,
                position: 201404.607,
                speed: 2,
              },
              {
                time: 55097.26030786709,
                position: 201407.607,
                speed: 1,
              },
              {
                time: 55100.26030786709,
                position: 201408.607,
                speed: 0,
              },
            ],
            stops: [
              {
                time: 52200,
                position: 0,
                duration: 0,
                id: null,
                name: null,
                line_code: 420000,
                track_number: 4467,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie 1 de  Paris-Montparnasse',
              },
              {
                time: 52268.143826091895,
                position: 838.965,
                duration: 0,
                id: 'd98aed70-6667-11e3-89ff-01f464e0362d',
                name: 'Paris-Montparnasse',
                line_code: 420000,
                track_number: 389,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V2 de Paris-Montparnasse à Brest',
              },
              {
                time: 52321.093344978406,
                position: 1724.965,
                duration: 0,
                id: 'd991522e-6667-11e3-89ff-01f464e0362d',
                name: 'Paris-Montparnasse',
                line_code: 553000,
                track_number: 505,
                line_name: "Ligne d'Ouest-Ceinture à Chartres",
                track_name: 'Voie 1',
              },
              {
                time: 52323.753104535186,
                position: 1772.965,
                duration: 0,
                id: 'd991522e-6667-11e3-89ff-01f464e0362d',
                name: 'Paris-Montparnasse',
                line_code: 420000,
                track_number: 13542,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie 80 de  Paris-Montparnasse',
              },
              {
                time: 52330.48366030956,
                position: 1909.965,
                duration: 0,
                id: 'd96dd23c-6667-11e3-89ff-01f464e0362d',
                name: 'Vanves-Malakoff',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52391.653901467784,
                position: 3497.965,
                duration: 0,
                id: 'd94b9e04-6667-11e3-89ff-01f464e0362d',
                name: 'Montrouge-Châtillon',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52456.53139637603,
                position: 5496.965,
                duration: 0,
                id: 'd9abaea4-6667-11e3-89ff-01f464e0362d',
                name: 'Montrouge-Châtillon',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52584.76144018352,
                position: 11281.965,
                duration: 0,
                id: 'd9b1afd2-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52617.35712466732,
                position: 13090.965,
                duration: 0,
                id: 'd98ef502-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52621.48338876173,
                position: 13319.965,
                duration: 0,
                id: 'd995be4a-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52629.087246612566,
                position: 13741.965,
                duration: 0,
                id: 'd9b63fde-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52636.27667619191,
                position: 14140.965,
                duration: 0,
                id: 'd9cce656-6667-11e3-89ff-01f464e0362d',
                name: 'Massy-TGV',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 52797.208784237875,
                position: 24712.965,
                duration: 0,
                id: 'd99fe84e-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 12 Marcoussis',
                line_code: 431000,
                track_number: 402,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V1 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 53031.51135711593,
                position: 43978.965,
                duration: 0,
                id: 'd9c68ba6-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 13 St-Arnoult',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 53169.846273795214,
                position: 55490.965,
                duration: 0,
                id: 'b5992bfa-51ee-11ec-80ff-0168b2273146',
                name: 'Poste 13 St-Arnoult',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 53294.22070109625,
                position: 65808.965,
                duration: 0,
                id: 'bd3f33ec-91b6-11e6-b6ff-010c64e0362d',
                name: 'Poste 14 St-Léger',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 53303.575416333384,
                position: 66581.965,
                duration: 0,
                id: 'd944e8be-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 14 St-Léger',
                line_code: 431000,
                track_number: 12304,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie 3 de St-Léger',
              },
              {
                time: 53310.3554186258,
                position: 67146.965,
                duration: 0,
                id: 'd944e8be-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 14 St-Léger',
                line_code: 431000,
                track_number: 12304,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie 3 de St-Léger',
              },
              {
                time: 53604.55951810013,
                position: 91663.965,
                duration: 0,
                id: 'd9e1d9fe-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 15 Rouvray',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 53865.96731091809,
                position: 113417.965,
                duration: 0,
                id: 'd9d9a0c8-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 16 Dangeau',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 54060.654794242415,
                position: 129638.965,
                duration: 0,
                id: 'd99ac560-6667-11e3-89ff-01f464e0362d',
                name: 'Courtalain-TGV-Bifurcation',
                line_code: 431000,
                track_number: 403,
                line_name: 'Ligne de Paris-Montparnasse à Monts (LGV)',
                track_name: 'Voie V2 de Paris à Monts (Indre-et-Loire)',
              },
              {
                time: 54105.81946335617,
                position: 133377.965,
                duration: 0,
                id: 'd991ca18-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 17',
                line_code: 429000,
                track_number: 396,
                line_name: 'Ligne de Courtalain à Connerré (LGV)',
                track_name: 'Voie 1',
              },
              {
                time: 54571.24037027163,
                position: 172154.965,
                duration: 0,
                id: 'd9c72694-6667-11e3-89ff-01f464e0362d',
                name: 'Poste 32 Dollon',
                line_code: 429000,
                track_number: 396,
                line_name: 'Ligne de Courtalain à Connerré (LGV)',
                track_name: 'Voie 1',
              },
              {
                time: 54659.89148034092,
                position: 179011.965,
                duration: 0,
                id: 'bd3d7012-91b6-11e6-b6ff-010c64e0362d',
                name: 'Poste 33 Connerré',
                line_code: 429000,
                track_number: 396,
                line_name: 'Ligne de Courtalain à Connerré (LGV)',
                track_name: 'Voie 1',
              },
              {
                time: 54698.24279005697,
                position: 181333.965,
                duration: 0,
                id: 'd9b146e4-6667-11e3-89ff-01f464e0362d',
                name: 'Connerré-Beillé',
                line_code: 429310,
                track_number: 398,
                line_name: 'Raccordement de Connerré-Sud',
                track_name: 'Voie 1',
              },
              {
                time: 54712.7477440196,
                position: 182191.965,
                duration: 0,
                id: 'd990066a-6667-11e3-89ff-01f464e0362d',
                name: 'Connerré-Beillé',
                line_code: 420000,
                track_number: 389,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V2 de Paris-Montparnasse à Brest',
              },
              {
                time: 54747.84358268221,
                position: 184276.965,
                duration: 0,
                id: 'd97dc09a-6667-11e3-89ff-01f464e0362d',
                name: 'Montfort-le-Gesnois',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 54751.325160365515,
                position: 184486.965,
                duration: 0,
                id: 'd9d582aa-6667-11e3-89ff-01f464e0362d',
                name: 'Montfort-le-Gesnois',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 54841.96872895832,
                position: 190025.965,
                duration: 0,
                id: 'd9a52b18-6667-11e3-89ff-01f464e0362d',
                name: 'Champagné',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 55002.021632652955,
                position: 199308.965,
                duration: 0,
                id: 'd97a0c7c-6667-11e3-89ff-01f464e0362d',
                name: 'Le Mans',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 55029.224930758915,
                position: 200230.965,
                duration: 0,
                id: 'd9b6e040-6667-11e3-89ff-01f464e0362d',
                name: 'Le Mans',
                line_code: 420000,
                track_number: 388,
                line_name: 'Ligne de Paris-Montparnasse à Brest',
                track_name: 'Voie V1 de Paris-Montparnasse à Brest',
              },
              {
                time: 55100.26030786709,
                position: 201408.607,
                duration: 1,
                id: null,
                name: null,
                line_code: 450000,
                track_number: 424,
                line_name: 'Ligne du Mans à Angers-Maître-École',
                track_name: 'Voie 2',
              },
            ],
            route_aspects: [
              {
                signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
                time_start: 52200,
                time_end: 52237.314,
                position_start: 320.965,
                position_end: 605.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '69ca947c-6667-11e3-81ff-01f464e0362d',
                track_offset: 496,
              },
              {
                signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
                time_start: 52237.314,
                time_end: 52266.409,
                position_start: 320.965,
                position_end: 605.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '69ca947c-6667-11e3-81ff-01f464e0362d',
                track_offset: 496,
              },
              {
                signal_id: '6b501834-9806-11e4-a3ff-01a064e0362d',
                time_start: 52266.409,
                time_end: 52314.491,
                position_start: 320.965,
                position_end: 605.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '69ca947c-6667-11e3-81ff-01f464e0362d',
                track_offset: 496,
              },
              {
                signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
                time_start: 52237.314,
                time_end: 52254.413,
                position_start: 605.965,
                position_end: 1410.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60c895c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 51,
              },
              {
                signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
                time_start: 52254.413,
                time_end: 52314.491,
                position_start: 605.965,
                position_end: 1410.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60c895c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 51,
              },
              {
                signal_id: 'c4f61c7c-4964-11e4-9bff-012064e0362d',
                time_start: 52314.491,
                time_end: 52349.366,
                position_start: 605.965,
                position_end: 1410.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60c895c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 51,
              },
              {
                signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
                time_start: 52278.49,
                time_end: 52302.49,
                position_start: 1410.965,
                position_end: 2157.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '61a60592-6667-11e3-81ff-01f464e0362d',
                track_offset: 358,
              },
              {
                signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
                time_start: 52302.49,
                time_end: 52349.366,
                position_start: 1410.965,
                position_end: 2157.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '61a60592-6667-11e3-81ff-01f464e0362d',
                track_offset: 358,
              },
              {
                signal_id: 'b471f9cc-4964-11e4-9bff-012064e0362d',
                time_start: 52349.366,
                time_end: 52385.344,
                position_start: 1410.965,
                position_end: 2157.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '61a60592-6667-11e3-81ff-01f464e0362d',
                track_offset: 358,
              },
              {
                signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
                time_start: 52322.969,
                time_end: 52341.36,
                position_start: 2157.965,
                position_end: 3139.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '61a460c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 248,
              },
              {
                signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
                time_start: 52341.36,
                time_end: 52385.344,
                position_start: 2157.965,
                position_end: 3139.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '61a460c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 248,
              },
              {
                signal_id: 'c2a51210-4964-11e4-9bff-012064e0362d',
                time_start: 52385.344,
                time_end: 52445.395,
                position_start: 2157.965,
                position_end: 3139.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '61a460c8-6667-11e3-81ff-01f464e0362d',
                track_offset: 248,
              },
              {
                signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
                time_start: 52363.556,
                time_end: 52377.522,
                position_start: 3139.965,
                position_end: 4890.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '61a465bc-6667-11e3-81ff-01f464e0362d',
                track_offset: 544,
              },
              {
                signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
                time_start: 52377.522,
                time_end: 52445.395,
                position_start: 3139.965,
                position_end: 4890.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '61a465bc-6667-11e3-81ff-01f464e0362d',
                track_offset: 544,
              },
              {
                signal_id: 'bd8121ea-4964-11e4-9bff-012064e0362d',
                time_start: 52445.395,
                time_end: 52483.463,
                position_start: 3139.965,
                position_end: 4890.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '61a465bc-6667-11e3-81ff-01f464e0362d',
                track_offset: 544,
              },
              {
                signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
                time_start: 52427.432,
                time_end: 52439.619,
                position_start: 4890.965,
                position_end: 6365.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8b696-6667-11e3-81ff-01f464e0362d',
                track_offset: 1393,
              },
              {
                signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
                time_start: 52439.619,
                time_end: 52483.463,
                position_start: 4890.965,
                position_end: 6365.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8b696-6667-11e3-81ff-01f464e0362d',
                track_offset: 1393,
              },
              {
                signal_id: '08088afa-4964-11e4-b5ff-012064e0362d',
                time_start: 52483.463,
                time_end: 52536.164,
                position_start: 4890.965,
                position_end: 6365.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8b696-6667-11e3-81ff-01f464e0362d',
                track_offset: 1393,
              },
              {
                signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
                time_start: 52468.88,
                time_end: 52478.776,
                position_start: 6365.965,
                position_end: 8655.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 869,
              },
              {
                signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
                time_start: 52478.776,
                time_end: 52536.164,
                position_start: 6365.965,
                position_end: 8655.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 869,
              },
              {
                signal_id: 'bd235ff0-4964-11e4-9bff-012064e0362d',
                time_start: 52536.164,
                time_end: 52577.883,
                position_start: 6365.965,
                position_end: 8655.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 869,
              },
              {
                signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
                time_start: 52521.903,
                time_end: 52531.348,
                position_start: 8655.965,
                position_end: 10695.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 3159,
              },
              {
                signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
                time_start: 52531.348,
                time_end: 52577.883,
                position_start: 8655.965,
                position_end: 10695.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 3159,
              },
              {
                signal_id: 'ca79d026-4964-11e4-9bff-012064e0362d',
                time_start: 52577.883,
                time_end: 52623.329,
                position_start: 8655.965,
                position_end: 10695.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 3159,
              },
              {
                signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
                time_start: 52566.81,
                time_end: 52574.278,
                position_start: 10695.965,
                position_end: 13220.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 5199,
              },
              {
                signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
                time_start: 52574.278,
                time_end: 52623.329,
                position_start: 10695.965,
                position_end: 13220.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 5199,
              },
              {
                signal_id: 'c1c390a6-4964-11e4-9bff-012064e0362d',
                time_start: 52623.329,
                time_end: 52661.71,
                position_start: 10695.965,
                position_end: 13220.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '63b8bb18-6667-11e3-81ff-01f464e0362d',
                track_offset: 5199,
              },
              {
                signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
                time_start: 52612.531,
                time_end: 52619.73,
                position_start: 13220.965,
                position_end: 15353.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
                track_offset: 10,
              },
              {
                signal_id: 'c5b7daa4-4964-11e4-9bff-012064e0362d',
                time_start: 52619.73,
                time_end: 52661.71,
                position_start: 13220.965,
                position_end: 15353.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '6cf348ea-d40e-11eb-80ff-01f06fb51c27',
                track_offset: 10,
              },
              {
                signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
                time_start: 54668.402,
                time_end: 54674.949,
                position_start: 179935.965,
                position_end: 181568.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
                track_offset: 924,
              },
              {
                signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
                time_start: 54674.949,
                time_end: 54705.492,
                position_start: 179935.965,
                position_end: 181568.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
                track_offset: 924,
              },
              {
                signal_id: 'c2829dcc-4964-11e4-9bff-012064e0362d',
                time_start: 54705.492,
                time_end: 54740.385,
                position_start: 179935.965,
                position_end: 181568.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '26acd7d2-ab45-11e6-90ff-013864e0362d',
                track_offset: 924,
              },
              {
                signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
                time_start: 54695.388,
                time_end: 54702.113,
                position_start: 181568.965,
                position_end: 183628.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
                track_offset: 235,
              },
              {
                signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
                time_start: 54702.113,
                time_end: 54740.385,
                position_start: 181568.965,
                position_end: 183628.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
                track_offset: 235,
              },
              {
                signal_id: 'c5283c5c-4964-11e4-9bff-012064e0362d',
                time_start: 54740.385,
                time_end: 54767.834,
                position_start: 181568.965,
                position_end: 183628.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca2c74-6667-11e3-81ff-01f464e0362d',
                track_offset: 235,
              },
              {
                signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
                time_start: 54730.332,
                time_end: 54737.048,
                position_start: 183628.965,
                position_end: 185298.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 1140,
              },
              {
                signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
                time_start: 54737.048,
                time_end: 54767.834,
                position_start: 183628.965,
                position_end: 185298.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 1140,
              },
              {
                signal_id: 'cccd45ca-4964-11e4-9bff-012064e0362d',
                time_start: 54767.834,
                time_end: 54795.488,
                position_start: 183628.965,
                position_end: 185298.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 1140,
              },
              {
                signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
                time_start: 54758.016,
                time_end: 54764.561,
                position_start: 185298.965,
                position_end: 186988.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 2810,
              },
              {
                signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
                time_start: 54764.561,
                time_end: 54795.488,
                position_start: 185298.965,
                position_end: 186988.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 2810,
              },
              {
                signal_id: 'c590d9a2-4964-11e4-9bff-012064e0362d',
                time_start: 54795.488,
                time_end: 54822.161,
                position_start: 185298.965,
                position_end: 186988.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 2810,
              },
              {
                signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
                time_start: 54785.67,
                time_end: 54792.215,
                position_start: 186988.965,
                position_end: 188618.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 4500,
              },
              {
                signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
                time_start: 54792.215,
                time_end: 54822.161,
                position_start: 186988.965,
                position_end: 188618.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 4500,
              },
              {
                signal_id: 'd22b6fc8-4964-11e4-9bff-012064e0362d',
                time_start: 54822.161,
                time_end: 54849.061,
                position_start: 186988.965,
                position_end: 188618.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 4500,
              },
              {
                signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
                time_start: 54812.342,
                time_end: 54818.888,
                position_start: 188618.965,
                position_end: 190262.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 6130,
              },
              {
                signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
                time_start: 54818.888,
                time_end: 54849.061,
                position_start: 188618.965,
                position_end: 190262.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 6130,
              },
              {
                signal_id: '0e17bac8-4964-11e4-b5ff-012064e0362d',
                time_start: 54849.061,
                time_end: 54876.698,
                position_start: 188618.965,
                position_end: 190262.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca365e-6667-11e3-81ff-01f464e0362d',
                track_offset: 6130,
              },
              {
                signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
                time_start: 54839.244,
                time_end: 54845.789,
                position_start: 190262.965,
                position_end: 191951.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca4278-6667-11e3-81ff-01f464e0362d',
                track_offset: 264,
              },
              {
                signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
                time_start: 54845.789,
                time_end: 54876.698,
                position_start: 190262.965,
                position_end: 191951.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca4278-6667-11e3-81ff-01f464e0362d',
                track_offset: 264,
              },
              {
                signal_id: 'c5b7cfae-4964-11e4-9bff-012064e0362d',
                time_start: 54876.698,
                time_end: 54908.312,
                position_start: 190262.965,
                position_end: 191951.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca4278-6667-11e3-81ff-01f464e0362d',
                track_offset: 264,
              },
              {
                signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
                time_start: 54866.88,
                time_end: 54873.425,
                position_start: 191951.965,
                position_end: 193883.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 1085,
              },
              {
                signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
                time_start: 54873.425,
                time_end: 54908.312,
                position_start: 191951.965,
                position_end: 193883.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 1085,
              },
              {
                signal_id: 'b43764bc-4964-11e4-9bff-012064e0362d',
                time_start: 54908.312,
                time_end: 54940.303,
                position_start: 191951.965,
                position_end: 193883.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 1085,
              },
              {
                signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
                time_start: 54898.494,
                time_end: 54905.039,
                position_start: 193883.965,
                position_end: 195838.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 3017,
              },
              {
                signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
                time_start: 54905.039,
                time_end: 54940.303,
                position_start: 193883.965,
                position_end: 195838.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 3017,
              },
              {
                signal_id: 'ccd9bb06-4964-11e4-9bff-012064e0362d',
                time_start: 54940.303,
                time_end: 54967.971,
                position_start: 193883.965,
                position_end: 195838.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 3017,
              },
              {
                signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
                time_start: 54930.485,
                time_end: 54937.03,
                position_start: 195838.965,
                position_end: 197501.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 4972,
              },
              {
                signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
                time_start: 54937.03,
                time_end: 54967.971,
                position_start: 195838.965,
                position_end: 197501.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 4972,
              },
              {
                signal_id: 'ce2c9c8c-4964-11e4-9bff-012064e0362d',
                time_start: 54967.971,
                time_end: 55001.398,
                position_start: 195838.965,
                position_end: 197501.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 4972,
              },
              {
                signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
                time_start: 54957.698,
                time_end: 54964.444,
                position_start: 197501.965,
                position_end: 199088.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 6635,
              },
              {
                signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
                time_start: 54964.444,
                time_end: 55001.398,
                position_start: 197501.965,
                position_end: 199088.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 6635,
              },
              {
                signal_id: 'd3769d46-4964-11e4-9bff-012064e0362d',
                time_start: 55001.398,
                time_end: 55027.654,
                position_start: 197501.965,
                position_end: 199088.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 6635,
              },
              {
                signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
                time_start: 54987.326,
                time_end: 54996.442,
                position_start: 199088.965,
                position_end: 199992.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 8222,
              },
              {
                signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
                time_start: 54996.442,
                time_end: 55027.654,
                position_start: 199088.965,
                position_end: 199992.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 8222,
              },
              {
                signal_id: 'b5c72c96-4964-11e4-9bff-012064e0362d',
                time_start: 55027.654,
                time_end: 55052.86,
                position_start: 199088.965,
                position_end: 199992.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '8f8db646-c8cb-11e9-a9ff-01f06fb51c27',
                track_offset: 8222,
              },
              {
                signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
                time_start: 55009.282,
                time_end: 55020.931,
                position_start: 199992.965,
                position_end: 200671.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
                track_offset: 684,
              },
              {
                signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
                time_start: 55020.931,
                time_end: 55052.86,
                position_start: 199992.965,
                position_end: 200671.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
                track_offset: 684,
              },
              {
                signal_id: 'ba53b30c-4964-11e4-9bff-012064e0362d',
                time_start: 55052.86,
                time_end: 55100.26030786709,
                position_start: 199992.965,
                position_end: 200671.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '60ca5a1c-6667-11e3-81ff-01f464e0362d',
                track_offset: 684,
              },
              {
                signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
                time_start: 55030.495,
                time_end: 55044.91,
                position_start: 200671.965,
                position_end: 201657.965,
                color: -16711936,
                blinking: false,
                aspect_label: 'VL',
                track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
                track_offset: 12,
              },
              {
                signal_id: 'b582914a-4964-11e4-9bff-012064e0362d',
                time_start: 55044.91,
                time_end: 55100.26030786709,
                position_start: 200671.965,
                position_end: 201657.965,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
                track: '60ca76b8-6667-11e3-81ff-01f464e0362d',
                track_offset: 12,
              },
              {
                signal_id: 'b564cfd6-4964-11e4-9bff-012064e0362d',
                time_start: 52200,
                time_end: 55100.26030786709,
                position_start: 201657.965,
                position_end: 201657.965,
                color: -256,
                blinking: false,
                aspect_label: 'A',
                track: '6058b958-6667-11e3-81ff-01f464e0362d',
                track_offset: 705,
              },
            ],
            mechanical_energy_consumed: 12083466761.106243,
          },
          speed_limit_tags: 'Aucune composition',
          electrification_ranges: [
            {
              electrificationUsage: {
                mode: '1500V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 0,
              stop: 6503.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: true,
                object_type: 'Neutral',
              },
              start: 6503.965,
              stop: 7106.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 7106.965,
              stop: 63305.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 63305.965,
              stop: 63996.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 63996.965,
              stop: 93473.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 93473.965,
              stop: 94165.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 94165.965,
              stop: 131273.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 131273.965,
              stop: 131965.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 131965.965,
              stop: 179005.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: false,
                object_type: 'Neutral',
              },
              start: 179005.965,
              stop: 179011.965,
            },
            {
              electrificationUsage: {
                mode: '25000V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 179011.965,
              stop: 179841.965,
            },
            {
              electrificationUsage: {
                lower_pantograph: true,
                object_type: 'Neutral',
              },
              start: 179841.965,
              stop: 180550.965,
            },
            {
              electrificationUsage: {
                mode: '1500V',
                mode_handled: true,
                object_type: 'Electrified',
                profile_handled: true,
              },
              start: 180550.965,
              stop: 201408.607,
            },
          ],
          power_restriction_ranges: [],
        },
      ],
    },
    future: [],
  },
};

export const OSRD_ROLLINGSTOCKSELECTED_SAMPLE_DATA = {
  name: 'XYZ77777',
  metadata: {
    series: 'XYZ 77777 ',
    unit: 'XYZ',
  },
};

export default ORSD_GRAPH_SAMPLE_DATA;
