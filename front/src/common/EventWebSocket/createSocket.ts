/**
 * The part of a WebSocket needed to listen to events, so that tests can provide a mock instead of
 * a real socket.
 */
export type EventWebSocket = Pick<WebSocket, 'onmessage' | 'onerror' | 'onclose' | 'close'>;

export const createSocket = (url: string): EventWebSocket => new WebSocket(url);
