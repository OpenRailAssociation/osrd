import type { Middleware } from 'redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import { osrdRailwayManagerApi } from 'common/api/osrdRailwayManagerApi';

export const middlewares: Middleware[] = [
  osrdEditoastApi.middleware,
  osrdGatewayApi.middleware,
  osrdRailwayManagerApi.middleware,
];
