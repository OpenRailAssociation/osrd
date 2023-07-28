import { baseEditoastApi as api } from './emptyApi';

export const addTagTypes = [
  'documents',
  'electrical_profiles',
  'infra',
  'pathfinding',
  'routes',
  'layers',
  'rolling_stock',
  'projects',
  'studies',
  'scenarios',
  'rolling_stock_livery',
  'timetable',
  'train_schedule',
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      postDocuments: build.mutation<PostDocumentsApiResponse, PostDocumentsApiArg>({
        query: () => ({ url: `/documents/`, method: 'POST' }),
        invalidatesTags: ['documents'],
      }),
      deleteDocumentsByKey: build.mutation<
        DeleteDocumentsByKeyApiResponse,
        DeleteDocumentsByKeyApiArg
      >({
        query: (queryArg) => ({ url: `/documents/${queryArg.key}/`, method: 'DELETE' }),
        invalidatesTags: ['documents'],
      }),
      getDocumentsByKey: build.query<GetDocumentsByKeyApiResponse, GetDocumentsByKeyApiArg>({
        query: (queryArg) => ({ url: `/documents/${queryArg.key}/` }),
        providesTags: ['documents'],
      }),
      getElectricalProfileSet: build.query<
        GetElectricalProfileSetApiResponse,
        GetElectricalProfileSetApiArg
      >({
        query: () => ({ url: `/electrical_profile_set/` }),
        providesTags: ['electrical_profiles'],
      }),
      postElectricalProfileSet: build.mutation<
        PostElectricalProfileSetApiResponse,
        PostElectricalProfileSetApiArg
      >({
        query: (queryArg) => ({
          url: `/electrical_profile_set/`,
          method: 'POST',
          params: { name: queryArg.name },
        }),
        invalidatesTags: ['electrical_profiles'],
      }),
      getElectricalProfileSetById: build.query<
        GetElectricalProfileSetByIdApiResponse,
        GetElectricalProfileSetByIdApiArg
      >({
        query: (queryArg) => ({ url: `/electrical_profile_set/${queryArg.id}/` }),
        providesTags: ['electrical_profiles'],
      }),
      getElectricalProfileSetByIdLevelOrder: build.query<
        GetElectricalProfileSetByIdLevelOrderApiResponse,
        GetElectricalProfileSetByIdLevelOrderApiArg
      >({
        query: (queryArg) => ({ url: `/electrical_profile_set/${queryArg.id}/level_order/` }),
        providesTags: ['electrical_profiles'],
      }),
      getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
        query: () => ({ url: `/health/` }),
      }),
      getInfra: build.query<GetInfraApiResponse, GetInfraApiArg>({
        query: (queryArg) => ({
          url: `/infra/`,
          params: { page: queryArg.page, page_size: queryArg.pageSize },
        }),
        providesTags: ['infra'],
      }),
      postInfra: build.mutation<PostInfraApiResponse, PostInfraApiArg>({
        query: (queryArg) => ({ url: `/infra/`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['infra'],
      }),
      postInfraRailjson: build.mutation<PostInfraRailjsonApiResponse, PostInfraRailjsonApiArg>({
        query: (queryArg) => ({
          url: `/infra/railjson/`,
          method: 'POST',
          body: queryArg.railjsonFile,
          params: { name: queryArg.name, generate_data: queryArg.generateData },
        }),
        invalidatesTags: ['infra'],
      }),
      postInfraRefresh: build.mutation<PostInfraRefreshApiResponse, PostInfraRefreshApiArg>({
        query: (queryArg) => ({
          url: `/infra/refresh/`,
          method: 'POST',
          params: { infras: queryArg.infras, force: queryArg.force },
        }),
        invalidatesTags: ['infra'],
      }),
      deleteInfraById: build.mutation<DeleteInfraByIdApiResponse, DeleteInfraByIdApiArg>({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/`, method: 'DELETE' }),
        invalidatesTags: ['infra'],
      }),
      getInfraById: build.query<GetInfraByIdApiResponse, GetInfraByIdApiArg>({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/` }),
        providesTags: ['infra'],
      }),
      postInfraById: build.mutation<PostInfraByIdApiResponse, PostInfraByIdApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.id}/`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra'],
      }),
      putInfraById: build.mutation<PutInfraByIdApiResponse, PutInfraByIdApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.id}/`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra'],
      }),
      getInfraByIdAttachedAndTrackId: build.query<
        GetInfraByIdAttachedAndTrackIdApiResponse,
        GetInfraByIdAttachedAndTrackIdApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/attached/${queryArg.trackId}/` }),
        providesTags: ['infra'],
      }),
      postInfraByIdClone: build.mutation<PostInfraByIdCloneApiResponse, PostInfraByIdCloneApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.id}/clone/`,
          method: 'POST',
          params: { name: queryArg.name },
        }),
        invalidatesTags: ['infra'],
      }),
      getInfraByIdErrors: build.query<GetInfraByIdErrorsApiResponse, GetInfraByIdErrorsApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.id}/errors/`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
            error_type: queryArg.errorType,
            object_id: queryArg.objectId,
            level: queryArg.level,
          },
        }),
        providesTags: ['infra'],
      }),
      getInfraByIdLinesAndLineCodeBbox: build.query<
        GetInfraByIdLinesAndLineCodeBboxApiResponse,
        GetInfraByIdLinesAndLineCodeBboxApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/lines/${queryArg.lineCode}/bbox/` }),
        providesTags: ['infra'],
      }),
      postInfraByIdLoad: build.mutation<PostInfraByIdLoadApiResponse, PostInfraByIdLoadApiArg>({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/load/`, method: 'POST' }),
        invalidatesTags: ['infra'],
      }),
      postInfraByIdLock: build.mutation<PostInfraByIdLockApiResponse, PostInfraByIdLockApiArg>({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/lock/`, method: 'POST' }),
        invalidatesTags: ['infra'],
      }),
      postInfraByIdObjectsAndObjectType: build.mutation<
        PostInfraByIdObjectsAndObjectTypeApiResponse,
        PostInfraByIdObjectsAndObjectTypeApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.id}/objects/${queryArg.objectType}/`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra'],
      }),
      postInfraByIdPathfinding: build.mutation<
        PostInfraByIdPathfindingApiResponse,
        PostInfraByIdPathfindingApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.id}/pathfinding/`,
          method: 'POST',
          body: queryArg.body,
          params: { number: queryArg.number },
        }),
        invalidatesTags: ['infra', 'pathfinding'],
      }),
      getInfraByIdRailjson: build.query<
        GetInfraByIdRailjsonApiResponse,
        GetInfraByIdRailjsonApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/railjson/` }),
        providesTags: ['infra'],
      }),
      getInfraByIdRoutesTrackRanges: build.query<
        GetInfraByIdRoutesTrackRangesApiResponse,
        GetInfraByIdRoutesTrackRangesApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.id}/routes/track_ranges/`,
          params: { routes: queryArg.routes },
        }),
        providesTags: ['infra', 'routes'],
      }),
      getInfraByIdRoutesAndWaypointTypeWaypointId: build.query<
        GetInfraByIdRoutesAndWaypointTypeWaypointIdApiResponse,
        GetInfraByIdRoutesAndWaypointTypeWaypointIdApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.id}/routes/${queryArg.waypointType}/${queryArg.waypointId}/`,
        }),
        providesTags: ['infra', 'routes'],
      }),
      getInfraByIdSpeedLimitTags: build.query<
        GetInfraByIdSpeedLimitTagsApiResponse,
        GetInfraByIdSpeedLimitTagsApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/speed_limit_tags/` }),
        providesTags: ['infra'],
      }),
      getInfraByIdSwitchTypes: build.query<
        GetInfraByIdSwitchTypesApiResponse,
        GetInfraByIdSwitchTypesApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/switch_types/` }),
        providesTags: ['infra'],
      }),
      postInfraByIdUnlock: build.mutation<
        PostInfraByIdUnlockApiResponse,
        PostInfraByIdUnlockApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/unlock/`, method: 'POST' }),
        invalidatesTags: ['infra'],
      }),
      getInfraByIdVoltages: build.query<
        GetInfraByIdVoltagesApiResponse,
        GetInfraByIdVoltagesApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.id}/voltages/`,
          params: { include_rolling_stock_modes: queryArg.includeRollingStockModes },
        }),
        providesTags: ['infra'],
      }),
      getLayersLayerByLayerSlugMvtAndViewSlug: build.query<
        GetLayersLayerByLayerSlugMvtAndViewSlugApiResponse,
        GetLayersLayerByLayerSlugMvtAndViewSlugApiArg
      >({
        query: (queryArg) => ({
          url: `/layers/layer/${queryArg.layerSlug}/mvt/${queryArg.viewSlug}/`,
          params: { infra: queryArg.infra },
        }),
        providesTags: ['layers'],
      }),
      getLayersTileByLayerSlugAndViewSlugZXY: build.query<
        GetLayersTileByLayerSlugAndViewSlugZXYApiResponse,
        GetLayersTileByLayerSlugAndViewSlugZXYApiArg
      >({
        query: (queryArg) => ({
          url: `/layers/tile/${queryArg.layerSlug}/${queryArg.viewSlug}/${queryArg.z}/${queryArg.x}/${queryArg.y}/`,
          params: { infra: queryArg.infra },
        }),
        providesTags: ['layers'],
      }),
      getLightRollingStock: build.query<
        GetLightRollingStockApiResponse,
        GetLightRollingStockApiArg
      >({
        query: (queryArg) => ({
          url: `/light_rolling_stock/`,
          params: { page: queryArg.page, page_size: queryArg.pageSize },
        }),
        providesTags: ['rolling_stock'],
      }),
      getLightRollingStockById: build.query<
        GetLightRollingStockByIdApiResponse,
        GetLightRollingStockByIdApiArg
      >({
        query: (queryArg) => ({ url: `/light_rolling_stock/${queryArg.id}/` }),
        providesTags: ['rolling_stock'],
      }),
      postPathfinding: build.mutation<PostPathfindingApiResponse, PostPathfindingApiArg>({
        query: (queryArg) => ({ url: `/pathfinding/`, method: 'POST', body: queryArg.pathQuery }),
      }),
      deletePathfindingById: build.mutation<
        DeletePathfindingByIdApiResponse,
        DeletePathfindingByIdApiArg
      >({
        query: (queryArg) => ({ url: `/pathfinding/${queryArg.id}/`, method: 'DELETE' }),
        invalidatesTags: ['pathfinding'],
      }),
      getPathfindingById: build.query<GetPathfindingByIdApiResponse, GetPathfindingByIdApiArg>({
        query: (queryArg) => ({ url: `/pathfinding/${queryArg.id}/` }),
        providesTags: ['pathfinding'],
      }),
      putPathfindingById: build.mutation<PutPathfindingByIdApiResponse, PutPathfindingByIdApiArg>({
        query: (queryArg) => ({
          url: `/pathfinding/${queryArg.id}/`,
          method: 'PUT',
          body: queryArg.pathQuery,
        }),
        invalidatesTags: ['pathfinding'],
      }),
      getPathfindingByPathIdCatenaries: build.query<
        GetPathfindingByPathIdCatenariesApiResponse,
        GetPathfindingByPathIdCatenariesApiArg
      >({
        query: (queryArg) => ({ url: `/pathfinding/${queryArg.pathId}/catenaries/` }),
        providesTags: ['infra'],
      }),
      getProjects: build.query<GetProjectsApiResponse, GetProjectsApiArg>({
        query: (queryArg) => ({
          url: `/projects/`,
          params: {
            ordering: queryArg.ordering,
            name: queryArg.name,
            description: queryArg.description,
            tags: queryArg.tags,
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['projects'],
      }),
      postProjects: build.mutation<PostProjectsApiResponse, PostProjectsApiArg>({
        query: (queryArg) => ({
          url: `/projects/`,
          method: 'POST',
          body: queryArg.projectCreateRequest,
        }),
        invalidatesTags: ['projects'],
      }),
      deleteProjectsByProjectId: build.mutation<
        DeleteProjectsByProjectIdApiResponse,
        DeleteProjectsByProjectIdApiArg
      >({
        query: (queryArg) => ({ url: `/projects/${queryArg.projectId}/`, method: 'DELETE' }),
        invalidatesTags: ['projects'],
      }),
      getProjectsByProjectId: build.query<
        GetProjectsByProjectIdApiResponse,
        GetProjectsByProjectIdApiArg
      >({
        query: (queryArg) => ({ url: `/projects/${queryArg.projectId}/` }),
        providesTags: ['projects'],
      }),
      patchProjectsByProjectId: build.mutation<
        PatchProjectsByProjectIdApiResponse,
        PatchProjectsByProjectIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/`,
          method: 'PATCH',
          body: queryArg.projectPatchRequest,
        }),
        invalidatesTags: ['projects'],
      }),
      getProjectsByProjectIdStudies: build.query<
        GetProjectsByProjectIdStudiesApiResponse,
        GetProjectsByProjectIdStudiesApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/`,
          params: {
            ordering: queryArg.ordering,
            name: queryArg.name,
            description: queryArg.description,
            tags: queryArg.tags,
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['studies'],
      }),
      postProjectsByProjectIdStudies: build.mutation<
        PostProjectsByProjectIdStudiesApiResponse,
        PostProjectsByProjectIdStudiesApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/`,
          method: 'POST',
          body: queryArg.studyUpsertRequest,
        }),
        invalidatesTags: ['studies'],
      }),
      deleteProjectsByProjectIdStudiesAndStudyId: build.mutation<
        DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse,
        DeleteProjectsByProjectIdStudiesAndStudyIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/`,
          method: 'DELETE',
        }),
        invalidatesTags: ['studies'],
      }),
      getProjectsByProjectIdStudiesAndStudyId: build.query<
        GetProjectsByProjectIdStudiesAndStudyIdApiResponse,
        GetProjectsByProjectIdStudiesAndStudyIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/`,
        }),
        providesTags: ['studies'],
      }),
      patchProjectsByProjectIdStudiesAndStudyId: build.mutation<
        PatchProjectsByProjectIdStudiesAndStudyIdApiResponse,
        PatchProjectsByProjectIdStudiesAndStudyIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/`,
          method: 'PATCH',
          body: queryArg.studyUpsertRequest,
        }),
        invalidatesTags: ['studies'],
      }),
      getProjectsByProjectIdStudiesAndStudyIdScenarios: build.query<
        GetProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse,
        GetProjectsByProjectIdStudiesAndStudyIdScenariosApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/`,
          params: {
            ordering: queryArg.ordering,
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['scenarios'],
      }),
      postProjectsByProjectIdStudiesAndStudyIdScenarios: build.mutation<
        PostProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse,
        PostProjectsByProjectIdStudiesAndStudyIdScenariosApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/`,
          method: 'POST',
          body: queryArg.scenarioRequest,
        }),
        invalidatesTags: ['scenarios'],
      }),
      deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.mutation<
        DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
          method: 'DELETE',
        }),
        invalidatesTags: ['scenarios'],
      }),
      getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.query<
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
        }),
        providesTags: ['scenarios'],
      }),
      patchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.mutation<
        PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
          method: 'PATCH',
          body: queryArg.scenarioPatchRequest,
        }),
        invalidatesTags: ['scenarios'],
      }),
      postRollingStock: build.mutation<PostRollingStockApiResponse, PostRollingStockApiArg>({
        query: (queryArg) => ({
          url: `/rolling_stock/`,
          method: 'POST',
          body: queryArg.rollingStockUpsertPayload,
          params: { locked: queryArg.locked },
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      deleteRollingStockById: build.mutation<
        DeleteRollingStockByIdApiResponse,
        DeleteRollingStockByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.id}/`,
          method: 'DELETE',
          params: { force: queryArg.force },
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      getRollingStockById: build.query<GetRollingStockByIdApiResponse, GetRollingStockByIdApiArg>({
        query: (queryArg) => ({ url: `/rolling_stock/${queryArg.id}/` }),
        providesTags: ['rolling_stock'],
      }),
      patchRollingStockById: build.mutation<
        PatchRollingStockByIdApiResponse,
        PatchRollingStockByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.id}/`,
          method: 'PATCH',
          body: queryArg.rollingStockUpsertPayload,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      postRollingStockByIdLivery: build.mutation<
        PostRollingStockByIdLiveryApiResponse,
        PostRollingStockByIdLiveryApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.id}/livery/`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['rolling_stock', 'rolling_stock_livery'],
      }),
      patchRollingStockByIdLocked: build.mutation<
        PatchRollingStockByIdLockedApiResponse,
        PatchRollingStockByIdLockedApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.id}/locked/`,
          method: 'PATCH',
          body: queryArg.body,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      postSearch: build.mutation<PostSearchApiResponse, PostSearchApiArg>({
        query: (queryArg) => ({
          url: `/search/`,
          method: 'POST',
          body: queryArg.body,
          params: { page_size: queryArg.pageSize },
        }),
      }),
      getTimetableById: build.query<GetTimetableByIdApiResponse, GetTimetableByIdApiArg>({
        query: (queryArg) => ({ url: `/timetable/${queryArg.id}/` }),
        providesTags: ['timetable'],
      }),
      getTimetableByIdConflicts: build.query<
        GetTimetableByIdConflictsApiResponse,
        GetTimetableByIdConflictsApiArg
      >({
        query: (queryArg) => ({ url: `/timetable/${queryArg.id}/conflicts/` }),
        providesTags: ['timetable'],
      }),
      deleteTrainScheduleDelete: build.mutation<
        DeleteTrainScheduleDeleteApiResponse,
        DeleteTrainScheduleDeleteApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/delete/`,
          method: 'DELETE',
          body: queryArg.body,
        }),
        invalidatesTags: ['train_schedule'],
      }),
      getTrainScheduleResults: build.query<
        GetTrainScheduleResultsApiResponse,
        GetTrainScheduleResultsApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/results/`,
          params: { path_id: queryArg.pathId, train_ids: queryArg.trainIds },
        }),
        providesTags: ['train_schedule'],
      }),
      postTrainScheduleStandaloneSimulation: build.mutation<
        PostTrainScheduleStandaloneSimulationApiResponse,
        PostTrainScheduleStandaloneSimulationApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/standalone_simulation/`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['train_schedule'],
      }),
      deleteTrainScheduleById: build.mutation<
        DeleteTrainScheduleByIdApiResponse,
        DeleteTrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({ url: `/train_schedule/${queryArg.id}/`, method: 'DELETE' }),
        invalidatesTags: ['train_schedule'],
      }),
      getTrainScheduleById: build.query<
        GetTrainScheduleByIdApiResponse,
        GetTrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({ url: `/train_schedule/${queryArg.id}/` }),
        providesTags: ['train_schedule'],
      }),
      patchTrainScheduleById: build.mutation<
        PatchTrainScheduleByIdApiResponse,
        PatchTrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/${queryArg.id}/`,
          method: 'PATCH',
          body: queryArg.body,
        }),
        invalidatesTags: ['train_schedule'],
      }),
      getTrainScheduleByIdResult: build.query<
        GetTrainScheduleByIdResultApiResponse,
        GetTrainScheduleByIdResultApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/${queryArg.id}/result/`,
          params: { path_id: queryArg.pathId },
        }),
        providesTags: ['train_schedule'],
      }),
      getVersion: build.query<GetVersionApiResponse, GetVersionApiArg>({
        query: () => ({ url: `/version/` }),
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as osrdEditoastApi };
export type PostDocumentsApiResponse = /** status 201 The key of the added document */ {
  document_key?: number;
};
export type PostDocumentsApiArg = void;
export type DeleteDocumentsByKeyApiResponse = unknown;
export type DeleteDocumentsByKeyApiArg = {
  /** A key identifying the document */
  key: number;
};
export type GetDocumentsByKeyApiResponse = unknown;
export type GetDocumentsByKeyApiArg = {
  /** A key identifying the document */
  key: number;
};
export type GetElectricalProfileSetApiResponse =
  /** status 200 The list of ids and names of electrical profile sets available */ {
    id: number;
    name: string;
  }[];
export type GetElectricalProfileSetApiArg = void;
export type PostElectricalProfileSetApiResponse =
  /** status 200 The list of ids and names of electrical profile sets available */ ElectricalProfile;
export type PostElectricalProfileSetApiArg = {
  name: string;
};
export type GetElectricalProfileSetByIdApiResponse =
  /** status 200 The list of electrical profiles in the set */ ElectricalProfile[];
export type GetElectricalProfileSetByIdApiArg = {
  /** Electrical profile set ID */
  id: number;
};
export type GetElectricalProfileSetByIdLevelOrderApiResponse =
  /** status 200 A dictionary mapping catenary modes to a list of electrical profiles ordered by decreasing strength */ {
    [key: string]: string[];
  };
export type GetElectricalProfileSetByIdLevelOrderApiArg = {
  /** Electrical profile set ID */
  id: number;
};
export type GetHealthApiResponse = unknown;
export type GetHealthApiArg = void;
export type GetInfraApiResponse = /** status 200 The infras list */ {
  count: number;
  next: any;
  previous: any;
  results?: Infra[];
};
export type GetInfraApiArg = {
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type PostInfraApiResponse = /** status 201 The created infra */ Infra;
export type PostInfraApiArg = {
  /** Name of the infra to create */
  body: {
    name?: string;
  };
};
export type PostInfraRailjsonApiResponse = /** status 201 The imported infra id */ {
  id?: string;
};
export type PostInfraRailjsonApiArg = {
  /** Infra name */
  name: string;
  generateData?: boolean;
  /** Railjson infra */
  railjsonFile: RailjsonFile;
};
export type PostInfraRefreshApiResponse =
  /** status 200 A list thats contains the ID of the infras that were refreshed* */ number[];
export type PostInfraRefreshApiArg = {
  /** A list of infra ID */
  infras?: number[];
  /** Force the refresh of the layers */
  force?: boolean;
};
export type DeleteInfraByIdApiResponse = unknown;
export type DeleteInfraByIdApiArg = {
  /** infra id */
  id: number;
};
export type GetInfraByIdApiResponse = /** status 200 Information about the retrieved infra */ Infra;
export type GetInfraByIdApiArg = {
  /** infra id */
  id: number;
};
export type PostInfraByIdApiResponse =
  /** status 200 An array containing infos about the operations processed */ OperationResult[];
export type PostInfraByIdApiArg = {
  /** infra id */
  id: number;
  /** Operations to do on the infra */
  body: Operation[];
};
export type PutInfraByIdApiResponse = /** status 200 The updated infra */ Infra;
export type PutInfraByIdApiArg = {
  /** infra id */
  id: number;
  /** the name we want to give to the infra */
  body: {
    name?: string;
  };
};
export type GetInfraByIdAttachedAndTrackIdApiResponse =
  /** status 200 All objects attached to the given track (arranged by types) */ {
    [key: string]: string[];
  };
export type GetInfraByIdAttachedAndTrackIdApiArg = {
  /** Infra ID */
  id: number;
  /** Track ID */
  trackId: string;
};
export type PostInfraByIdCloneApiResponse = /** status 201 The duplicated infra id */ {
  id?: number;
};
export type PostInfraByIdCloneApiArg = {
  /** Infra id */
  id: number;
  /** New infra name */
  name: string;
};
export type GetInfraByIdErrorsApiResponse = /** status 200 A paginated list of errors */ {
  count?: number;
  next?: number | null;
  previous?: number | null;
  results?: InfraError[];
};
export type GetInfraByIdErrorsApiArg = {
  /** infra id */
  id: number;
  /** The page number */
  page?: number;
  /** The number of item per page */
  pageSize?: number;
  /** The type of error to filter on */
  errorType?: InfraErrorType;
  /** errors and warnings that only part of a given object */
  objectId?: string;
  /** Whether the response should include errors or warnings */
  level?: 'errors' | 'warnings' | 'all';
};
export type GetInfraByIdLinesAndLineCodeBboxApiResponse =
  /** status 200 The BBox of the line */ Zone;
export type GetInfraByIdLinesAndLineCodeBboxApiArg = {
  /** infra id */
  id: number;
  /** a line code */
  lineCode: number;
};
export type PostInfraByIdLoadApiResponse = unknown;
export type PostInfraByIdLoadApiArg = {
  /** infra id */
  id: number;
};
export type PostInfraByIdLockApiResponse = unknown;
export type PostInfraByIdLockApiArg = {
  /** infra id */
  id: number;
};
export type PostInfraByIdObjectsAndObjectTypeApiResponse = /** status 200 No content */ {
  geographic: Geometry;
  railjson: Railjson;
  schematic: Geometry;
}[];
export type PostInfraByIdObjectsAndObjectTypeApiArg = {
  /** Infra id */
  id: number;
  /** The type of the object */
  objectType: ObjectType;
  /** List of object id's */
  body: string[];
};
export type PostInfraByIdPathfindingApiResponse =
  /** status 200 Paths, containing track ranges, detectors and switches with their directions. If no path is found, an empty list is returned. */ {
    detectors?: string[];
    switches_directions?: {
      [key: string]: string;
    };
    track_ranges?: DirectionalTrackRange[];
  }[];
export type PostInfraByIdPathfindingApiArg = {
  /** Infra ID */
  id: number;
  /** Maximum number of paths to return */
  number?: number;
  /** Starting and ending track location */
  body: {
    ending?: TrackLocation;
    starting?: TrackLocation & {
      direction?: Direction;
    };
  };
};
export type GetInfraByIdRailjsonApiResponse =
  /** status 200 The infra in railjson format */ RailjsonFile;
export type GetInfraByIdRailjsonApiArg = {
  /** Infra ID */
  id: number;
};
export type GetInfraByIdRoutesTrackRangesApiResponse =
  /** status 200 Foreach route, the track ranges through which it passes or an error */ (
    | RouteTrackRangesNotFoundError
    | RouteTrackRangesCantComputePathError
    | RouteTrackRangesComputed
  )[];
export type GetInfraByIdRoutesTrackRangesApiArg = {
  /** Infra ID */
  id: number;
  routes: string;
};
export type GetInfraByIdRoutesAndWaypointTypeWaypointIdApiResponse =
  /** status 200 All routes that starting and ending by the given waypoint */ {
    ending?: string[];
    starting?: string[];
  };
export type GetInfraByIdRoutesAndWaypointTypeWaypointIdApiArg = {
  /** Infra ID */
  id: number;
  /** Type of the waypoint */
  waypointType: 'Detector' | 'BufferStop';
  /** The waypoint id */
  waypointId: string;
};
export type GetInfraByIdSpeedLimitTagsApiResponse = /** status 200 Tags list */ string[];
export type GetInfraByIdSpeedLimitTagsApiArg = {
  /** Infra id */
  id: number;
};
export type GetInfraByIdSwitchTypesApiResponse = /** status 200 A list of switch types */ object[];
export type GetInfraByIdSwitchTypesApiArg = {
  /** infra id */
  id: number;
};
export type PostInfraByIdUnlockApiResponse = unknown;
export type PostInfraByIdUnlockApiArg = {
  /** infra id */
  id: number;
};
export type GetInfraByIdVoltagesApiResponse = /** status 200 Voltages list */ string[];
export type GetInfraByIdVoltagesApiArg = {
  /** Infra ID */
  id: number;
  /** include rolling stocks modes or not */
  includeRollingStockModes?: boolean;
};
export type GetLayersLayerByLayerSlugMvtAndViewSlugApiResponse =
  /** status 200 Successful Response */ ViewMetadata;
export type GetLayersLayerByLayerSlugMvtAndViewSlugApiArg = {
  layerSlug: string;
  viewSlug: string;
  infra: number;
};
export type GetLayersTileByLayerSlugAndViewSlugZXYApiResponse = unknown;
export type GetLayersTileByLayerSlugAndViewSlugZXYApiArg = {
  layerSlug: string;
  viewSlug: string;
  z: number;
  x: number;
  y: number;
  infra: number;
};
export type GetLightRollingStockApiResponse = /** status 200 The rolling stock list */ {
  count?: number;
  next?: any;
  previous?: any;
  results: LightRollingStock[];
};
export type GetLightRollingStockApiArg = {
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type GetLightRollingStockByIdApiResponse =
  /** status 200 The rolling stock with their simplified effort curves */ LightRollingStock;
export type GetLightRollingStockByIdApiArg = {
  /** Rolling Stock ID */
  id: number;
};
export type PostPathfindingApiResponse = /** status 201 The created Path */ Path;
export type PostPathfindingApiArg = {
  /** Path information */
  pathQuery: PathQuery;
};
export type DeletePathfindingByIdApiResponse = unknown;
export type DeletePathfindingByIdApiArg = {
  /** Path ID */
  id: number;
};
export type GetPathfindingByIdApiResponse = /** status 200 The retrieved path */ Path;
export type GetPathfindingByIdApiArg = {
  /** Path ID */
  id: number;
};
export type PutPathfindingByIdApiResponse = /** status 200 The updated path */ Path[];
export type PutPathfindingByIdApiArg = {
  /** Path ID */
  id: number;
  /** Updated Path */
  pathQuery: PathQuery;
};
export type GetPathfindingByPathIdCatenariesApiResponse =
  /** status 200 A list of ranges associated to catenary modes. When a catenary overlapping another is found, a warning is added to the list. */ {
    catenary_ranges?: CatenaryRange[];
    warnings?: {
      catenary_id?: string;
      overlapping_ranges?: TrackRange[];
      type?: 'CatenaryOverlap';
    }[];
  };
export type GetPathfindingByPathIdCatenariesApiArg = {
  /** The path's id */
  pathId: number;
};
export type GetProjectsApiResponse = /** status 200 the project list */ {
  count?: number;
  next?: any;
  previous?: any;
  results?: ProjectResult[];
};
export type GetProjectsApiArg = {
  ordering?:
    | 'NameAsc'
    | 'NameDesc'
    | 'CreationDateAsc'
    | 'CreationDateDesc'
    | 'LastModifiedAsc'
    | 'LastModifiedDesc';
  /** Filter projects by name */
  name?: string;
  /** Filter projects by description */
  description?: string;
  /** Filter projects by tags */
  tags?: string;
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type PostProjectsApiResponse = /** status 201 The created project */ ProjectResult;
export type PostProjectsApiArg = {
  projectCreateRequest: ProjectCreateRequest;
};
export type DeleteProjectsByProjectIdApiResponse = unknown;
export type DeleteProjectsByProjectIdApiArg = {
  /** project id you want to delete */
  projectId: number;
};
export type GetProjectsByProjectIdApiResponse = /** status 200 The project info */ ProjectResult;
export type GetProjectsByProjectIdApiArg = {
  /** project id you want to retrieve */
  projectId: number;
};
export type PatchProjectsByProjectIdApiResponse =
  /** status 200 The project updated */ ProjectResult;
export type PatchProjectsByProjectIdApiArg = {
  /** project id you want to update */
  projectId: number;
  /** The fields you want to update */
  projectPatchRequest: ProjectPatchRequest;
};
export type GetProjectsByProjectIdStudiesApiResponse = /** status 200 the studies list */ {
  count?: number;
  next?: any;
  previous?: any;
  results?: StudyResult[];
};
export type GetProjectsByProjectIdStudiesApiArg = {
  projectId: number;
  ordering?:
    | 'NameAsc'
    | 'NameDesc'
    | 'CreationDateAsc'
    | 'CreationDateDesc'
    | 'LastModifiedAsc'
    | 'LastModifiedDesc';
  /** Filter operational studies by name */
  name?: string;
  /** Filter operational studies by description */
  description?: string;
  /** Filter operational studies by tags */
  tags?: string;
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type PostProjectsByProjectIdStudiesApiResponse =
  /** status 201 The created operational study */ StudyResult;
export type PostProjectsByProjectIdStudiesApiArg = {
  projectId: number;
  studyUpsertRequest: StudyUpsertRequest;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse = unknown;
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** project id refered to the operational study */
  projectId: number;
  /** study id you want to delete */
  studyId: number;
};
export type GetProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 200 The operational study info */ StudyResult;
export type GetProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** project id refered to the operational study */
  projectId: number;
  /** study id you want to retrieve */
  studyId: number;
};
export type PatchProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 200 The operational study updated */ StudyResult;
export type PatchProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** project id refered to the study */
  projectId: number;
  /** study id you want to retrieve */
  studyId: number;
  /** The fields you want to update */
  studyUpsertRequest: StudyUpsertRequest;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse =
  /** status 200 list of scenarios */ {
    count?: number;
    next?: any;
    previous?: any;
    results?: ScenarioListResult[];
  };
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosApiArg = {
  projectId: number;
  studyId: number;
  ordering?:
    | 'NameAsc'
    | 'NameDesc'
    | 'CreationDateAsc'
    | 'CreationDateDesc'
    | 'LastModifiedAsc'
    | 'LastModifiedDesc';
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse =
  /** status 201 The created scenario */ ScenarioResult;
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosApiArg = {
  projectId: number;
  studyId: number;
  scenarioRequest: ScenarioRequest;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse = unknown;
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** project id refered to the scenario */
  projectId: number;
  /** study id refered to the scenario */
  studyId: number;
  /** scenario id you want to delete */
  scenarioId: number;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The operational study info */ ScenarioResult;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** project id refered to the scenario */
  projectId: number;
  studyId: number;
  /** scenario id you want to retrieve */
  scenarioId: number;
};
export type PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The scenario updated */ ScenarioResult;
export type PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** project id refered to the scenario */
  projectId: number;
  /** study refered to the scenario */
  studyId: number;
  /** scenario you want to update */
  scenarioId: number;
  /** The fields you want to update */
  scenarioPatchRequest: ScenarioPatchRequest;
};
export type PostRollingStockApiResponse = /** status 200 The created rolling stock */ RollingStock;
export type PostRollingStockApiArg = {
  /** whether or not the rolling_stock can be edited/deleted. */
  locked?: boolean;
  rollingStockUpsertPayload: RollingStockUpsertPayload;
};
export type DeleteRollingStockByIdApiResponse = /** status 204 No content */ undefined;
export type DeleteRollingStockByIdApiArg = {
  /** rolling_stock id */
  id: number;
  /** force the deletion even if it’s used */
  force?: boolean;
};
export type GetRollingStockByIdApiResponse =
  /** status 200 The rolling stock information */ RollingStock;
export type GetRollingStockByIdApiArg = {
  /** Rolling Stock ID */
  id: number;
};
export type PatchRollingStockByIdApiResponse =
  /** status 200 The updated rolling stock */ RollingStock;
export type PatchRollingStockByIdApiArg = {
  /** Rolling Stock ID */
  id: number;
  rollingStockUpsertPayload: RollingStockUpsertPayload;
};
export type PostRollingStockByIdLiveryApiResponse =
  /** status 200 The rolling stock livery */ RollingStockLivery;
export type PostRollingStockByIdLiveryApiArg = {
  /** Rolling Stock ID */
  id: number;
  body: {
    images?: Blob[];
    name?: string;
  };
};
export type PatchRollingStockByIdLockedApiResponse = unknown;
export type PatchRollingStockByIdLockedApiArg = {
  /** Rolling_stock id */
  id: number;
  /** New locked value */
  body: {
    locked?: boolean;
  };
};
export type PostSearchApiResponse =
  /** status 200 Search results, the structure of the returned objects depend on their type */ (
    | SearchTrackResult
    | SearchOperationalPointResult
    | SearchSignalResult
    | SearchStudyResult
    | SearchProjectResult
    | SearchScenarioResult
  )[];
export type PostSearchApiArg = {
  /** number of results */
  pageSize?: number;
  /** Search query */
  body: {
    object?: string;
    page?: number;
    page_size?: number;
    query?: SearchQuery;
  };
};
export type GetTimetableByIdApiResponse =
  /** status 200 The timetable content */ TimetableWithSchedulesDetails;
export type GetTimetableByIdApiArg = {
  /** Timetable ID */
  id: number;
};
export type GetTimetableByIdConflictsApiResponse =
  /** status 200 The timetable conflicts content */ {
    conflict_type: string;
    end_time: string;
    start_time: string;
    train_ids: number[];
    train_names: string[];
  }[];
export type GetTimetableByIdConflictsApiArg = {
  /** Timetable ID */
  id: number;
};
export type DeleteTrainScheduleDeleteApiResponse = unknown;
export type DeleteTrainScheduleDeleteApiArg = {
  body: {
    ids: number[];
  };
};
export type GetTrainScheduleResultsApiResponse =
  /** status 200 The train schedules results */ SimulationReport[];
export type GetTrainScheduleResultsApiArg = {
  /** Path id used to project the train path */
  pathId: number;
  /** List of train schedule ids to return the results of */
  trainIds: string;
};
export type PostTrainScheduleStandaloneSimulationApiResponse =
  /** status 201 The ids of the train_schedules created */ number[];
export type PostTrainScheduleStandaloneSimulationApiArg = {
  /** The list of train schedules to simulate */
  body: TrainSchedule[];
};
export type DeleteTrainScheduleByIdApiResponse = unknown;
export type DeleteTrainScheduleByIdApiArg = {
  /** Train schedule ID */
  id: number;
};
export type GetTrainScheduleByIdApiResponse =
  /** status 200 The train schedule info */ TrainSchedule;
export type GetTrainScheduleByIdApiArg = {
  /** Train schedule ID */
  id: number;
};
export type PatchTrainScheduleByIdApiResponse = unknown;
export type PatchTrainScheduleByIdApiArg = {
  /** Train schedule ID */
  id: number;
  /** Train schedule fields */
  body: TrainSchedule[];
};
export type GetTrainScheduleByIdResultApiResponse =
  /** status 200 The train schedule result */ SimulationReport;
export type GetTrainScheduleByIdResultApiArg = {
  /** Train schedule ID */
  id: number;
  /** Path id used to project the train path */
  pathId: number;
};
export type GetVersionApiResponse = /** status 200 Return the service version */ {
  git_describe: string | null;
};
export type GetVersionApiArg = void;
export type TrackRange = {
  begin?: number;
  end?: number;
  track?: string;
};
export type ElectricalProfile = {
  power_class?: string;
  track_ranges?: TrackRange[];
  value?: string;
};
export type Infra = {
  created: string;
  generated_version: string | null;
  id: number;
  locked: boolean;
  modified: string;
  name: string;
  railjson_version: string;
  state:
    | 'NOT_LOADED'
    | 'INITIALIZING'
    | 'DOWNLOADING'
    | 'PARSING_JSON'
    | 'PARSING_INFRA'
    | 'ADAPTING_KOTLIN'
    | 'LOADING_SIGNALS'
    | 'BUILDING_BLOCKS'
    | 'CACHED'
    | 'TRANSIENT_ERROR'
    | 'ERROR';
  version: string;
};
export type RailjsonFile = {
  buffer_stops?: any;
  catenaries?: any;
  detectors?: any;
  operational_points?: any;
  routes?: any;
  signals?: any;
  speed_sections?: any;
  switch_types?: any;
  switches?: any;
  track_section_links?: any;
  track_sections?: any;
  version?: string;
};
export type ObjectType =
  | 'TrackSection'
  | 'Signal'
  | 'SpeedSection'
  | 'Detector'
  | 'TrackSectionLink'
  | 'Switch'
  | 'SwitchType'
  | 'BufferStop'
  | 'Route'
  | 'OperationalPoint'
  | 'Catenary';
export type DeleteOperation = {
  obj_id: string;
  obj_type: ObjectType;
  operation_type: 'DELETE';
};
export type Railjson = {
  id: string;
  [key: string]: any;
};
export type OperationObject = {
  obj_type: ObjectType;
  operation_type: 'CREATE' | 'UPDATE';
  railjson: Railjson;
};
export type OperationResult = DeleteOperation | OperationObject;
export type RailjsonObject = {
  obj_type: ObjectType;
  operation_type: 'CREATE';
  railjson: Railjson;
};
export type Patch = {
  from?: string;
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: object;
};
export type Patches = Patch[];
export type UpdateOperation = {
  obj_id?: string;
  obj_type: ObjectType;
  operation_type: 'UPDATE';
  railjson_patch: Patches;
};
export type Operation = RailjsonObject | DeleteOperation | UpdateOperation;
export type Point3D = number[];
export type Point = {
  coordinates: Point3D;
  type: 'Point';
};
export type LineString = {
  coordinates: Point3D[];
  type: 'LineString';
};
export type Polygon = {
  coordinates: Point3D[][];
  type: 'Polygon';
};
export type MultiPoint = {
  coordinates: Point3D[];
  type: 'MultiPoint';
};
export type MultiLineString = {
  coordinates: Point3D[][];
  type: 'MultiLineString';
};
export type MultiPolygon = {
  coordinates: Point3D[][][];
  type: 'MultiPolygon';
};
export type Geometry = Point | LineString | Polygon | MultiPoint | MultiLineString | MultiPolygon;
export type InfraErrorType =
  | 'duplicated_group'
  | 'empty_object'
  | 'invalid_group'
  | 'invalid_reference'
  | 'invalid_route'
  | 'invalid_switch_ports'
  | 'missing_route'
  | 'missing_buffer_stop'
  | 'object_out_of_path'
  | 'odd_buffer_stop_location'
  | 'out_of_range'
  | 'overlapping_speed_sections'
  | 'overlapping_switches'
  | 'overlapping_track_links'
  | 'overlapping_catenaries'
  | 'unknown_port_name'
  | 'unused_port';
export type InfraError = {
  geographic?: Geometry | null;
  information: {
    error_type: InfraErrorType;
    field?: string;
    is_warning: boolean;
    obj_id: string;
    obj_type: 'TrackSection' | 'Signal' | 'BufferStop' | 'Detector' | 'Switch' | 'Route';
  };
  schematic?: object | null;
};
export type BoundingBox = number[][];
export type Zone = {
  geo?: BoundingBox;
  sch?: BoundingBox;
};
export type Direction = 'START_TO_STOP' | 'STOP_TO_START';
export type DirectionalTrackRange = {
  begin: number;
  direction: Direction;
  end: number;
  track: string;
};
export type TrackLocation = {
  offset?: number;
  track?: string;
};
export type RouteTrackRangesNotFoundError = {
  type: 'NotFound';
};
export type RouteTrackRangesCantComputePathError = {
  type: 'CantComputePath';
};
export type RouteTrackRangesComputed = {
  track_ranges: DirectionalTrackRange[];
  type: 'Computed';
};
export type ViewMetadata = {
  attribution?: string;
  maxzoom?: number;
  minzoom?: number;
  name?: string;
  promotedId?: object;
  scheme?: string;
  tiles?: string[];
  type?: string;
};
export type SpeedDependantPower = {
  powers: number[];
  speeds: number[];
};
export type Catenary = {
  efficiency: number;
  energy_source_type: 'Catenary';
  max_input_power: SpeedDependantPower;
  max_output_power: SpeedDependantPower;
};
export type EnergyStorage = {
  capacity: number;
  refill_law: {
    soc_ref: number;
    tau: number;
  } | null;
  soc: number;
  soc_max: number;
  soc_min: number;
};
export type PowerPack = {
  efficiency: number;
  energy_source_type: 'PowerPack';
  energy_storage: EnergyStorage;
  max_input_power: SpeedDependantPower;
  max_output_power: SpeedDependantPower;
};
export type Battery = {
  efficiency: number;
  energy_source_type: 'Battery';
  energy_storage: EnergyStorage;
  max_input_power: SpeedDependantPower;
  max_output_power: SpeedDependantPower;
};
export type EnergySource =
  | ({
      energy_source_type: 'Catenary';
    } & Catenary)
  | ({
      energy_source_type: 'PowerPack';
    } & PowerPack)
  | ({
      energy_source_type: 'Battery';
    } & Battery);
export type RollingStockBase = {
  base_power_class: string;
  comfort_acceleration: number;
  electrical_power_startup_time: number | null;
  energy_sources: EnergySource[];
  features: string[];
  gamma: {
    type: 'CONST' | 'MAX';
    value: number;
  };
  inertia_coefficient: number;
  length: number;
  loading_gauge: 'G1' | 'G2' | 'GA' | 'GB' | 'GB1' | 'GC' | 'FR3.3' | 'FR3.3/GB/G2' | 'GLOTT';
  locked?: boolean;
  mass: number;
  max_speed: number;
  metadata: {
    detail: string;
    family: string;
    grouping: string;
    number: string;
    reference: string;
    series: string;
    subseries: string;
    type: string;
    unit: string;
  };
  name: string;
  power_restrictions: {
    [key: string]: string;
  };
  railjson_version: string;
  raise_pantograph_time: number | null;
  rolling_resistance: {
    A: number;
    B: number;
    C: number;
    type: 'davis';
  };
  startup_acceleration: number;
  startup_time: number;
};
export type RollingStockLivery = {
  compound_image_id: number | null;
  id: number;
  name: string;
};
export type LightRollingStock = RollingStockBase & {
  effort_curves: {
    default_mode: string;
    modes: {
      [key: string]: {
        is_electric: boolean;
      };
    };
  };
  id: number;
  liveries: RollingStockLivery[];
};
export type GeoJsonObject = {
  coordinates: number[][];
  type: string;
};
export type GeoJsonPosition = {
  coordinates: number[];
  type: string;
};
export type TrackSectionLocation = {
  offset: number;
  track_section: string;
};
export type PathStep = {
  duration: number;
  geo: GeoJsonPosition;
  id?: string;
  location: TrackSectionLocation;
  name?: string;
  path_offset: number;
  sch: GeoJsonPosition;
  suggestion: boolean;
};
export type Path = {
  created: string;
  curves: {
    position: number;
    radius: number;
  }[];
  geographic: GeoJsonObject;
  id: number;
  length: number;
  owner: string;
  schematic: GeoJsonObject;
  slopes: {
    gradient: number;
    position: number;
  }[];
  steps: PathStep[];
};
export type PathWaypoint = {
  geo_coordinate?: number[];
  offset?: number;
  track_section: string;
};
export type PathQuery = {
  infra: number;
  rolling_stocks: number[];
  steps: {
    duration: number;
    waypoints: PathWaypoint[];
  }[];
};
export type CatenaryRange = {
  begin?: number;
  end?: number;
  mode?: string;
};
export type ProjectResult = {
  budget?: number;
  creation_date?: string;
  description?: string;
  funders?: string;
  id?: number;
  image?: number | null;
  last_modification?: string;
  name?: string;
  objectives?: string;
  studies_count?: number;
  tags?: string[];
};
export type ProjectCreateRequest = {
  budget?: number;
  description?: string;
  funders?: string;
  image?: number;
  name: string;
  objectives?: string;
  tags?: string[];
};
export type ProjectPatchRequest = {
  budget?: number;
  description?: string;
  funders?: string;
  image?: number;
  name?: string;
  objectives?: string;
  tags?: string[];
};
export type StudyResult = {
  actual_end_date: string | null;
  budget: number;
  business_code: string;
  creation_date: string;
  description: string;
  expected_end_date: string | null;
  id: number;
  last_modification: string;
  name: string;
  project_id: number;
  scenarios_count: number;
  service_code: string;
  start_date: string | null;
  state?: 'started' | 'inProgress' | 'finish';
  study_type?:
    | 'timeTables'
    | 'flowRate'
    | 'parkSizing'
    | 'garageRequirement'
    | 'operationOrSizing'
    | 'operability'
    | 'strategicPlanning'
    | 'chartStability'
    | 'disturbanceTests';
  tags: string[];
};
export type StudyUpsertRequest = {
  actual_end_date?: string | null;
  budget?: number;
  business_code?: string;
  description?: string;
  expected_end_date?: string | null;
  name: string;
  service_code?: string;
  start_date?: string | null;
  state?: 'started' | 'inProgress' | 'finish';
  study_type?:
    | 'timeTables'
    | 'flowRate'
    | 'parkSizing'
    | 'garageRequirement'
    | 'operationOrSizing'
    | 'operability'
    | 'strategicPlanning'
    | 'chartStability'
    | 'disturbanceTests';
  tags: string[];
};
export type ScenarioListResult = {
  creation_date?: string;
  description?: string;
  electrical_profile_set_id?: number | null;
  electrical_profile_set_name?: string | null;
  id?: number;
  infra_id?: number;
  infra_name?: string;
  last_modification?: string;
  name?: string;
  study_id?: number;
  tags?: string[];
  timetable_id?: number;
  trains_count?: number;
};
export type ScenarioResult = {
  creation_date?: string;
  description?: string;
  electrical_profile_set_id?: number | null;
  electrical_profile_set_name?: string | null;
  id?: number;
  infra_id?: number;
  infra_name?: string;
  last_modification?: string;
  name?: string;
  study_id?: number;
  tags?: string[];
  timetable_id?: number;
  trains_count?: number;
  trains_schedules?: {
    departure_time?: string;
    id?: number;
    train_name?: string;
    train_path?: number;
  }[];
};
export type ScenarioRequest = {
  description?: string;
  electrical_profile_set_id?: number;
  infra_id: number;
  name: string;
  tags?: string[];
};
export type ScenarioPatchRequest = {
  description?: string;
  name?: string;
  tags?: string[];
};
export type Comfort = 'AC' | 'HEATING' | 'STANDARD';
export type EffortCurve = {
  max_efforts?: number[];
  speeds?: number[];
};
export type ConditionalEffortCurve = {
  cond?: {
    comfort?: Comfort | null;
    electrical_profile_level?: string | null;
    power_restriction_code?: string | null;
  } | null;
  curve?: EffortCurve;
};
export type RollingStockUpsertPayload = RollingStockBase & {
  effort_curves: {
    default_mode: string;
    modes: {
      [key: string]: {
        curves: ConditionalEffortCurve[];
        default_curve: EffortCurve;
        is_electric: boolean;
      };
    };
  };
};
export type RollingStock = RollingStockUpsertPayload & {
  id: number;
  liveries: RollingStockLivery[];
};
export type RollingStockUsage = {
  rolling_stock_id: number;
  usage: {
    project_id: number;
    project_name: string;
    scenario_id: number;
    scenario_name: string;
    study_id: number;
    study_name: string;
    train_name: string;
    train_schedule_id: number;
  };
};
export type SearchTrackResult = {
  infra_id: number;
  line_code: number;
  line_name: string;
};
export type SearchOperationalPointResult = {
  ch: string;
  geographic: MultiPoint;
  infra_id?: string;
  name: string;
  obj_id: string;
  schematic: MultiPoint;
  track_sections: {
    position: number;
    track: string;
  }[];
  trigram: string;
  uic?: number;
};
export type SearchSignalResult = {
  aspects?: string[];
  geographic: Point;
  infra_id?: number;
  label: string;
  line_code: number;
  line_name: string;
  schematic: Point;
  systems?: string[];
  type?: string;
};
export type SearchStudyResult = {
  description?: string;
  id: number;
  last_modification: string;
  name: string;
  project_id: number;
  scenarios_count?: number;
  tags?: string[];
};
export type SearchProjectResult = {
  description: string;
  id: number;
  image?: number;
  last_modification: string;
  name: string;
  studies_count?: number;
  tags?: any;
};
export type SearchScenarioResult = {
  description?: string;
  electrical_profile_set_id?: number;
  id: number;
  infra_id: number;
  infra_name?: string;
  last_modification: string;
  name: string;
  study_id: number;
  tags?: string[];
  trains_count?: number;
};
export type SearchQuery = (boolean | number | number | string | SearchQuery)[] | null;
export type AllowanceTimePerDistanceValue = {
  minutes: number;
  value_type: 'time_per_distance';
};
export type AllowanceTimeValue = {
  seconds: number;
  value_type: 'time';
};
export type AllowancePercentValue = {
  percentage: number;
  value_type: 'percentage';
};
export type AllowanceValue =
  | ({
      value_type: 'time_per_distance';
    } & AllowanceTimePerDistanceValue)
  | ({
      value_type: 'time';
    } & AllowanceTimeValue)
  | ({
      value_type: 'percentage';
    } & AllowancePercentValue);
export type RangeAllowance = {
  begin_position: number;
  end_position: number;
  value: AllowanceValue;
};
export type EngineeringAllowance = {
  allowance_type: 'engineering';
  capacity_speed_limit?: number;
  distribution: 'MARECO' | 'LINEAR';
} & RangeAllowance;
export type StandardAllowance = {
  allowance_type: 'standard';
  capacity_speed_limit?: number;
  default_value: AllowanceValue;
  distribution: 'MARECO' | 'LINEAR';
  ranges: RangeAllowance[];
};
export type Allowance =
  | ({
      allowance_type: 'engineering';
    } & EngineeringAllowance)
  | ({
      allowance_type: 'standard';
    } & StandardAllowance);
export type TrainScheduleOptions = {
  ignore_electrical_profiles?: boolean | null;
};
export type PowerRestrictionRange = {
  begin_position: number;
  end_position: number;
  power_restriction_code: string;
};
export type TrainScheduleSummary = {
  allowances?: Allowance[];
  arrival_time: number;
  comfort?: Comfort;
  departure_time: number;
  id: number;
  initial_speed?: number;
  labels: string[];
  mechanical_energy_consumed: {
    base?: number;
    eco?: number;
  };
  options?: TrainScheduleOptions | null;
  path_id?: number;
  path_length?: number;
  power_restriction_ranges?: PowerRestrictionRange[] | null;
  rolling_stock_id?: number;
  speed_limit_tags?: string;
  stops_count?: number;
  timetable_id?: number;
  train_name: string;
};
export type TimetableWithSchedulesDetails = {
  id: number;
  name: string;
  train_schedule_summaries: TrainScheduleSummary[];
};
export type SpaceTimePosition = {
  position: number;
  time: number;
};
export type SimulationReportByTrain = {
  head_positions: SpaceTimePosition[][];
  mechanical_energy_consumed: number;
  route_aspects: {
    aspect_label: string;
    blinking: boolean;
    color: number;
    position_end: number;
    position_start: number;
    route_id: string;
    signal_id: string;
    time_end: number;
    time_start: number;
  }[];
  signals: {
    aspects: string[];
    geo_position: number[];
    schema_position: number[];
    signal_id: number;
  }[];
  speeds: (SpaceTimePosition & {
    speed: number;
  })[];
  stops: {
    duration: number;
    id: number;
    line_code: number;
    line_name: string;
    name: string;
    position: number;
    time: number;
    track_name: string;
    track_number: number;
  }[];
  tail_positions: SpaceTimePosition[][];
};
export type Electrified = {
  mode: string;
  mode_handled: boolean;
  object_type: 'Electrified';
  profile?: string | null;
  profile_handled: boolean;
};
export type Neutral = {
  is_lower_pantograph: boolean;
  object_type: 'Neutral';
};
export type NonElectrified = {
  object_type: 'NonElectrified';
};
export type ElectrificationRange = {
  electrificationUsage:
    | ({
        object_type: 'Electrified';
      } & Electrified)
    | ({
        object_type: 'Neutral';
      } & Neutral)
    | ({
        object_type: 'NonElectrified';
      } & NonElectrified);
  start: number;
  stop: number;
};
export type PowerRestrictionRangeItem = {
  code: string;
  handled: boolean;
  start: number;
  stop: number;
};
export type SimulationReport = {
  base: SimulationReportByTrain;
  curves: {
    position: number;
    radius: number;
  }[];
  eco?: SimulationReportByTrain;
  electrification_ranges: ElectrificationRange[];
  id: number;
  labels: string[];
  name: string;
  path: number;
  power_restriction_ranges: PowerRestrictionRangeItem[];
  slopes: {
    gradient: number;
    position: number;
  }[];
  speed_limit_tags?: string;
  vmax: {
    position: number;
    speed: number;
  }[];
};
export type TrainSchedule = {
  allowances?: Allowance[];
  comfort?: Comfort;
  departure_time?: number;
  initial_speed?: number;
  labels?: string[];
  options?: TrainScheduleOptions | null;
  path?: number;
  power_restriction_ranges?: PowerRestrictionRange[] | null;
  rolling_stock?: number;
  scheduled_points?: {
    path_offset: number;
    time: number;
  }[];
  speed_limit_tags?: string;
  timetable?: number;
  train_name?: string;
};
