import type { GetInfraByInfraIdErrorsApiArg } from 'common/api/osrdEditoastApi';

// Error level
export type InfraErrorLevel = GetInfraByInfraIdErrorsApiArg['level'];
// Error labels
export type InfraErrorTypeLabel = NonNullable<GetInfraByInfraIdErrorsApiArg['errorType']>;
