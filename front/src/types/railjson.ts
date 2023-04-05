//
// Railjson
//
import { OperationObject } from '../common/api/osrdEditoastApi';

// For the response of the patch
// export type EntityDeleteOperationResult = DeleteOperation;
export type EntityObjectOperationResult = OperationObject & { railjson: object & { id: string } };
// export type EntityOperationResult = EntityDeleteOperationResult | EntityObjectOperationResult;
