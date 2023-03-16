//
// Railjson
//
import {
  DeleteOperation,
  UpdateOperation,
  RailjsonObject,
  OperationObject,
} from '../common/api/osrdEditoastApi';

// For the patch
export type {
  DeleteOperation as DeleteEntityOperation,
  UpdateOperation as UpdateEntityOperation,
  RailjsonObject as CreateEntityOperation,
};
export type EntityOperation = DeleteOperation | UpdateOperation | RailjsonObject;

// For the response of the patch
export type EntityDeleteOperationResult = DeleteOperation;
export type EntityObjectOperationResult = OperationObject & { railjson: object & { id: string } };
export type EntityOperationResult = EntityDeleteOperationResult | EntityObjectOperationResult;
