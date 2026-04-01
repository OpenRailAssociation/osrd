import type {
  PostTimetableByIdStdcmApiArg,
  PostTimetableByIdStdcmApiResponseWithTraceId,
  StdcmResponse,
} from 'common/api/osrdEditoastApi';

export default function postTimetableByIdStdcm(args: PostTimetableByIdStdcmApiArg) {
  const controller = new AbortController();
  const { signal } = controller;

  const subscribe = async (
    callback: (
      arg: PostTimetableByIdStdcmApiResponseWithTraceId | { event: 'error'; error: Error }
    ) => void
  ) => {
    try {
      const response = await fetch(
        `/api/timetable/${args.id}/stdcm?infra=${args.infra}${args.returnDebugPayloads === true ? '&return_debug_payloads' : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args.body),
          signal: signal,
        }
      );
      if (!response.ok) {
        throw new Error(
          `Bad response from stdcm stream endpoint: ${response.status} ${response.statusText}`
        );
      }
      const traceparent = response.headers.get('traceparent');
      const traceId = traceparent?.split('-')[1];

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer: string = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            callback({ ...data, traceId });
          } catch (e) {
            console.error(e);
            throw new Error(`Error while JSON parse ${line}`);
          }
        }
      }
    } catch (e) {
      callback({ event: 'error', error: e as Error });
      controller.abort();
    }
  };

  const unsubscribe = () => {
    controller.abort();
  };

  const runAndAwaitResult = () =>
    new Promise<StdcmResponse>((resolve, reject) => {
      subscribe((event) => {
        if (event.event === 'error') reject(event.error);
        else {
          if (event.event === 'completed') resolve(event.data);
        }
      });
    });

  return {
    subscribe,
    unsubscribe,
    runAndAwaitResult,
  };
}
