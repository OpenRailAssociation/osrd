import { baseEditoastApi as api } from './baseGeneratedApis';

export const addTagTypes = [
  'documents',
  'electrical_profiles',
  'infra',
  'rolling_stock',
  'pathfinding',
  'routes',
  'layers',
  'projects',
  'studies',
  'scenarios',
  'rolling_stock_livery',
  'search',
  'sprites',
  'stdcm',
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
        query: (queryArg) => ({
          url: `/documents/`,
          method: 'POST',
          body: queryArg.body,
          headers: { content_type: queryArg.contentType },
        }),
        invalidatesTags: ['documents'],
      }),
      deleteDocumentsByDocumentKey: build.mutation<
        DeleteDocumentsByDocumentKeyApiResponse,
        DeleteDocumentsByDocumentKeyApiArg
      >({
        query: (queryArg) => ({ url: `/documents/${queryArg.documentKey}/`, method: 'DELETE' }),
        invalidatesTags: ['documents'],
      }),
      getDocumentsByDocumentKey: build.query<
        GetDocumentsByDocumentKeyApiResponse,
        GetDocumentsByDocumentKeyApiArg
      >({
        query: (queryArg) => ({ url: `/documents/${queryArg.documentKey}/` }),
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
      deleteElectricalProfileSetById: build.mutation<
        DeleteElectricalProfileSetByIdApiResponse,
        DeleteElectricalProfileSetByIdApiArg
      >({
        query: (queryArg) => ({ url: `/electrical_profile_set/${queryArg.id}/`, method: 'DELETE' }),
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
      getInfraVoltages: build.query<GetInfraVoltagesApiResponse, GetInfraVoltagesApiArg>({
        query: () => ({ url: `/infra/voltages/` }),
        providesTags: ['infra', 'rolling_stock'],
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
      getLightRollingStockByRollingStockId: build.query<
        GetLightRollingStockByRollingStockIdApiResponse,
        GetLightRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({ url: `/light_rolling_stock/${queryArg.rollingStockId}/` }),
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
      getPathfindingByPathIdElectricalProfiles: build.query<
        GetPathfindingByPathIdElectricalProfilesApiResponse,
        GetPathfindingByPathIdElectricalProfilesApiArg
      >({
        query: (queryArg) => ({
          url: `/pathfinding/${queryArg.pathId}/electrical_profiles/`,
          params: {
            rolling_stock_id: queryArg.rollingStockId,
            electrical_profile_set_id: queryArg.electricalProfileSetId,
          },
        }),
        providesTags: ['electrical_profiles'],
      }),
      getProjects: build.query<GetProjectsApiResponse, GetProjectsApiArg>({
        query: (queryArg) => ({
          url: `/projects/`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
            ordering: queryArg.ordering,
          },
        }),
        providesTags: ['projects'],
      }),
      postProjects: build.mutation<PostProjectsApiResponse, PostProjectsApiArg>({
        query: (queryArg) => ({
          url: `/projects/`,
          method: 'POST',
          body: queryArg.projectCreateForm,
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
          body: queryArg.projectPatchForm,
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
            page: queryArg.page,
            page_size: queryArg.pageSize,
            ordering: queryArg.ordering,
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
          body: queryArg.studyCreateForm,
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
          body: queryArg.studyPatchForm,
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
            page: queryArg.page,
            page_size: queryArg.pageSize,
            ordering: queryArg.ordering,
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
          body: queryArg.scenarioCreateForm,
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
          body: queryArg.scenarioPatchForm,
        }),
        invalidatesTags: ['scenarios'],
      }),
      postRollingStock: build.mutation<PostRollingStockApiResponse, PostRollingStockApiArg>({
        query: (queryArg) => ({
          url: `/rolling_stock/`,
          method: 'POST',
          body: queryArg.rollingStockForm,
          params: { locked: queryArg.locked },
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      getRollingStockPowerRestrictions: build.query<
        GetRollingStockPowerRestrictionsApiResponse,
        GetRollingStockPowerRestrictionsApiArg
      >({
        query: () => ({ url: `/rolling_stock/power_restrictions/` }),
        providesTags: ['rolling_stock'],
      }),
      deleteRollingStockByRollingStockId: build.mutation<
        DeleteRollingStockByRollingStockIdApiResponse,
        DeleteRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.rollingStockId}/`,
          method: 'DELETE',
          body: queryArg.deleteRollingStockQueryParams,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      getRollingStockByRollingStockId: build.query<
        GetRollingStockByRollingStockIdApiResponse,
        GetRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({ url: `/rolling_stock/${queryArg.rollingStockId}/` }),
        providesTags: ['rolling_stock'],
      }),
      patchRollingStockByRollingStockId: build.mutation<
        PatchRollingStockByRollingStockIdApiResponse,
        PatchRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.rollingStockId}/`,
          method: 'PATCH',
          body: queryArg.rollingStockForm,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      postRollingStockByRollingStockIdLivery: build.mutation<
        PostRollingStockByRollingStockIdLiveryApiResponse,
        PostRollingStockByRollingStockIdLiveryApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.rollingStockId}/livery/`,
          method: 'POST',
          body: queryArg.rollingStockLiveryCreateForm,
        }),
        invalidatesTags: ['rolling_stock', 'rolling_stock_livery'],
      }),
      patchRollingStockByRollingStockIdLocked: build.mutation<
        PatchRollingStockByRollingStockIdLockedApiResponse,
        PatchRollingStockByRollingStockIdLockedApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.rollingStockId}/locked/`,
          method: 'PATCH',
          body: queryArg.rollingStockLockedUpdateForm,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      postSearch: build.mutation<PostSearchApiResponse, PostSearchApiArg>({
        query: (queryArg) => ({
          url: `/search/`,
          method: 'POST',
          body: queryArg.searchPayload,
          params: { page: queryArg.page, page_size: queryArg.pageSize },
        }),
        invalidatesTags: ['search'],
      }),
      postSingleSimulation: build.mutation<
        PostSingleSimulationApiResponse,
        PostSingleSimulationApiArg
      >({
        query: (queryArg) => ({
          url: `/single_simulation/`,
          method: 'POST',
          body: queryArg.singleSimulationRequest,
        }),
      }),
      getSpritesSignalingSystems: build.query<
        GetSpritesSignalingSystemsApiResponse,
        GetSpritesSignalingSystemsApiArg
      >({
        query: () => ({ url: `/sprites/signaling_systems/` }),
        providesTags: ['sprites'],
      }),
      getSpritesBySignalingSystemAndFileName: build.query<
        GetSpritesBySignalingSystemAndFileNameApiResponse,
        GetSpritesBySignalingSystemAndFileNameApiArg
      >({
        query: (queryArg) => ({
          url: `/sprites/${queryArg.signalingSystem}/${queryArg.fileName}/`,
        }),
        providesTags: ['sprites'],
      }),
      postStdcm: build.mutation<PostStdcmApiResponse, PostStdcmApiArg>({
        query: (queryArg) => ({ url: `/stdcm/`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['stdcm'],
      }),
      getTimetableById: build.query<GetTimetableByIdApiResponse, GetTimetableByIdApiArg>({
        query: (queryArg) => ({ url: `/timetable/${queryArg.id}/` }),
        providesTags: ['timetable'],
      }),
      postTimetableById: build.mutation<PostTimetableByIdApiResponse, PostTimetableByIdApiArg>({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['timetable'],
      }),
      getTimetableByIdConflicts: build.query<
        GetTimetableByIdConflictsApiResponse,
        GetTimetableByIdConflictsApiArg
      >({
        query: (queryArg) => ({ url: `/timetable/${queryArg.id}/conflicts/` }),
        providesTags: ['timetable'],
      }),
      deleteTrainSchedule: build.mutation<
        DeleteTrainScheduleApiResponse,
        DeleteTrainScheduleApiArg
      >({
        query: (queryArg) => ({ url: `/train_schedule/`, method: 'DELETE', body: queryArg.body }),
        invalidatesTags: ['train_schedule', 'timetable'],
      }),
      patchTrainSchedule: build.mutation<PatchTrainScheduleApiResponse, PatchTrainScheduleApiArg>({
        query: (queryArg) => ({ url: `/train_schedule/`, method: 'PATCH', body: queryArg.body }),
        invalidatesTags: ['train_schedule', 'timetable'],
      }),
      getTrainScheduleResults: build.query<
        GetTrainScheduleResultsApiResponse,
        GetTrainScheduleResultsApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/results/`,
          params: { path_id: queryArg.pathId, timetable_id: queryArg.timetableId },
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
        invalidatesTags: ['train_schedule', 'timetable'],
      }),
      getTrainScheduleById: build.query<
        GetTrainScheduleByIdApiResponse,
        GetTrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({ url: `/train_schedule/${queryArg.id}/` }),
        providesTags: ['train_schedule'],
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
      getVersionCore: build.query<GetVersionCoreApiResponse, GetVersionCoreApiArg>({
        query: () => ({ url: `/version/core/` }),
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as osrdEditoastApi };
export type PostDocumentsApiResponse =
  /** status 201 The document was created */ NewDocumentResponse;
export type PostDocumentsApiArg = {
  /** The document's content type */
  contentType: string;
  body: Blob;
};
export type DeleteDocumentsByDocumentKeyApiResponse =
  /** status 204 The document was deleted */ undefined;
export type DeleteDocumentsByDocumentKeyApiArg = {
  /** The document's key */
  documentKey: number;
};
export type GetDocumentsByDocumentKeyApiResponse =
  /** status 200 The document's binary content */ Blob;
export type GetDocumentsByDocumentKeyApiArg = {
  /** The document's key */
  documentKey: number;
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
export type DeleteElectricalProfileSetByIdApiResponse = unknown;
export type DeleteElectricalProfileSetByIdApiArg = {
  /** Electrical profile set ID */
  id: number;
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
export type GetInfraVoltagesApiResponse = /** status 200 Voltages list */ string[];
export type GetInfraVoltagesApiArg = void;
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
    detectors: string[];
    switches_directions: {
      [key: string]: string;
    };
    track_ranges: DirectionalTrackRange[];
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
  routes: string[];
};
export type GetInfraByIdRoutesAndWaypointTypeWaypointIdApiResponse =
  /** status 200 All routes that starting and ending by the given waypoint */ {
    ending: string[];
    starting: string[];
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
export type GetLightRollingStockApiResponse =
  /** status 200  */ PaginatedResponseOfLightRollingStockWithLiveries;
export type GetLightRollingStockApiArg = {
  page?: number;
  pageSize?: number | null;
};
export type GetLightRollingStockByRollingStockIdApiResponse =
  /** status 200 The rolling stock with their simplified effort curves */ LightRollingStockWithLiveries;
export type GetLightRollingStockByRollingStockIdApiArg = {
  rollingStockId: number;
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
  /** status 200  */ CatenariesOnPathResponse;
export type GetPathfindingByPathIdCatenariesApiArg = {
  /** The path's id */
  pathId: number;
};
export type GetPathfindingByPathIdElectricalProfilesApiResponse =
  /** status 200  */ ProfilesOnPathResponse;
export type GetPathfindingByPathIdElectricalProfilesApiArg = {
  /** The path's id */
  pathId: number;
  rollingStockId: number;
  electricalProfileSetId: number;
};
export type GetProjectsApiResponse =
  /** status 200 The list of projects */ PaginatedResponseOfProjectWithStudies;
export type GetProjectsApiArg = {
  page?: number;
  pageSize?: number | null;
  ordering?: Ordering;
};
export type PostProjectsApiResponse = /** status 201 The created project */ ProjectWithStudies;
export type PostProjectsApiArg = {
  projectCreateForm: ProjectCreateForm;
};
export type DeleteProjectsByProjectIdApiResponse =
  /** status 204 The project was deleted successfully */ undefined;
export type DeleteProjectsByProjectIdApiArg = {
  /** The id of a project */
  projectId: number;
};
export type GetProjectsByProjectIdApiResponse =
  /** status 200 The requested project */ ProjectWithStudies;
export type GetProjectsByProjectIdApiArg = {
  /** The id of a project */
  projectId: number;
};
export type PatchProjectsByProjectIdApiResponse =
  /** status 200 The updated project */ ProjectWithStudies;
export type PatchProjectsByProjectIdApiArg = {
  /** The id of a project */
  projectId: number;
  /** The fields to update */
  projectPatchForm: ProjectPatchForm;
};
export type GetProjectsByProjectIdStudiesApiResponse =
  /** status 200 The list of studies */ PaginatedResponseOfStudyWithScenarios;
export type GetProjectsByProjectIdStudiesApiArg = {
  /** The id of a project */
  projectId: number;
  page?: number;
  pageSize?: number | null;
  ordering?: Ordering;
};
export type PostProjectsByProjectIdStudiesApiResponse =
  /** status 201 The created study */ StudyWithScenarios;
export type PostProjectsByProjectIdStudiesApiArg = {
  /** The id of a project */
  projectId: number;
  studyCreateForm: StudyCreateForm;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 204 The study was deleted successfully */ undefined;
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
};
export type GetProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 200 The requested study */ StudyWithScenarios;
export type GetProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
};
export type PatchProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 200 The updated study */ StudyWithScenarios;
export type PatchProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  /** The fields to update */
  studyPatchForm: StudyPatchForm;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse =
  /** status 200 The list of scenarios */ PaginatedResponseOfScenarioWithCountTrains;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  page?: number;
  pageSize?: number | null;
  ordering?: Ordering;
};
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse =
  /** status 201 The created scenario */ ScenarioWithDetails;
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioCreateForm: ScenarioCreateForm;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 204 The scenario was deleted successfully */ undefined;
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The requested scenario */ ScenarioWithDetails;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
};
export type PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 204 The scenario was updated successfully */ undefined;
export type PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  scenarioPatchForm: ScenarioPatchForm;
};
export type PostRollingStockApiResponse = /** status 200 The created rolling stock */ RollingStock;
export type PostRollingStockApiArg = {
  locked?: boolean;
  rollingStockForm: RollingStockForm;
};
export type GetRollingStockPowerRestrictionsApiResponse =
  /** status 200 Retrieve the power restrictions list */ string[];
export type GetRollingStockPowerRestrictionsApiArg = void;
export type DeleteRollingStockByRollingStockIdApiResponse =
  /** status 204 The rolling stock was deleted successfully */ undefined;
export type DeleteRollingStockByRollingStockIdApiArg = {
  rollingStockId: number;
  deleteRollingStockQueryParams: DeleteRollingStockQueryParams;
};
export type GetRollingStockByRollingStockIdApiResponse =
  /** status 201 The requested rolling stock */ RollingStockWithLiveries;
export type GetRollingStockByRollingStockIdApiArg = {
  rollingStockId: number;
};
export type PatchRollingStockByRollingStockIdApiResponse =
  /** status 200 The created rolling stock */ RollingStock;
export type PatchRollingStockByRollingStockIdApiArg = {
  rollingStockId: number;
  rollingStockForm: RollingStockForm;
};
export type PostRollingStockByRollingStockIdLiveryApiResponse =
  /** status 200 The created rolling stock */ RollingStockLivery;
export type PostRollingStockByRollingStockIdLiveryApiArg = {
  rollingStockId: number;
  rollingStockLiveryCreateForm: RollingStockLiveryCreateForm;
};
export type PatchRollingStockByRollingStockIdLockedApiResponse =
  /** status 200 The created rolling stock */ RollingStock;
export type PatchRollingStockByRollingStockIdLockedApiArg = {
  rollingStockId: number;
  rollingStockLockedUpdateForm: RollingStockLockedUpdateForm;
};
export type PostSearchApiResponse = /** status 200 The search results */ SearchResultItem[];
export type PostSearchApiArg = {
  page?: number;
  pageSize?: number | null;
  searchPayload: SearchPayload;
};
export type PostSingleSimulationApiResponse =
  /** status 201 Data about the simulation produced */ SingleSimulationResponse;
export type PostSingleSimulationApiArg = {
  /** The details of the simulation */
  singleSimulationRequest: SingleSimulationRequest;
};
export type GetSpritesSignalingSystemsApiResponse =
  /** status 200 List of supported signaling systems */ string[];
export type GetSpritesSignalingSystemsApiArg = void;
export type GetSpritesBySignalingSystemAndFileNameApiResponse = unknown;
export type GetSpritesBySignalingSystemAndFileNameApiArg = {
  /** Signaling system name */
  signalingSystem: string;
  /** File name (json, png or svg) */
  fileName: string;
};
export type PostStdcmApiResponse =
  /** status 200 Simulation result */
  | {
      path: Path;
      simulation: SimulationReport;
    }
  | {
      error?: string;
    };
export type PostStdcmApiArg = {
  body: {
    comfort: Comfort;
    end_time?: number;
    infra_id: number;
    margin_after?: number;
    margin_before?: number;
    maximum_departure_delay: number;
    maximum_run_time?: number;
    rolling_stock_id: number;
    rolling_stocks: number[];
    speed_limit_tags?: string;
    standard_allowance?: AllowanceValue;
    start_time?: number;
    steps: {
      duration: number;
      waypoints: Waypoint;
    }[];
    timetable_id: number;
  };
};
export type GetTimetableByIdApiResponse =
  /** status 200 Timetable with schedules */ TimetableWithSchedulesDetails;
export type GetTimetableByIdApiArg = {
  /** Timetable id */
  id: number;
};
export type PostTimetableByIdApiResponse = unknown;
export type PostTimetableByIdApiArg = {
  /** Timetable id */
  id: number;
  body: TimetableImportItem[];
};
export type GetTimetableByIdConflictsApiResponse = /** status 200 Spacing conflicts */ Conflict[];
export type GetTimetableByIdConflictsApiArg = {
  /** Timetable id */
  id: number;
};
export type DeleteTrainScheduleApiResponse = unknown;
export type DeleteTrainScheduleApiArg = {
  body: {
    ids: number[];
  };
};
export type PatchTrainScheduleApiResponse = unknown;
export type PatchTrainScheduleApiArg = {
  body: TrainSchedulePatch[];
};
export type GetTrainScheduleResultsApiResponse =
  /** status 200 The train schedule results */ SimulationReport[];
export type GetTrainScheduleResultsApiArg = {
  /** The ID of the path that was used to project the train path */
  pathId?: number | null;
  /** The timetable ID */
  timetableId: number;
};
export type PostTrainScheduleStandaloneSimulationApiResponse =
  /** status 200 The ids of the train_schedules created */ number[];
export type PostTrainScheduleStandaloneSimulationApiArg = {
  body: {
    path: number;
    schedules: TrainScheduleBatchItem[];
    timetable: number;
  };
};
export type DeleteTrainScheduleByIdApiResponse = unknown;
export type DeleteTrainScheduleByIdApiArg = {
  /** A train schedule ID */
  id: number;
};
export type GetTrainScheduleByIdApiResponse = /** status 200 The train schedule */ TrainSchedule;
export type GetTrainScheduleByIdApiArg = {
  /** A train schedule ID */
  id: number;
};
export type GetTrainScheduleByIdResultApiResponse =
  /** status 200 The train schedule result */ SimulationReport;
export type GetTrainScheduleByIdResultApiArg = {
  pathId?: number | null;
  /** A train schedule ID */
  id: number;
};
export type GetVersionApiResponse = /** status 200 Return the service version */ Version;
export type GetVersionApiArg = void;
export type GetVersionCoreApiResponse = /** status 200 Return the core service version */ Version;
export type GetVersionCoreApiArg = void;
export type NewDocumentResponse = {
  document_key: number;
};
export type InternalError = {
  context: {
    [key: string]: any;
  };
  message: string;
  status?: number;
  type: string;
};
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
  track_sections?: any;
  version?: string;
};
export type ObjectType =
  | 'TrackSection'
  | 'Signal'
  | 'SpeedSection'
  | 'Detector'
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
export type LightModeEffortCurves = {
  is_electric: boolean;
};
export type LightEffortCurves = {
  default_mode: string;
  modes: {
    [key: string]: LightModeEffortCurves;
  };
};
export type SpeedDependantPower = {
  powers: number[];
  speeds: number[];
};
export type RefillLaw = {
  soc_ref: number;
  tau: number;
};
export type EnergyStorage = {
  capacity: number;
  refill_law?: RefillLaw | null;
  soc: number;
  soc_max: number;
  soc_min: number;
};
export type EnergySource =
  | {
      efficiency: number;
      energy_source_type: 'Catenary';
      max_input_power: SpeedDependantPower;
      max_output_power: SpeedDependantPower;
    }
  | {
      efficiency: number;
      energy_source_type: 'PowerPack';
      energy_storage: EnergyStorage;
      max_input_power: SpeedDependantPower;
      max_output_power: SpeedDependantPower;
    }
  | {
      efficiency: number;
      energy_source_type: 'Battery';
      energy_storage: EnergyStorage;
      max_input_power: SpeedDependantPower;
      max_output_power: SpeedDependantPower;
    };
export type Gamma = {
  type: string;
  value: number;
};
export type LoadingGaugeType =
  | 'G1'
  | 'G2'
  | 'GA'
  | 'GB'
  | 'GB1'
  | 'GC'
  | 'FR3.3'
  | 'FR3.3/GB/G2'
  | 'GLOTT';
export type RollingStockMetadata = {
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
export type RollingResistance = {
  A: number;
  B: number;
  C: number;
  type: string;
};
export type LightRollingStock = {
  base_power_class?: string | null;
  comfort_acceleration: number;
  effort_curves: LightEffortCurves;
  energy_sources: EnergySource[];
  features: string[];
  gamma: Gamma;
  id: number;
  inertia_coefficient: number;
  length: number;
  loading_gauge: LoadingGaugeType;
  locked: boolean;
  mass: number;
  max_speed: number;
  metadata: RollingStockMetadata;
  name: string;
  power_restrictions: {
    [key: string]: string;
  };
  railjson_version: string;
  rolling_resistance: RollingResistance;
  startup_acceleration: number;
  startup_time: number;
};
export type RollingStockLiveryMetadata = {
  compound_image_id?: number | null;
  id: number;
  name: string;
};
export type LightRollingStockWithLiveries = LightRollingStock & {
  liveries: RollingStockLiveryMetadata[];
};
export type PaginatedResponseOfLightRollingStockWithLiveries = {
  count: number;
  next: number | null;
  previous: number | null;
  results: LightRollingStockWithLiveries[];
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
export type RangedValue = {
  begin: number;
  end: number;
  value: string;
};
export type CatenariesOnPathResponse = {
  catenary_ranges: RangedValue[];
  warnings: InternalError[];
};
export type ProfilesOnPathResponse = {
  electrical_profile_ranges: RangedValue[];
  warnings: InternalError[];
};
export type Project = {
  budget: number;
  creation_date: string;
  description: string;
  funders: string;
  id: number;
  image?: number | null;
  last_modification: string;
  name: string;
  objectives: string;
  tags: string[];
};
export type ProjectWithStudies = Project & {
  studies_count: number;
};
export type PaginatedResponseOfProjectWithStudies = {
  count: number;
  next: number | null;
  previous: number | null;
  results: ProjectWithStudies[];
};
export type Ordering =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedDesc'
  | 'LastModifiedAsc';
export type ProjectCreateForm = {
  budget?: number;
  description?: string;
  funders?: string;
  image?: number | null;
  name: string;
  objectives?: string;
  tags?: string[];
};
export type ProjectPatchForm = {
  budget?: number | null;
  description?: string | null;
  funders?: string | null;
  image?: number | null;
  name?: string | null;
  objectives?: string | null;
  tags?: string[] | null;
};
export type Study = {
  actual_end_date?: string | null;
  budget: number;
  business_code: string;
  creation_date: string;
  description: string;
  expected_end_date?: string | null;
  id: number;
  last_modification: string;
  name: string;
  project_id: number;
  service_code: string;
  start_date?: string | null;
  state: string;
  study_type: string;
  tags: string[];
};
export type StudyWithScenarios = Study & {
  scenarios_count: number;
};
export type PaginatedResponseOfStudyWithScenarios = {
  count: number;
  next: number | null;
  previous: number | null;
  results: StudyWithScenarios[];
};
export type StudyCreateForm = {
  actual_end_date?: string | null;
  budget?: number;
  business_code?: string;
  description?: string;
  expected_end_date?: string | null;
  name: string;
  service_code?: string;
  start_date?: string | null;
  state?: string;
  study_type?: string;
  tags?: string[];
};
export type StudyPatchForm = {
  actual_end_date?: string | null;
  budget?: number | null;
  business_code?: string | null;
  description?: string | null;
  expected_end_date?: string | null;
  name?: string | null;
  service_code?: string | null;
  start_date?: string | null;
  state?: string | null;
  study_type?: string | null;
  tags?: string[] | null;
};
export type Scenario = {
  creation_date: string;
  description: string;
  electrical_profile_set_id?: number | null;
  id: number;
  infra_id: number;
  last_modification: string;
  name: string;
  study_id: number;
  tags: string[];
  timetable_id: number;
};
export type ScenarioWithCountTrains = Scenario & {
  infra_name: string;
  trains_count: number;
};
export type PaginatedResponseOfScenarioWithCountTrains = {
  count: number;
  next: number | null;
  previous: number | null;
  results: ScenarioWithCountTrains[];
};
export type LightTrainSchedule = {
  departure_time: number;
  id: number;
  train_name: string;
  train_path: number;
};
export type ScenarioWithDetails = Scenario & {
  electrical_profile_set_name?: string | null;
  infra_name: string;
  train_schedules: LightTrainSchedule[];
  trains_count: number;
};
export type ScenarioCreateForm = {
  description?: string;
  electrical_profile_set_id?: number | null;
  infra_id: number;
  name: string;
  tags?: string[];
};
export type ScenarioPatchForm = {
  description?: string | null;
  name?: string | null;
  tags?: string[] | null;
};
export type RollingStockComfortType = 'STANDARD' | 'AC' | 'HEATING';
export type EffortCurveConditions = {
  comfort?: RollingStockComfortType | null;
  electrical_profile_level?: string | null;
  power_restriction_code?: string | null;
};
export type EffortCurve = {
  max_efforts: number[];
  speeds: number[];
};
export type ConditionalEffortCurve = {
  cond: EffortCurveConditions;
  curve: EffortCurve;
};
export type ModeEffortCurves = {
  curves: ConditionalEffortCurve[];
  default_curve: EffortCurve;
  is_electric: boolean;
};
export type EffortCurves = {
  default_mode: string;
  modes: {
    [key: string]: ModeEffortCurves;
  };
};
export type RollingStockCommon = {
  base_power_class?: string | null;
  comfort_acceleration: number;
  effort_curves: EffortCurves;
  electrical_power_startup_time?: number | null;
  energy_sources?: EnergySource[];
  features: string[];
  gamma: Gamma;
  inertia_coefficient: number;
  length: number;
  loading_gauge: LoadingGaugeType;
  mass: number;
  max_speed: number;
  name: string;
  power_restrictions: {
    [key: string]: string;
  };
  raise_pantograph_time?: number | null;
  rolling_resistance: RollingResistance;
  startup_acceleration: number;
  startup_time: number;
};
export type RollingStock = RollingStockCommon & {
  id: number;
  locked: boolean;
  metadata: RollingStockMetadata;
  railjson_version: string;
};
export type RollingStockForm = RollingStockCommon & {
  locked?: boolean | null;
  metadata: RollingStockMetadata;
};
export type TrainScheduleScenarioStudyProject = {
  project_id: number;
  project_name: string;
  scenario_id: number;
  scenario_name: string;
  study_id: number;
  study_name: string;
  train_name: string;
  train_schedule_id: number;
};
export type RollingStockError =
  | 'CannotReadImage'
  | 'CannotCreateCompoundImage'
  | {
      NotFound: {
        rolling_stock_id: number;
      };
    }
  | {
      NameAlreadyUsed: {
        name: string;
      };
    }
  | {
      RollingStockIsLocked: {
        rolling_stock_id: number;
      };
    }
  | {
      RollingStockIsUsed: {
        rolling_stock_id: number;
        usage: TrainScheduleScenarioStudyProject[];
      };
    }
  | 'BasePowerClassEmpty';
export type DeleteRollingStockQueryParams = {
  force?: boolean;
};
export type RollingStockWithLiveries = RollingStock & {
  liveries: RollingStockLiveryMetadata[];
};
export type RollingStockLivery = {
  compound_image_id?: number | null;
  id: number;
  name: string;
  rolling_stock_id: number;
};
export type RollingStockLiveryCreateForm = {
  images: Blob[];
  name: string;
};
export type RollingStockLockedUpdateForm = {
  locked: boolean;
};
export type SearchResultItemTrack = {
  infra_id: number;
  line_code: number;
  line_name: string;
};
export type GeoJsonPointValue = number[];
export type GeoJsonPoint = {
  coordinates: GeoJsonPointValue;
  type: 'Point';
};
export type SearchResultItemOperationalPoint = {
  ch: string;
  geographic: GeoJsonPoint;
  infra_id: number;
  name: string;
  obj_id: string;
  schematic: GeoJsonPoint;
  track_sections: {
    position: number;
    track: string;
  }[];
  trigram: string;
  uic: number;
};
export type SearchResultItemSignal = {
  geographic: GeoJsonPoint;
  infra_id: number;
  label: string;
  line_code: number;
  line_name: string;
  schematic: GeoJsonPoint;
  settings: string[];
  signaling_systems: string[];
  sprite?: string | null;
  sprite_signaling_system?: string | null;
};
export type SearchResultItemProject = {
  description: string;
  id: number;
  image: number | null;
  last_modification: string;
  name: string;
  studies_count: number;
  tags: string[];
};
export type SearchResultItemStudy = {
  description: string;
  id: number;
  last_modification: string;
  name: string;
  project_id: number;
  scenarios_count: number;
  tags: string[];
};
export type SearchResultItemScenario = {
  description: string;
  electrical_profile_set_id: number | null;
  id: number;
  infra_id: number;
  infra_name: string;
  last_modification: string;
  name: string;
  study_id: number;
  tags: string[];
  trains_count: number;
};
export type SearchResultItem =
  | SearchResultItemTrack
  | SearchResultItemOperationalPoint
  | SearchResultItemSignal
  | SearchResultItemProject
  | SearchResultItemStudy
  | SearchResultItemScenario;
export type SearchQuery = boolean | number | number | string | (SearchQuery | null)[];
export type SearchPayload = {
  dry?: boolean;
  object: string;
  query: SearchQuery;
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
    id: string | null;
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
  lower_pantograph: boolean;
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
export type SingleSimulationResponse = {
  base_simulation: SimulationReportByTrain;
  eco_simulation: SimulationReportByTrain | null;
  electrification_ranges: ElectrificationRange[];
  power_restriction_ranges: PowerRestrictionRangeItem[];
  speed_limits: {
    position: number;
    speed: number;
  }[];
  warnings: string[];
};
export type AllowanceValue =
  | {
      minutes: number;
      value_type: 'time_per_distance';
    }
  | {
      seconds: number;
      value_type: 'time';
    }
  | {
      percentage: number;
      value_type: 'percentage';
    };
export type RangeAllowance = {
  begin_position: number;
  end_position: number;
  value: AllowanceValue;
};
export type AllowanceDistribution = 'MARECO' | 'LINEAR';
export type EngineeringAllowance = RangeAllowance & {
  capacity_speed_limit?: number;
  distribution: AllowanceDistribution;
};
export type StandardAllowance = {
  capacity_speed_limit?: number;
  default_value: AllowanceValue;
  distribution: AllowanceDistribution;
  ranges: RangeAllowance[];
};
export type Allowance =
  | (EngineeringAllowance & {
      allowance_type: 'engineering';
    })
  | (StandardAllowance & {
      allowance_type: 'standard';
    });
export type Comfort = 'AC' | 'HEATING' | 'STANDARD';
export type TrainScheduleOptions = {
  ignore_electrical_profiles?: boolean | null;
};
export type PowerRestrictionRange = {
  begin_position: number;
  end_position: number;
  power_restriction_code: string;
};
export type SingleSimulationRequest = {
  allowances?: Allowance[];
  comfort?: Comfort;
  electrical_profile_set_id?: number;
  initial_speed?: number;
  options?: TrainScheduleOptions | null;
  path_id: number;
  power_restriction_ranges?: PowerRestrictionRange[] | null;
  rolling_stock_id: number;
  scheduled_points?: {
    path_offset: number;
    time: number;
  }[];
  stops?: {
    duration?: number;
    location?: TrackLocation;
    position?: number;
  }[];
  tag?: string;
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
export type Waypoint = {
  geo_coordinate?: number[];
  track_section?: string;
}[];
export type Timetable = {
  id: number;
  name: string;
};
export type ScheduledPoint = {
  path_offset: number;
  time: number;
};
export type TrainSchedule = {
  allowances: Allowance[];
  comfort: RollingStockComfortType;
  departure_time: number;
  id: number;
  initial_speed: number;
  labels: string[];
  options: TrainScheduleOptions | null;
  path_id: number;
  power_restriction_ranges: PowerRestrictionRange[] | null;
  rolling_stock_id: number;
  scheduled_points: ScheduledPoint[];
  speed_limit_tags: string | null;
  timetable_id: number;
  train_name: string;
};
export type TrainScheduleValidation = 'NewerRollingStock' | 'NewerInfra';
export type MechanicalEnergyConsumedBaseEco = {
  base: number;
  eco?: number | null;
};
export type TrainScheduleSummary = TrainSchedule & {
  arrival_time: number;
  invalid_reasons: TrainScheduleValidation[];
  mechanical_energy_consumed: MechanicalEnergyConsumedBaseEco;
  path_length: number;
  stops_count: number;
};
export type TimetableWithSchedulesDetails = Timetable & {
  train_schedule_summaries: TrainScheduleSummary[];
};
export type TimetableImportPathLocation =
  | {
      offset: number;
      track_section: string;
      type: 'track_offset';
    }
  | {
      type: 'operational_point';
      uic: number;
    };
export type TimetableImportPathSchedule = {
  arrival_time: string;
  departure_time: string;
};
export type TimetableImportPathStep = {
  location: TimetableImportPathLocation;
  schedule?: {
    [key: string]: TimetableImportPathSchedule;
  };
};
export type TimetableImportTrain = {
  departure_time: string;
  name: string;
};
export type TimetableImportItem = {
  path: TimetableImportPathStep[];
  rolling_stock: string;
  trains: TimetableImportTrain[];
};
export type ConflictType = 'Spacing' | 'Routing';
export type Conflict = {
  conflict_type: ConflictType;
  end_time: number;
  start_time: number;
  train_ids: number[];
  train_names: string[];
};
export type TrainSchedulePatch = {
  allowances?: Allowance[] | null;
  comfort?: RollingStockComfortType | null;
  departure_time?: number | null;
  id: number;
  initial_speed?: number | null;
  labels?: string[] | null;
  options?: TrainScheduleOptions | null;
  path_id?: number | null;
  power_restriction_ranges?: PowerRestrictionRange[] | null;
  rolling_stock_id?: number | null;
  scheduled_points?: ScheduledPoint[] | null;
  speed_limit_tags?: string | null;
  train_name?: string | null;
};
export type TrainScheduleBatchItem = {
  allowances?: Allowance[];
  comfort?: RollingStockComfortType;
  departure_time: number;
  initial_speed: number;
  labels?: string[];
  options?: TrainScheduleOptions | null;
  power_restriction_ranges?: PowerRestrictionRange[] | null;
  rolling_stock_id: number;
  scheduled_points?: ScheduledPoint[];
  speed_limit_tags?: string | null;
  train_name: string;
};
export type Version = {
  git_describe: string | null;
};
