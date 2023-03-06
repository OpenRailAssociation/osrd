// data sample for GET and GEV
const ORSD_GRAPH_SAMPLE_DATA = {
  allowancesSettings: {
    16: {
      base: true,
      baseBlocks: true,
      eco: true,
      ecoBlocks: false,
    },
  },
  positionValues: {
    headPosition: {
      position: 40.79330208661017,
      speed: null,
      time: '1900-01-01T08:30:44.897Z',
    },
    tailPosition: {
      position: 20.89579117704591,
      speed: null,
      time: '1900-01-01T08:30:44.897Z',
    },
    routeEndOccupancy: {
      position: 0,
      speed: null,
      time: '1900-01-01T08:30:44.897Z',
    },
    routeBeginOccupancy: {
      position: 477.46298045501817,
      speed: null,
      time: '1900-01-01T08:30:44.897Z',
    },
    speed: {
      position: 40.61770668915792,
      speed: 43.539842793701155,
      time: '1900-01-01T08:30:44.897Z',
    },
  },
  selectedProjection: {
    id: 16,
    train_name: 'total',
    departure_time: 31200,
    initial_speed: 0,
    labels: [],
    allowances: [],
    speed_limit_category: 'foo',
    timetable: 4,
    rolling_stock: 13,
    path: 29,
  },
  selectedTrain: 0,
  speedSpaceSettings: {
    altitude: false,
    curves: false,
    maxSpeed: true,
    slopes: false,
  },
  timePosition: '1900-01-01T08:30:44.897Z',
  departureArrivalTimes: [
    {
      labels: [],
      name: 'total',
      departure: 31200,
      arrival: 31527.546081260843,
    },
  ],
  simulation: {
    past: [
      {
        trains: [],
      },
      {
        trains: [
          {
            id: 16,
            labels: [],
            path: 29,
            name: 'total',
            modes_and_profiles: [
              { start: 0, stop: 900, used_mode: '1500', used_profile: 'O' },
              { start: 900, stop: 1200, used_mode: '1500', used_profile: 'A' },
              { start: 1200, stop: 1350, used_mode: '1500', used_profile: 'O' },
              { start: 1350, stop: 3400, used_mode: '1500', used_profile: 'B1' },
              { start: 3400, stop: 3900, used_mode: '1500', used_profile: 'E' },
              { start: 3900, stop: 4800, used_mode: '25000', used_profile: 'B' },
              { start: 4800, stop: 4950, used_mode: '1500', used_profile: 'O' },
              { start: 4950, stop: 7600, used_mode: '1500' },
              { start: 7600, stop: 7850, used_mode: '25000', used_profile: '25000' },
              { start: 7850, stop: 8500, used_mode: '25000', used_profile: '20000' },
              { start: 8500, stop: 9350, used_mode: '25000', used_profile: '22500' },
            ],
            vmax: [
              {
                speed: 33.333333333333336,
                position: 0,
              },
              {
                speed: 33.333333333333336,
                position: 9349.245104289796,
              },
            ],
            slopes: [
              {
                gradient: 0,
                position: 0,
              },
              {
                gradient: 0,
                position: 4707.462980455019,
              },
              {
                gradient: -3,
                position: 4707.462980455019,
              },
              {
                gradient: -3,
                position: 5007.462980455019,
              },
              {
                gradient: -6,
                position: 5007.462980455019,
              },
              {
                gradient: -6,
                position: 5407.462980455019,
              },
              {
                gradient: -3,
                position: 5407.462980455019,
              },
              {
                gradient: -3,
                position: 5707.462980455019,
              },
              {
                gradient: 0,
                position: 5707.462980455019,
              },
              {
                gradient: 0,
                position: 7707.462980455019,
              },
              {
                gradient: 3,
                position: 7707.462980455019,
              },
              {
                gradient: 3,
                position: 8007.462980455019,
              },
              {
                gradient: 6,
                position: 8007.462980455019,
              },
              {
                gradient: 6,
                position: 8407.462980455019,
              },
              {
                gradient: 3,
                position: 8407.462980455019,
              },
              {
                gradient: 3,
                position: 8707.462980455019,
              },
              {
                gradient: 0,
                position: 8707.462980455019,
              },
              {
                gradient: 0,
                position: 9349.245104289796,
              },
            ],
            curves: [
              {
                radius: 0,
                position: 0,
              },
              {
                radius: 0,
                position: 9349.245104289796,
              },
            ],
            base: {
              head_positions: [
                [
                  {
                    time: 31200,
                    position: 0,
                  },
                  {
                    time: 31202,
                    position: 5.426054740359632,
                  },
                  {
                    time: 31206,
                    position: 41.72807921688059,
                  },
                  {
                    time: 31210,
                    position: 100.01430606310873,
                  },
                  {
                    time: 31214,
                    position: 174.18222411167721,
                  },
                  {
                    time: 31218,
                    position: 261.31197574861244,
                  },
                  {
                    time: 31222,
                    position: 359.5959218875846,
                  },
                  {
                    time: 31226,
                    position: 467.759190267137,
                  },
                  {
                    time: 31232,
                    position: 646.4656234538966,
                  },
                  {
                    time: 31459.879414594176,
                    position: 8238.133993178684,
                  },
                  {
                    time: 31468.546081260843,
                    position: 8508.245104289796,
                  },
                  {
                    time: 31474.546081260843,
                    position: 8673.245104289796,
                  },
                  {
                    time: 31482.546081260843,
                    position: 8865.245104289796,
                  },
                  {
                    time: 31490.546081260843,
                    position: 9025.245104289796,
                  },
                  {
                    time: 31498.546081260843,
                    position: 9153.245104289796,
                  },
                  {
                    time: 31504.546081260843,
                    position: 9228.245104289796,
                  },
                  {
                    time: 31512.546081260843,
                    position: 9300.245104289796,
                  },
                  {
                    time: 31520.546081260843,
                    position: 9340.245104289796,
                  },
                  {
                    time: 31527.546081260843,
                    position: 9349.245104289796,
                  },
                ],
              ],
              tail_positions: [
                [
                  {
                    time: 31200,
                    position: 0,
                  },
                  {
                    time: 31202,
                    position: 0,
                  },
                  {
                    time: 31206,
                    position: 21.448079216880586,
                  },
                  {
                    time: 31210,
                    position: 79.73430606310873,
                  },
                  {
                    time: 31214,
                    position: 153.9022241116772,
                  },
                  {
                    time: 31218,
                    position: 241.03197574861244,
                  },
                  {
                    time: 31222,
                    position: 339.31592188758464,
                  },
                  {
                    time: 31226,
                    position: 447.479190267137,
                  },
                  {
                    time: 31232,
                    position: 626.1856234538966,
                  },
                  {
                    time: 31459.879414594176,
                    position: 8217.853993178684,
                  },
                  {
                    time: 31468.546081260843,
                    position: 8487.965104289795,
                  },
                  {
                    time: 31474.546081260843,
                    position: 8652.965104289795,
                  },
                  {
                    time: 31482.546081260843,
                    position: 8844.965104289795,
                  },
                  {
                    time: 31490.546081260843,
                    position: 9004.965104289795,
                  },
                  {
                    time: 31498.546081260843,
                    position: 9132.965104289795,
                  },
                  {
                    time: 31504.546081260843,
                    position: 9207.965104289795,
                  },
                  {
                    time: 31512.546081260843,
                    position: 9279.965104289795,
                  },
                  {
                    time: 31520.546081260843,
                    position: 9319.965104289795,
                  },
                  {
                    time: 31527.546081260843,
                    position: 9328.965104289795,
                  },
                ],
              ],
              route_begin_occupancy: [
                [
                  {
                    time: 31200,
                    position: 0,
                  },
                  {
                    time: 31200,
                    position: 477.46298045501817,
                  },
                  {
                    time: 31226.343,
                    position: 477.46298045501817,
                  },
                  {
                    time: 31226.343,
                    position: 4107.462980455019,
                  },
                  {
                    time: 31335.959,
                    position: 4107.462980455019,
                  },
                  {
                    time: 31335.959,
                    position: 8907.462980455019,
                  },
                  {
                    time: 31484.507,
                    position: 8907.462980455019,
                  },
                  {
                    time: 31484.507,
                    position: 9349.245104289796,
                  },
                  {
                    time: 31527.545,
                    position: 9349.245104289796,
                  },
                ],
              ],
              route_end_occupancy: [
                [
                  {
                    time: 31204.012,
                    position: 0,
                  },
                  {
                    time: 31227.052,
                    position: 0,
                  },
                  {
                    time: 31227.052,
                    position: 477.46298045501817,
                  },
                  {
                    time: 31485.483,
                    position: 477.46298045501817,
                  },
                  {
                    time: 31485.483,
                    position: 4107.462980455019,
                  },
                  {
                    time: 31527.545,
                    position: 4107.462980455019,
                  },
                  {
                    time: 31527.545,
                    position: 8907.462980455019,
                  },
                  {
                    time: 31527.545,
                    position: 8907.462980455019,
                  },
                  {
                    time: 31527.545,
                    position: 9349.245104289796,
                  },
                ],
              ],
              speeds: [
                {
                  time: 31200,
                  speed: 0,
                  position: 0,
                },
                {
                  time: 31202,
                  speed: 5.426054740359583,
                  position: 5.426054740359583,
                },
                {
                  time: 31204,
                  speed: 9.315338129894915,
                  position: 20.16744761061408,
                },
                {
                  time: 31206,
                  speed: 12.24529347637165,
                  position: 41.728079216880644,
                },
                {
                  time: 31208,
                  speed: 14.653763328200775,
                  position: 68.62713602145307,
                },
                {
                  time: 31210,
                  speed: 16.73340671345493,
                  position: 100.01430606310878,
                },
                {
                  time: 31214,
                  speed: 20.263887629643204,
                  position: 174.1822241116772,
                },
                {
                  time: 31218,
                  speed: 23.245696950370917,
                  position: 261.31197574861255,
                },
                {
                  time: 31224,
                  speed: 27.055980970687834,
                  position: 412.50871042488404,
                },
                {
                  time: 31230,
                  speed: 30.318700005818712,
                  position: 584.8335602944686,
                },
                {
                  time: 31236.313033008424,
                  speed: 33.333333333333336,
                  position: 785.9212736535599,
                },
                {
                  time: 31459.879414594176,
                  speed: 33.333333333333336,
                  position: 8238.133993178684,
                },
                {
                  time: 31468.546081260843,
                  speed: 29,
                  position: 8508.245104289796,
                },
                {
                  time: 31476.546081260843,
                  speed: 25,
                  position: 8724.245104289796,
                },
                {
                  time: 31484.546081260843,
                  speed: 21,
                  position: 8908.245104289796,
                },
                {
                  time: 31492.546081260843,
                  speed: 17,
                  position: 9060.245104289796,
                },
                {
                  time: 31500.546081260843,
                  speed: 13,
                  position: 9180.245104289796,
                },
                {
                  time: 31508.546081260843,
                  speed: 9,
                  position: 9268.245104289796,
                },
                {
                  time: 31512.546081260843,
                  speed: 7,
                  position: 9300.245104289796,
                },
                {
                  time: 31516.546081260843,
                  speed: 5,
                  position: 9324.245104289796,
                },
                {
                  time: 31520.546081260843,
                  speed: 3,
                  position: 9340.245104289796,
                },
                {
                  time: 31522.546081260843,
                  speed: 2,
                  position: 9345.245104289796,
                },
                {
                  time: 31524.546081260843,
                  speed: 1,
                  position: 9348.245104289796,
                },
                {
                  time: 31527.546081260843,
                  speed: 0,
                  position: 9349.245104289796,
                },
              ],
              stops: [
                {
                  id: null,
                  name: null,
                  time: 31200,
                  duration: 0,
                  position: 0,
                  line_code: 424242,
                  line_name: 'West_parking',
                  track_name: 'A',
                  track_number: 3,
                },
                {
                  id: null,
                  name: null,
                  time: 31527.546081260843,
                  duration: 1,
                  position: 9349.245104289796,
                  line_code: 434343,
                  line_name: 'West_to_East_road',
                  track_name: 'V2',
                  track_number: 2,
                },
              ],
              route_aspects: [
                {
                  signal_id: 'SA1',
                  route_id: 'rt.DA1->DA7_2',
                  time_start: 31226.343,
                  time_end: 31336.567,
                  position_start: 477.46298045501817,
                  position_end: 4107.462980455019,
                  color: -65536,
                  blinking: false,
                },
                {
                  signal_id: 'SA1',
                  route_id: 'rt.DA1->DA7_2',
                  time_start: 31336.567,
                  time_end: 31485.483,
                  position_start: 477.46298045501817,
                  position_end: 4107.462980455019,
                  color: -256,
                  blinking: false,
                },
                {
                  signal_id: 'SA1',
                  route_id: 'rt.DA1->DA7_2',
                  time_start: 31208.59,
                  time_end: 31226.343,
                  position_start: 477.46298045501817,
                  position_end: 4107.462980455019,
                  color: -16711936,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_2r',
                  route_id: 'rt.DA7_2->DA7_5',
                  time_start: 31335.959,
                  time_end: 31485.483,
                  position_start: 4107.462980455019,
                  position_end: 8907.462980455019,
                  color: -65536,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_2r',
                  route_id: 'rt.DA7_2->DA7_5',
                  time_start: 31485.483,
                  time_end: 31527.545,
                  position_start: 4107.462980455019,
                  position_end: 8907.462980455019,
                  color: -256,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_2r',
                  route_id: 'rt.DA7_2->DA7_5',
                  time_start: 31323.959,
                  time_end: 31335.959,
                  position_start: 4107.462980455019,
                  position_end: 8907.462980455019,
                  color: -16711936,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_5r',
                  route_id: 'rt.DA7_5->DA6',
                  time_start: 31484.507,
                  time_end: 31527.545,
                  position_start: 8907.462980455019,
                  position_end: 9349.245104289796,
                  color: -65536,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_5r',
                  route_id: 'rt.DA7_5->DA6',
                  time_start: 31468.518,
                  time_end: 31484.507,
                  position_start: 8907.462980455019,
                  position_end: 9349.245104289796,
                  color: -16711936,
                  blinking: false,
                },
              ],
              signal_aspects: [
                {
                  signal_id: 'SA7_5r',
                  time_start: 31484.507,
                  time_end: 31527.545,
                  color: -65536,
                  blinking: false,
                  aspect_label: 'S',
                },
                {
                  signal_id: 'SA7_2',
                  time_start: 31226.343,
                  time_end: 31336.567,
                  color: -65536,
                  blinking: false,
                  aspect_label: 'S',
                },
                {
                  signal_id: 'SA7_3',
                  time_start: 31226.343,
                  time_end: 31335.959,
                  color: -256,
                  blinking: false,
                  aspect_label: 'S A',
                },
                {
                  signal_id: 'SA7_3',
                  time_start: 31335.959,
                  time_end: 31485.483,
                  color: -65536,
                  blinking: false,
                  aspect_label: 'S',
                },
                {
                  signal_id: 'SA7_1',
                  time_start: 31226.343,
                  time_end: 31336.567,
                  color: -65536,
                  blinking: false,
                  aspect_label: 'S',
                },
                {
                  signal_id: 'SA7_1',
                  time_start: 31336.567,
                  time_end: 31527.545,
                  color: -256,
                  blinking: false,
                  aspect_label: 'S A',
                },
                {
                  signal_id: 'SA7_5',
                  time_start: 31335.959,
                  time_end: 31485.483,
                  color: -65536,
                  blinking: false,
                  aspect_label: 'S',
                },
                {
                  signal_id: 'SA7_2r',
                  time_start: 31335.959,
                  time_end: 31485.483,
                  color: -65536,
                  blinking: false,
                  aspect_label: 'S',
                },
                {
                  signal_id: 'SA7_2r',
                  time_start: 31485.483,
                  time_end: 31527.545,
                  color: -256,
                  blinking: false,
                  aspect_label: 'S A',
                },
                {
                  signal_id: 'SA7_4',
                  time_start: 31335.959,
                  time_end: 31485.483,
                  color: -65536,
                  blinking: false,
                  aspect_label: 'S',
                },
                {
                  signal_id: 'SA1',
                  time_start: 31226.343,
                  time_end: 31336.567,
                  color: -65536,
                  blinking: false,
                  aspect_label: 'CARRE',
                },
                {
                  signal_id: 'SA1',
                  time_start: 31336.567,
                  time_end: 31485.483,
                  color: -256,
                  blinking: false,
                  aspect_label: 'CARRE A',
                },
                {
                  signal_id: 'SA7_5r',
                  time_start: 31468.518,
                  time_end: 31484.507,
                  color: -16711936,
                  blinking: false,
                  aspect_label: 'S VL',
                },
                {
                  signal_id: 'SA1',
                  time_start: 31208.59,
                  time_end: 31226.343,
                  color: -16711936,
                  blinking: false,
                  aspect_label: 'CARRE VL',
                },
                {
                  signal_id: 'SA7_2r',
                  time_start: 31323.959,
                  time_end: 31335.959,
                  color: -16711936,
                  blinking: false,
                  aspect_label: 'S VL',
                },
              ],
            },
          },
        ],
      },
      {
        trains: [
          {
            id: 16,
            labels: [],
            path: 29,
            name: 'total',
            modes_and_profiles: [
              { start: 0, stop: 900, used_mode: '1500', used_profile: 'O' },
              { start: 900, stop: 1200, used_mode: '1500', used_profile: 'A' },
              { start: 1200, stop: 1350, used_mode: '1500', used_profile: 'O' },
              { start: 1350, stop: 3400, used_mode: '1500', used_profile: 'B1' },
              { start: 3400, stop: 3900, used_mode: '1500', used_profile: 'E' },
              { start: 3900, stop: 4800, used_mode: '25000', used_profile: 'B' },
              { start: 4800, stop: 4950, used_mode: '1500', used_profile: 'O' },
              { start: 4950, stop: 7600, used_mode: '1500' },
              { start: 7600, stop: 7850, used_mode: '25000', used_profile: '25000' },
              { start: 7850, stop: 8500, used_mode: '25000', used_profile: '20000' },
              { start: 8500, stop: 9350, used_mode: '25000', used_profile: '22500' },
            ],
            vmax: [
              {
                speed: 33.333333333333336,
                position: 0,
              },
              {
                speed: 33.333333333333336,
                position: 9349.245104289796,
              },
            ],
            slopes: [
              {
                gradient: 0,
                position: 0,
              },
              {
                gradient: 0,
                position: 4707.462980455019,
              },
              {
                gradient: -3,
                position: 4707.462980455019,
              },
              {
                gradient: -3,
                position: 5007.462980455019,
              },
              {
                gradient: -6,
                position: 5007.462980455019,
              },
              {
                gradient: -6,
                position: 5407.462980455019,
              },
              {
                gradient: -3,
                position: 5407.462980455019,
              },
              {
                gradient: -3,
                position: 5707.462980455019,
              },
              {
                gradient: 0,
                position: 5707.462980455019,
              },
              {
                gradient: 0,
                position: 7707.462980455019,
              },
              {
                gradient: 3,
                position: 7707.462980455019,
              },
              {
                gradient: 3,
                position: 8007.462980455019,
              },
              {
                gradient: 6,
                position: 8007.462980455019,
              },
              {
                gradient: 6,
                position: 8407.462980455019,
              },
              {
                gradient: 3,
                position: 8407.462980455019,
              },
              {
                gradient: 3,
                position: 8707.462980455019,
              },
              {
                gradient: 0,
                position: 8707.462980455019,
              },
              {
                gradient: 0,
                position: 9349.245104289796,
              },
            ],
            curves: [
              {
                radius: 0,
                position: 0,
              },
              {
                radius: 0,
                position: 9349.245104289796,
              },
            ],
            base: {
              head_positions: [
                [
                  {
                    time: 31200,
                    position: 0,
                  },
                  {
                    time: 31202,
                    position: 5.426054740359632,
                  },
                  {
                    time: 31206,
                    position: 41.72807921688059,
                  },
                  {
                    time: 31210,
                    position: 100.01430606310873,
                  },
                  {
                    time: 31214,
                    position: 174.18222411167721,
                  },
                  {
                    time: 31218,
                    position: 261.31197574861244,
                  },
                  {
                    time: 31222,
                    position: 359.5959218875846,
                  },
                  {
                    time: 31226,
                    position: 467.759190267137,
                  },
                  {
                    time: 31232,
                    position: 646.4656234538966,
                  },
                  {
                    time: 31459.879414594176,
                    position: 8238.133993178684,
                  },
                  {
                    time: 31468.546081260843,
                    position: 8508.245104289796,
                  },
                  {
                    time: 31474.546081260843,
                    position: 8673.245104289796,
                  },
                  {
                    time: 31482.546081260843,
                    position: 8865.245104289796,
                  },
                  {
                    time: 31490.546081260843,
                    position: 9025.245104289796,
                  },
                  {
                    time: 31498.546081260843,
                    position: 9153.245104289796,
                  },
                  {
                    time: 31504.546081260843,
                    position: 9228.245104289796,
                  },
                  {
                    time: 31512.546081260843,
                    position: 9300.245104289796,
                  },
                  {
                    time: 31520.546081260843,
                    position: 9340.245104289796,
                  },
                  {
                    time: 31527.546081260843,
                    position: 9349.245104289796,
                  },
                ],
              ],
              tail_positions: [
                [
                  {
                    time: 31200,
                    position: 0,
                  },
                  {
                    time: 31202,
                    position: 0,
                  },
                  {
                    time: 31206,
                    position: 21.448079216880586,
                  },
                  {
                    time: 31210,
                    position: 79.73430606310873,
                  },
                  {
                    time: 31214,
                    position: 153.9022241116772,
                  },
                  {
                    time: 31218,
                    position: 241.03197574861244,
                  },
                  {
                    time: 31222,
                    position: 339.31592188758464,
                  },
                  {
                    time: 31226,
                    position: 447.479190267137,
                  },
                  {
                    time: 31232,
                    position: 626.1856234538966,
                  },
                  {
                    time: 31459.879414594176,
                    position: 8217.853993178684,
                  },
                  {
                    time: 31468.546081260843,
                    position: 8487.965104289795,
                  },
                  {
                    time: 31474.546081260843,
                    position: 8652.965104289795,
                  },
                  {
                    time: 31482.546081260843,
                    position: 8844.965104289795,
                  },
                  {
                    time: 31490.546081260843,
                    position: 9004.965104289795,
                  },
                  {
                    time: 31498.546081260843,
                    position: 9132.965104289795,
                  },
                  {
                    time: 31504.546081260843,
                    position: 9207.965104289795,
                  },
                  {
                    time: 31512.546081260843,
                    position: 9279.965104289795,
                  },
                  {
                    time: 31520.546081260843,
                    position: 9319.965104289795,
                  },
                  {
                    time: 31527.546081260843,
                    position: 9328.965104289795,
                  },
                ],
              ],
              route_end_occupancy: [
                [
                  {
                    time: 31204.012,
                    position: 0,
                  },
                  {
                    time: 31227.052,
                    position: 0,
                  },
                  {
                    time: 31227.052,
                    position: 477.46298045501817,
                  },
                  {
                    time: 31485.483,
                    position: 477.46298045501817,
                  },
                  {
                    time: 31485.483,
                    position: 4107.462980455019,
                  },
                  {
                    time: 31527.545,
                    position: 4107.462980455019,
                  },
                  {
                    time: 31527.545,
                    position: 8907.462980455019,
                  },
                  {
                    time: 31527.545,
                    position: 8907.462980455019,
                  },
                  {
                    time: 31527.545,
                    position: 9349.245104289796,
                  },
                ],
              ],
              route_begin_occupancy: [
                [
                  {
                    time: 31200,
                    position: 0,
                  },
                  {
                    time: 31200,
                    position: 477.46298045501817,
                  },
                  {
                    time: 31226.343,
                    position: 477.46298045501817,
                  },
                  {
                    time: 31226.343,
                    position: 4107.462980455019,
                  },
                  {
                    time: 31335.959,
                    position: 4107.462980455019,
                  },
                  {
                    time: 31335.959,
                    position: 8907.462980455019,
                  },
                  {
                    time: 31484.507,
                    position: 8907.462980455019,
                  },
                  {
                    time: 31484.507,
                    position: 9349.245104289796,
                  },
                  {
                    time: 31527.545,
                    position: 9349.245104289796,
                  },
                ],
              ],
              route_aspects: [
                {
                  signal_id: 'SA1',
                  route_id: 'rt.DA1->DA7_2',
                  time_start: 31226.343,
                  time_end: 31336.567,
                  position_start: 477.46298045501817,
                  position_end: 4107.462980455019,
                  color: -65536,
                  blinking: false,
                },
                {
                  signal_id: 'SA1',
                  route_id: 'rt.DA1->DA7_2',
                  time_start: 31336.567,
                  time_end: 31485.483,
                  position_start: 477.46298045501817,
                  position_end: 4107.462980455019,
                  color: -256,
                  blinking: false,
                },
                {
                  signal_id: 'SA1',
                  route_id: 'rt.DA1->DA7_2',
                  time_start: 31208.59,
                  time_end: 31226.343,
                  position_start: 477.46298045501817,
                  position_end: 4107.462980455019,
                  color: -16711936,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_2r',
                  route_id: 'rt.DA7_2->DA7_5',
                  time_start: 31335.959,
                  time_end: 31485.483,
                  position_start: 4107.462980455019,
                  position_end: 8907.462980455019,
                  color: -65536,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_2r',
                  route_id: 'rt.DA7_2->DA7_5',
                  time_start: 31485.483,
                  time_end: 31527.545,
                  position_start: 4107.462980455019,
                  position_end: 8907.462980455019,
                  color: -256,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_2r',
                  route_id: 'rt.DA7_2->DA7_5',
                  time_start: 31323.959,
                  time_end: 31335.959,
                  position_start: 4107.462980455019,
                  position_end: 8907.462980455019,
                  color: -16711936,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_5r',
                  route_id: 'rt.DA7_5->DA6',
                  time_start: 31484.507,
                  time_end: 31527.545,
                  position_start: 8907.462980455019,
                  position_end: 9349.245104289796,
                  color: -65536,
                  blinking: false,
                },
                {
                  signal_id: 'SA7_5r',
                  route_id: 'rt.DA7_5->DA6',
                  time_start: 31468.518,
                  time_end: 31484.507,
                  position_start: 8907.462980455019,
                  position_end: 9349.245104289796,
                  color: -16711936,
                  blinking: false,
                },
              ],
              speeds: [
                {
                  time: 31200,
                  speed: 0,
                  position: 0,
                },
                {
                  time: 31202,
                  speed: 5.426054740359583,
                  position: 5.426054740359583,
                },
                {
                  time: 31204,
                  speed: 9.315338129894915,
                  position: 20.16744761061408,
                },
                {
                  time: 31206,
                  speed: 12.24529347637165,
                  position: 41.728079216880644,
                },
                {
                  time: 31208,
                  speed: 14.653763328200775,
                  position: 68.62713602145307,
                },
                {
                  time: 31210,
                  speed: 16.73340671345493,
                  position: 100.01430606310878,
                },
                {
                  time: 31214,
                  speed: 20.263887629643204,
                  position: 174.1822241116772,
                },
                {
                  time: 31218,
                  speed: 23.245696950370917,
                  position: 261.31197574861255,
                },
                {
                  time: 31224,
                  speed: 27.055980970687834,
                  position: 412.50871042488404,
                },
                {
                  time: 31230,
                  speed: 30.318700005818712,
                  position: 584.8335602944686,
                },
                {
                  time: 31236.313033008424,
                  speed: 33.333333333333336,
                  position: 785.9212736535599,
                },
                {
                  time: 31459.879414594176,
                  speed: 33.333333333333336,
                  position: 8238.133993178684,
                },
                {
                  time: 31468.546081260843,
                  speed: 29,
                  position: 8508.245104289796,
                },
                {
                  time: 31476.546081260843,
                  speed: 25,
                  position: 8724.245104289796,
                },
                {
                  time: 31484.546081260843,
                  speed: 21,
                  position: 8908.245104289796,
                },
                {
                  time: 31492.546081260843,
                  speed: 17,
                  position: 9060.245104289796,
                },
                {
                  time: 31500.546081260843,
                  speed: 13,
                  position: 9180.245104289796,
                },
                {
                  time: 31508.546081260843,
                  speed: 9,
                  position: 9268.245104289796,
                },
                {
                  time: 31512.546081260843,
                  speed: 7,
                  position: 9300.245104289796,
                },
                {
                  time: 31516.546081260843,
                  speed: 5,
                  position: 9324.245104289796,
                },
                {
                  time: 31520.546081260843,
                  speed: 3,
                  position: 9340.245104289796,
                },
                {
                  time: 31522.546081260843,
                  speed: 2,
                  position: 9345.245104289796,
                },
                {
                  time: 31524.546081260843,
                  speed: 1,
                  position: 9348.245104289796,
                },
                {
                  time: 31527.546081260843,
                  speed: 0,
                  position: 9349.245104289796,
                },
              ],
              stops: [
                {
                  id: null,
                  name: null,
                  time: 31200,
                  duration: 0,
                  position: 0,
                  line_code: 424242,
                  line_name: 'West_parking',
                  track_name: 'A',
                  track_number: 3,
                },
                {
                  id: null,
                  name: null,
                  time: 31527.546081260843,
                  duration: 1,
                  position: 9349.245104289796,
                  line_code: 434343,
                  line_name: 'West_to_East_road',
                  track_name: 'V2',
                  track_number: 2,
                },
              ],
            },
            margins: null,
            eco: null,
          },
        ],
      },
    ],
    present: {
      trains: [
        {
          id: 16,
          labels: [],
          path: 29,
          name: 'total',
          modes_and_profiles: [
            { start: 0, stop: 900, used_mode: '1500', used_profile: 'O' },
            { start: 900, stop: 1200, used_mode: '1500', used_profile: 'A' },
            { start: 1200, stop: 1350, used_mode: '1500', used_profile: 'O' },
            { start: 1350, stop: 3400, used_mode: '1500', used_profile: 'B1' },
            { start: 3400, stop: 3900, used_mode: '1500', used_profile: 'E' },
            { start: 3900, stop: 4800, used_mode: '25000', used_profile: 'B' },
            { start: 4800, stop: 4950, used_mode: '1500', used_profile: 'O' },
            { start: 4950, stop: 7600, used_mode: '1500' },
            { start: 7600, stop: 7850, used_mode: '25000', used_profile: '25000' },
            { start: 7850, stop: 8500, used_mode: '25000', used_profile: '20000' },
            { start: 8500, stop: 9350, used_mode: '25000', used_profile: '22500' },
          ],
          vmax: [
            {
              speed: 33.333333333333336,
              position: 0,
            },
            {
              speed: 33.333333333333336,
              position: 9349.245104289796,
            },
          ],
          slopes: [
            {
              gradient: 0,
              position: 0,
            },
            {
              gradient: 0,
              position: 4707.462980455019,
            },
            {
              gradient: -3,
              position: 4707.462980455019,
            },
            {
              gradient: -3,
              position: 5007.462980455019,
            },
            {
              gradient: -6,
              position: 5007.462980455019,
            },
            {
              gradient: -6,
              position: 5407.462980455019,
            },
            {
              gradient: -3,
              position: 5407.462980455019,
            },
            {
              gradient: -3,
              position: 5707.462980455019,
            },
            {
              gradient: 0,
              position: 5707.462980455019,
            },
            {
              gradient: 0,
              position: 7707.462980455019,
            },
            {
              gradient: 3,
              position: 7707.462980455019,
            },
            {
              gradient: 3,
              position: 8007.462980455019,
            },
            {
              gradient: 6,
              position: 8007.462980455019,
            },
            {
              gradient: 6,
              position: 8407.462980455019,
            },
            {
              gradient: 3,
              position: 8407.462980455019,
            },
            {
              gradient: 3,
              position: 8707.462980455019,
            },
            {
              gradient: 0,
              position: 8707.462980455019,
            },
            {
              gradient: 0,
              position: 9349.245104289796,
            },
          ],
          curves: [
            {
              radius: 0,
              position: 0,
            },
            {
              radius: 0,
              position: 9349.245104289796,
            },
          ],
          base: {
            head_positions: [
              [
                {
                  time: 31200,
                  position: 0,
                },
                {
                  time: 31202,
                  position: 5.426054740359632,
                },
                {
                  time: 31206,
                  position: 41.72807921688059,
                },
                {
                  time: 31210,
                  position: 100.01430606310873,
                },
                {
                  time: 31214,
                  position: 174.18222411167721,
                },
                {
                  time: 31218,
                  position: 261.31197574861244,
                },
                {
                  time: 31222,
                  position: 359.5959218875846,
                },
                {
                  time: 31226,
                  position: 467.759190267137,
                },
                {
                  time: 31232,
                  position: 646.4656234538966,
                },
                {
                  time: 31459.879414594176,
                  position: 8238.133993178684,
                },
                {
                  time: 31468.546081260843,
                  position: 8508.245104289796,
                },
                {
                  time: 31474.546081260843,
                  position: 8673.245104289796,
                },
                {
                  time: 31482.546081260843,
                  position: 8865.245104289796,
                },
                {
                  time: 31490.546081260843,
                  position: 9025.245104289796,
                },
                {
                  time: 31498.546081260843,
                  position: 9153.245104289796,
                },
                {
                  time: 31504.546081260843,
                  position: 9228.245104289796,
                },
                {
                  time: 31512.546081260843,
                  position: 9300.245104289796,
                },
                {
                  time: 31520.546081260843,
                  position: 9340.245104289796,
                },
                {
                  time: 31527.546081260843,
                  position: 9349.245104289796,
                },
              ],
            ],
            tail_positions: [
              [
                {
                  time: 31200,
                  position: 0,
                },
                {
                  time: 31202,
                  position: 0,
                },
                {
                  time: 31206,
                  position: 21.448079216880586,
                },
                {
                  time: 31210,
                  position: 79.73430606310873,
                },
                {
                  time: 31214,
                  position: 153.9022241116772,
                },
                {
                  time: 31218,
                  position: 241.03197574861244,
                },
                {
                  time: 31222,
                  position: 339.31592188758464,
                },
                {
                  time: 31226,
                  position: 447.479190267137,
                },
                {
                  time: 31232,
                  position: 626.1856234538966,
                },
                {
                  time: 31459.879414594176,
                  position: 8217.853993178684,
                },
                {
                  time: 31468.546081260843,
                  position: 8487.965104289795,
                },
                {
                  time: 31474.546081260843,
                  position: 8652.965104289795,
                },
                {
                  time: 31482.546081260843,
                  position: 8844.965104289795,
                },
                {
                  time: 31490.546081260843,
                  position: 9004.965104289795,
                },
                {
                  time: 31498.546081260843,
                  position: 9132.965104289795,
                },
                {
                  time: 31504.546081260843,
                  position: 9207.965104289795,
                },
                {
                  time: 31512.546081260843,
                  position: 9279.965104289795,
                },
                {
                  time: 31520.546081260843,
                  position: 9319.965104289795,
                },
                {
                  time: 31527.546081260843,
                  position: 9328.965104289795,
                },
              ],
            ],
            route_begin_occupancy: [
              [
                {
                  time: 31200,
                  position: 0,
                },
                {
                  time: 31200,
                  position: 477.46298045501817,
                },
                {
                  time: 31226.343,
                  position: 477.46298045501817,
                },
                {
                  time: 31226.343,
                  position: 4107.462980455019,
                },
                {
                  time: 31335.959,
                  position: 4107.462980455019,
                },
                {
                  time: 31335.959,
                  position: 8907.462980455019,
                },
                {
                  time: 31484.507,
                  position: 8907.462980455019,
                },
                {
                  time: 31484.507,
                  position: 9349.245104289796,
                },
                {
                  time: 31527.545,
                  position: 9349.245104289796,
                },
              ],
            ],
            route_end_occupancy: [
              [
                {
                  time: 31204.012,
                  position: 0,
                },
                {
                  time: 31227.052,
                  position: 0,
                },
                {
                  time: 31227.052,
                  position: 477.46298045501817,
                },
                {
                  time: 31485.483,
                  position: 477.46298045501817,
                },
                {
                  time: 31485.483,
                  position: 4107.462980455019,
                },
                {
                  time: 31527.545,
                  position: 4107.462980455019,
                },
                {
                  time: 31527.545,
                  position: 8907.462980455019,
                },
                {
                  time: 31527.545,
                  position: 8907.462980455019,
                },
                {
                  time: 31527.545,
                  position: 9349.245104289796,
                },
              ],
            ],
            speeds: [
              {
                time: 31200,
                speed: 0,
                position: 0,
              },
              {
                time: 31202,
                speed: 5.426054740359583,
                position: 5.426054740359583,
              },
              {
                time: 31204,
                speed: 9.315338129894915,
                position: 20.16744761061408,
              },
              {
                time: 31206,
                speed: 12.24529347637165,
                position: 41.728079216880644,
              },
              {
                time: 31208,
                speed: 14.653763328200775,
                position: 68.62713602145307,
              },
              {
                time: 31210,
                speed: 16.73340671345493,
                position: 100.01430606310878,
              },
              {
                time: 31214,
                speed: 20.263887629643204,
                position: 174.1822241116772,
              },
              {
                time: 31218,
                speed: 23.245696950370917,
                position: 261.31197574861255,
              },
              {
                time: 31224,
                speed: 27.055980970687834,
                position: 412.50871042488404,
              },
              {
                time: 31230,
                speed: 30.318700005818712,
                position: 584.8335602944686,
              },
              {
                time: 31236.313033008424,
                speed: 33.333333333333336,
                position: 785.9212736535599,
              },
              {
                time: 31459.879414594176,
                speed: 33.333333333333336,
                position: 8238.133993178684,
              },
              {
                time: 31468.546081260843,
                speed: 29,
                position: 8508.245104289796,
              },
              {
                time: 31476.546081260843,
                speed: 25,
                position: 8724.245104289796,
              },
              {
                time: 31484.546081260843,
                speed: 21,
                position: 8908.245104289796,
              },
              {
                time: 31492.546081260843,
                speed: 17,
                position: 9060.245104289796,
              },
              {
                time: 31500.546081260843,
                speed: 13,
                position: 9180.245104289796,
              },
              {
                time: 31508.546081260843,
                speed: 9,
                position: 9268.245104289796,
              },
              {
                time: 31512.546081260843,
                speed: 7,
                position: 9300.245104289796,
              },
              {
                time: 31516.546081260843,
                speed: 5,
                position: 9324.245104289796,
              },
              {
                time: 31520.546081260843,
                speed: 3,
                position: 9340.245104289796,
              },
              {
                time: 31522.546081260843,
                speed: 2,
                position: 9345.245104289796,
              },
              {
                time: 31524.546081260843,
                speed: 1,
                position: 9348.245104289796,
              },
              {
                time: 31527.546081260843,
                speed: 0,
                position: 9349.245104289796,
              },
            ],
            stops: [
              {
                id: null,
                name: null,
                time: 31200,
                duration: 0,
                position: 0,
                line_code: 424242,
                line_name: 'West_parking',
                track_name: 'A',
                track_number: 3,
              },
              {
                id: null,
                name: null,
                time: 31527.546081260843,
                duration: 1,
                position: 9349.245104289796,
                line_code: 434343,
                line_name: 'West_to_East_road',
                track_name: 'V2',
                track_number: 2,
              },
            ],
            route_aspects: [
              {
                signal_id: 'SA1',
                route_id: 'rt.DA1->DA7_2',
                time_start: 31226.343,
                time_end: 31336.567,
                position_start: 477.46298045501817,
                position_end: 4107.462980455019,
                color: -65536,
                blinking: false,
              },
              {
                signal_id: 'SA1',
                route_id: 'rt.DA1->DA7_2',
                time_start: 31336.567,
                time_end: 31485.483,
                position_start: 477.46298045501817,
                position_end: 4107.462980455019,
                color: -256,
                blinking: false,
              },
              {
                signal_id: 'SA1',
                route_id: 'rt.DA1->DA7_2',
                time_start: 31208.59,
                time_end: 31226.343,
                position_start: 477.46298045501817,
                position_end: 4107.462980455019,
                color: -16711936,
                blinking: false,
              },
              {
                signal_id: 'SA7_2r',
                route_id: 'rt.DA7_2->DA7_5',
                time_start: 31335.959,
                time_end: 31485.483,
                position_start: 4107.462980455019,
                position_end: 8907.462980455019,
                color: -65536,
                blinking: false,
              },
              {
                signal_id: 'SA7_2r',
                route_id: 'rt.DA7_2->DA7_5',
                time_start: 31485.483,
                time_end: 31527.545,
                position_start: 4107.462980455019,
                position_end: 8907.462980455019,
                color: -256,
                blinking: false,
              },
              {
                signal_id: 'SA7_2r',
                route_id: 'rt.DA7_2->DA7_5',
                time_start: 31323.959,
                time_end: 31335.959,
                position_start: 4107.462980455019,
                position_end: 8907.462980455019,
                color: -16711936,
                blinking: false,
              },
              {
                signal_id: 'SA7_5r',
                route_id: 'rt.DA7_5->DA6',
                time_start: 31484.507,
                time_end: 31527.545,
                position_start: 8907.462980455019,
                position_end: 9349.245104289796,
                color: -65536,
                blinking: false,
              },
              {
                signal_id: 'SA7_5r',
                route_id: 'rt.DA7_5->DA6',
                time_start: 31468.518,
                time_end: 31484.507,
                position_start: 8907.462980455019,
                position_end: 9349.245104289796,
                color: -16711936,
                blinking: false,
              },
            ],
            signal_aspects: [
              {
                signal_id: 'SA7_5r',
                time_start: 31484.507,
                time_end: 31527.545,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
              },
              {
                signal_id: 'SA7_2',
                time_start: 31226.343,
                time_end: 31336.567,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
              },
              {
                signal_id: 'SA7_3',
                time_start: 31226.343,
                time_end: 31335.959,
                color: -256,
                blinking: false,
                aspect_label: 'S A',
              },
              {
                signal_id: 'SA7_3',
                time_start: 31335.959,
                time_end: 31485.483,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
              },
              {
                signal_id: 'SA7_1',
                time_start: 31226.343,
                time_end: 31336.567,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
              },
              {
                signal_id: 'SA7_1',
                time_start: 31336.567,
                time_end: 31527.545,
                color: -256,
                blinking: false,
                aspect_label: 'S A',
              },
              {
                signal_id: 'SA7_5',
                time_start: 31335.959,
                time_end: 31485.483,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
              },
              {
                signal_id: 'SA7_2r',
                time_start: 31335.959,
                time_end: 31485.483,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
              },
              {
                signal_id: 'SA7_2r',
                time_start: 31485.483,
                time_end: 31527.545,
                color: -256,
                blinking: false,
                aspect_label: 'S A',
              },
              {
                signal_id: 'SA7_4',
                time_start: 31335.959,
                time_end: 31485.483,
                color: -65536,
                blinking: false,
                aspect_label: 'S',
              },
              {
                signal_id: 'SA1',
                time_start: 31226.343,
                time_end: 31336.567,
                color: -65536,
                blinking: false,
                aspect_label: 'CARRE',
              },
              {
                signal_id: 'SA1',
                time_start: 31336.567,
                time_end: 31485.483,
                color: -256,
                blinking: false,
                aspect_label: 'CARRE A',
              },
              {
                signal_id: 'SA7_5r',
                time_start: 31468.518,
                time_end: 31484.507,
                color: -16711936,
                blinking: false,
                aspect_label: 'S VL',
              },
              {
                signal_id: 'SA1',
                time_start: 31208.59,
                time_end: 31226.343,
                color: -16711936,
                blinking: false,
                aspect_label: 'CARRE VL',
              },
              {
                signal_id: 'SA7_2r',
                time_start: 31323.959,
                time_end: 31335.959,
                color: -16711936,
                blinking: false,
                aspect_label: 'S VL',
              },
            ],
          },
        },
      ],
    },
    future: [],
  },
  selectedTrainSimulation: {
    speed: [
      {
        time: 31200,
        speed: 0,
        position: 0,
      },
      {
        time: 31202,
        speed: 19.5337970652945,
        position: 5.426054740359583,
      },
      {
        time: 31204,
        speed: 33.5352172676217,
        position: 20.16744761061408,
      },
      {
        time: 31206,
        speed: 44.083056514937944,
        position: 41.728079216880644,
      },
      {
        time: 31208,
        speed: 52.75354798152279,
        position: 68.62713602145307,
      },
      {
        time: 31210,
        speed: 60.24026416843775,
        position: 100.01430606310878,
      },
      {
        time: 31214,
        speed: 72.94999546671554,
        position: 174.1822241116772,
      },
      {
        time: 31218,
        speed: 83.6845090213353,
        position: 261.31197574861255,
      },
      {
        time: 31224,
        speed: 97.4015314944762,
        position: 412.50871042488404,
      },
      {
        time: 31230,
        speed: 109.14732002094736,
        position: 584.8335602944686,
      },
      {
        time: 31236.313033008424,
        speed: 120.00000000000001,
        position: 785.9212736535599,
      },
      {
        time: 31459.879414594176,
        speed: 120.00000000000001,
        position: 8238.133993178684,
      },
      {
        time: 31468.546081260843,
        speed: 104.4,
        position: 8508.245104289796,
      },
      {
        time: 31476.546081260843,
        speed: 90,
        position: 8724.245104289796,
      },
      {
        time: 31484.546081260843,
        speed: 75.60000000000001,
        position: 8908.245104289796,
      },
      {
        time: 31492.546081260843,
        speed: 61.2,
        position: 9060.245104289796,
      },
      {
        time: 31500.546081260843,
        speed: 46.800000000000004,
        position: 9180.245104289796,
      },
      {
        time: 31508.546081260843,
        speed: 32.4,
        position: 9268.245104289796,
      },
      {
        time: 31512.546081260843,
        speed: 25.2,
        position: 9300.245104289796,
      },
      {
        time: 31516.546081260843,
        speed: 18,
        position: 9324.245104289796,
      },
      {
        time: 31520.546081260843,
        speed: 10.8,
        position: 9340.245104289796,
      },
      {
        time: 31522.546081260843,
        speed: 7.2,
        position: 9345.245104289796,
      },
      {
        time: 31524.546081260843,
        speed: 3.6,
        position: 9348.245104289796,
      },
      {
        time: 31527.546081260843,
        speed: 0,
        position: 9349.245104289796,
      },
    ],
    margins_speed: [],
    eco_speed: [],
    areaBlock: [
      {
        position: 0,
        value0: 0,
        value1: [0],
      },
      {
        position: 5.426054740359583,
        value0: 19.5337970652945,
        value1: [0],
      },
      {
        position: 20.16744761061408,
        value0: 33.5352172676217,
        value1: [0],
      },
      {
        position: 41.728079216880644,
        value0: 44.083056514937944,
        value1: [0],
      },
      {
        position: 68.62713602145307,
        value0: 52.75354798152279,
        value1: [0],
      },
      {
        position: 100.01430606310878,
        value0: 60.24026416843775,
        value1: [0],
      },
      {
        position: 174.1822241116772,
        value0: 72.94999546671554,
        value1: [0],
      },
      {
        position: 261.31197574861255,
        value0: 83.6845090213353,
        value1: [0],
      },
      {
        position: 412.50871042488404,
        value0: 97.4015314944762,
        value1: [0],
      },
      {
        position: 584.8335602944686,
        value0: 109.14732002094736,
        value1: [0],
      },
      {
        position: 785.9212736535599,
        value0: 120.00000000000001,
        value1: [0],
      },
      {
        position: 8238.133993178684,
        value0: 120.00000000000001,
        value1: [0],
      },
      {
        position: 8508.245104289796,
        value0: 104.4,
        value1: [0],
      },
      {
        position: 8724.245104289796,
        value0: 90,
        value1: [0],
      },
      {
        position: 8908.245104289796,
        value0: 75.60000000000001,
        value1: [0],
      },
      {
        position: 9060.245104289796,
        value0: 61.2,
        value1: [0],
      },
      {
        position: 9180.245104289796,
        value0: 46.800000000000004,
        value1: [0],
      },
      {
        position: 9268.245104289796,
        value0: 32.4,
        value1: [0],
      },
      {
        position: 9300.245104289796,
        value0: 25.2,
        value1: [0],
      },
      {
        position: 9324.245104289796,
        value0: 18,
        value1: [0],
      },
      {
        position: 9340.245104289796,
        value0: 10.8,
        value1: [0],
      },
      {
        position: 9345.245104289796,
        value0: 7.2,
        value1: [0],
      },
      {
        position: 9348.245104289796,
        value0: 3.6,
        value1: [0],
      },
      {
        position: 9349.245104289796,
        value0: 0,
        value1: [0],
      },
    ],
    vmax: [
      {
        speed: 120.00000000000001,
        position: 0,
      },
      {
        speed: 120.00000000000001,
        position: 9349.245104289796,
      },
    ],
    slopesCurve: [
      {
        height: 0,
        position: 0,
      },
      {
        height: 0,
        position: 4707.462980455019,
      },
      {
        height: -25.714285714285715,
        position: 5007.462980455019,
      },
      {
        height: -94.28571428571428,
        position: 5407.462980455019,
      },
      {
        height: -120.00000000000001,
        position: 5707.462980455019,
      },
      {
        height: -120.00000000000001,
        position: 7707.462980455019,
      },
      {
        height: -94.28571428571429,
        position: 8007.462980455019,
      },
      {
        height: -25.714285714285726,
        position: 8407.462980455019,
      },
      {
        height: -9.516197353929914e-15,
        position: 8707.462980455019,
      },
    ],
    slopesHistogram: [
      {
        position: 0,
        gradient: 0,
      },
      {
        position: 4707.462980455019,
        gradient: 0,
      },
      {
        position: 4707.462980455019,
        gradient: -12,
      },
      {
        position: 5007.462980455019,
        gradient: -12,
      },
      {
        position: 5007.462980455019,
        gradient: -24,
      },
      {
        position: 5407.462980455019,
        gradient: -24,
      },
      {
        position: 5407.462980455019,
        gradient: -12,
      },
      {
        position: 5707.462980455019,
        gradient: -12,
      },
      {
        position: 5707.462980455019,
        gradient: 0,
      },
      {
        position: 7707.462980455019,
        gradient: 0,
      },
      {
        position: 7707.462980455019,
        gradient: 12,
      },
      {
        position: 8007.462980455019,
        gradient: 12,
      },
      {
        position: 8007.462980455019,
        gradient: 24,
      },
      {
        position: 8407.462980455019,
        gradient: 24,
      },
      {
        position: 8407.462980455019,
        gradient: 12,
      },
      {
        position: 8707.462980455019,
        gradient: 12,
      },
      {
        position: 8707.462980455019,
        gradient: 0,
      },
      {
        position: 9349.245104289796,
        gradient: 0,
      },
    ],
    areaSlopesHistogram: [
      {
        position: 0,
        value0: 0,
        value1: [0],
      },
      {
        position: 4707.462980455019,
        value0: 0,
        value1: [0],
      },
      {
        position: 4707.462980455019,
        value0: -12,
        value1: [0],
      },
      {
        position: 5007.462980455019,
        value0: -12,
        value1: [0],
      },
      {
        position: 5007.462980455019,
        value0: -24,
        value1: [0],
      },
      {
        position: 5407.462980455019,
        value0: -24,
        value1: [0],
      },
      {
        position: 5407.462980455019,
        value0: -12,
        value1: [0],
      },
      {
        position: 5707.462980455019,
        value0: -12,
        value1: [0],
      },
      {
        position: 5707.462980455019,
        value0: 0,
        value1: [0],
      },
      {
        position: 7707.462980455019,
        value0: 0,
        value1: [0],
      },
      {
        position: 7707.462980455019,
        value0: 12,
        value1: [0],
      },
      {
        position: 8007.462980455019,
        value0: 12,
        value1: [0],
      },
      {
        position: 8007.462980455019,
        value0: 24,
        value1: [0],
      },
      {
        position: 8407.462980455019,
        value0: 24,
        value1: [0],
      },
      {
        position: 8407.462980455019,
        value0: 12,
        value1: [0],
      },
      {
        position: 8707.462980455019,
        value0: 12,
        value1: [0],
      },
      {
        position: 8707.462980455019,
        value0: 0,
        value1: [0],
      },
      {
        position: 9349.245104289796,
        value0: 0,
        value1: [0],
      },
    ],
    curvesHistogram: [
      {
        radius: 0,
        position: 0,
      },
      {
        radius: 0,
        position: 9349.245104289796,
      },
    ],
    modesAndProfiles: [
      {
        start: 0,
        stop: 900,
        used_mode: '1500',
        used_profile: 'O',
      },
      {
        start: 900,
        stop: 1200,
        used_mode: '1500',
        used_profile: 'A',
      },
      {
        start: 1200,
        stop: 1350,
        used_mode: '1500',
        used_profile: 'O',
      },
      {
        start: 1350,
        stop: 3400,
        used_mode: '1500',
        used_profile: 'B1',
      },
      {
        start: 3400,
        stop: 3900,
        used_mode: '1500',
        used_profile: 'E',
      },
      {
        start: 3900,
        stop: 4800,
        used_mode: '25000',
        used_profile: 'B',
      },
      {
        start: 4800,
        stop: 4950,
        used_mode: '1500',
        used_profile: 'O',
      },
      {
        start: 4950,
        stop: 7600,
        used_mode: '1500',
      },
      {
        start: 7600,
        stop: 7850,
        used_mode: '25000',
        used_profile: '25000',
      },
      {
        start: 7850,
        stop: 8500,
        used_mode: '25000',
        used_profile: '20000',
      },
      {
        start: 8500,
        stop: 9350,
        used_mode: '25000',
        used_profile: '22500',
      },
    ],
  },
};

export default ORSD_GRAPH_SAMPLE_DATA;
