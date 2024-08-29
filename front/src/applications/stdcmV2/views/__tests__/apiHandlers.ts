import { http, HttpResponse } from 'msw';

const handlers = [
  http.post(`api/v2/timetable/${1}`, () => {
    const resp = {
      status: 'success',
      simulation: {
        status: 'success',
      },
    };
    return HttpResponse.json(resp);
  }),
];
export default handlers;
