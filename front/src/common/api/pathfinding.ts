import { get, post } from 'common/requests';

import { PathQuery } from './osrdApi';

const pathfindingURI = '/pathfinding/';

class Pathfinding {
  static create(params: PathQuery) {
    return post(pathfindingURI, params);
  }
}

export default Pathfinding;
