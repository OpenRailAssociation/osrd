/* eslint-disable import/prefer-default-export */
import type { Infra, WorkerStatus } from 'common/api/osrdEditoastApi';

export type InfraWithStatus = Infra & { status: WorkerStatus };
