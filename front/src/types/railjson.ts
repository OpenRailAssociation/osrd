//
// Railjson
//
import { OperationObject } from '../common/api/osrdEditoastApi';

// For the response of the patch
// export type EntityDeleteCacheOperation = DeleteOperation;
export type EntityObjectCacheOperation = OperationObject & { railjson: object & { id: string } };
// export type EntityCacheOperation = EntityDeleteCacheOperation | EntityObjectCacheOperation;
