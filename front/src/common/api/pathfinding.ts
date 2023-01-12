import { get, post } from 'common/requests';

import { PathQuery, Path } from './osrdApi';

const pathfindingURI = '/pathfinding/';

class Pathfinding {
  static create(params: PathQuery): Promise<Path> {
    return post(pathfindingURI, params);
  }
}

export default Pathfinding;
