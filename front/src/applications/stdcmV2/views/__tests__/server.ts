import { setupServer } from 'msw/node';

import handlers from './apiHandlers';

const server = setupServer(...handlers);

export default server;
