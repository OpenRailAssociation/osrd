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
  'pathfindingv2',
  'scenariosv2',
  'timetablev2',
  'train_schedulev2',
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
          body: queryArg.electricalProfileSetData,
          params: { name: queryArg.name },
        }),
        invalidatesTags: ['electrical_profiles'],
      }),
      deleteElectricalProfileSetByElectricalProfileSetId: build.mutation<
        DeleteElectricalProfileSetByElectricalProfileSetIdApiResponse,
        DeleteElectricalProfileSetByElectricalProfileSetIdApiArg
      >({
        query: (queryArg) => ({
          url: `/electrical_profile_set/${queryArg.electricalProfileSetId}/`,
          method: 'DELETE',
        }),
        invalidatesTags: ['electrical_profiles'],
      }),
      getElectricalProfileSetByElectricalProfileSetId: build.query<
        GetElectricalProfileSetByElectricalProfileSetIdApiResponse,
        GetElectricalProfileSetByElectricalProfileSetIdApiArg
      >({
        query: (queryArg) => ({
          url: `/electrical_profile_set/${queryArg.electricalProfileSetId}/`,
        }),
        providesTags: ['electrical_profiles'],
      }),
      getElectricalProfileSetByElectricalProfileSetIdLevelOrder: build.query<
        GetElectricalProfileSetByElectricalProfileSetIdLevelOrderApiResponse,
        GetElectricalProfileSetByElectricalProfileSetIdLevelOrderApiArg
      >({
        query: (queryArg) => ({
          url: `/electrical_profile_set/${queryArg.electricalProfileSetId}/level_order/`,
        }),
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
      getInfraByIdRailjson: build.query<
        GetInfraByIdRailjsonApiResponse,
        GetInfraByIdRailjsonApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.id}/railjson/` }),
        providesTags: ['infra'],
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
      getInfraByInfraIdAttachedAndTrackId: build.query<
        GetInfraByInfraIdAttachedAndTrackIdApiResponse,
        GetInfraByInfraIdAttachedAndTrackIdApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/attached/${queryArg.trackId}/` }),
        providesTags: ['infra'],
      }),
      getInfraByInfraIdAutoFixes: build.query<
        GetInfraByInfraIdAutoFixesApiResponse,
        GetInfraByInfraIdAutoFixesApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/auto_fixes/` }),
        providesTags: ['infra'],
      }),
      getInfraByInfraIdLinesAndLineCodeBbox: build.query<
        GetInfraByInfraIdLinesAndLineCodeBboxApiResponse,
        GetInfraByInfraIdLinesAndLineCodeBboxApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/lines/${queryArg.lineCode}/bbox/`,
        }),
        providesTags: ['infra'],
      }),
      postInfraByInfraIdPathfinding: build.mutation<
        PostInfraByInfraIdPathfindingApiResponse,
        PostInfraByInfraIdPathfindingApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/pathfinding/`,
          method: 'POST',
          body: queryArg.pathfindingInput,
          params: { number: queryArg.number },
        }),
        invalidatesTags: ['infra', 'pathfinding'],
      }),
      postInfraByInfraIdRoutesNodes: build.mutation<
        PostInfraByInfraIdRoutesNodesApiResponse,
        PostInfraByInfraIdRoutesNodesApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/routes/nodes/`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra', 'routes'],
      }),
      getInfraByInfraIdRoutesTrackRanges: build.query<
        GetInfraByInfraIdRoutesTrackRangesApiResponse,
        GetInfraByInfraIdRoutesTrackRangesApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/routes/track_ranges/`,
          params: { routes: queryArg.routes },
        }),
        providesTags: ['infra', 'routes'],
      }),
      getInfraByInfraIdRoutesAndWaypointTypeWaypointId: build.query<
        GetInfraByInfraIdRoutesAndWaypointTypeWaypointIdApiResponse,
        GetInfraByInfraIdRoutesAndWaypointTypeWaypointIdApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/routes/${queryArg.waypointType}/${queryArg.waypointId}/`,
        }),
        providesTags: ['infra', 'routes'],
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
        query: (queryArg) => ({
          url: `/pathfinding/`,
          method: 'POST',
          body: queryArg.pathfindingRequest,
        }),
        invalidatesTags: ['pathfinding'],
      }),
      deletePathfindingByPathfindingId: build.mutation<
        DeletePathfindingByPathfindingIdApiResponse,
        DeletePathfindingByPathfindingIdApiArg
      >({
        query: (queryArg) => ({ url: `/pathfinding/${queryArg.pathfindingId}/`, method: 'DELETE' }),
        invalidatesTags: ['pathfinding'],
      }),
      getPathfindingByPathfindingId: build.query<
        GetPathfindingByPathfindingIdApiResponse,
        GetPathfindingByPathfindingIdApiArg
      >({
        query: (queryArg) => ({ url: `/pathfinding/${queryArg.pathfindingId}/` }),
        providesTags: ['pathfinding'],
      }),
      putPathfindingByPathfindingId: build.mutation<
        PutPathfindingByPathfindingIdApiResponse,
        PutPathfindingByPathfindingIdApiArg
      >({
        query: (queryArg) => ({
          url: `/pathfinding/${queryArg.pathfindingId}/`,
          method: 'PUT',
          body: queryArg.pathfindingRequest,
        }),
        invalidatesTags: ['pathfinding'],
      }),
      getPathfindingByPathfindingIdElectricalProfiles: build.query<
        GetPathfindingByPathfindingIdElectricalProfilesApiResponse,
        GetPathfindingByPathfindingIdElectricalProfilesApiArg
      >({
        query: (queryArg) => ({
          url: `/pathfinding/${queryArg.pathfindingId}/electrical_profiles/`,
          params: {
            rolling_stock_id: queryArg.rollingStockId,
            electrical_profile_set_id: queryArg.electricalProfileSetId,
          },
        }),
        providesTags: ['electrical_profiles'],
      }),
      getPathfindingByPathfindingIdElectrifications: build.query<
        GetPathfindingByPathfindingIdElectrificationsApiResponse,
        GetPathfindingByPathfindingIdElectrificationsApiArg
      >({
        query: (queryArg) => ({ url: `/pathfinding/${queryArg.pathfindingId}/electrifications/` }),
        providesTags: ['infra'],
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
          params: { force: queryArg.force },
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
      postTrainScheduleResults: build.mutation<
        PostTrainScheduleResultsApiResponse,
        PostTrainScheduleResultsApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/results/`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['train_schedule'],
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
      postV2InfraByInfraIdPathProperties: build.mutation<
        PostV2InfraByInfraIdPathPropertiesApiResponse,
        PostV2InfraByInfraIdPathPropertiesApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/infra/${queryArg.infraId}/path_properties/`,
          method: 'POST',
          body: queryArg.pathPropertiesInput,
        }),
        invalidatesTags: ['pathfindingv2'],
      }),
      postV2InfraByInfraIdPathfindingBlocks: build.mutation<
        PostV2InfraByInfraIdPathfindingBlocksApiResponse,
        PostV2InfraByInfraIdPathfindingBlocksApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/infra/${queryArg.infraId}/pathfinding/blocks/`,
          method: 'POST',
          body: queryArg.pathfindingInputV2,
        }),
        invalidatesTags: ['pathfindingv2'],
      }),
      getV2ProjectsByProjectIdStudiesAndStudyIdScenarios: build.query<
        GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse,
        GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
            ordering: queryArg.ordering,
          },
        }),
        providesTags: ['scenariosv2'],
      }),
      postV2ProjectsByProjectIdStudiesAndStudyIdScenarios: build.mutation<
        PostV2ProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse,
        PostV2ProjectsByProjectIdStudiesAndStudyIdScenariosApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/`,
          method: 'POST',
          body: queryArg.scenarioCreateFormV2,
        }),
        invalidatesTags: ['scenariosv2'],
      }),
      deleteV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.mutation<
        DeleteV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        DeleteV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
          method: 'DELETE',
        }),
        invalidatesTags: ['scenariosv2'],
      }),
      getV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.query<
        GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
        }),
        providesTags: ['scenariosv2'],
      }),
      patchV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.mutation<
        PatchV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        PatchV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
          method: 'PATCH',
          body: queryArg.scenarioPatchFormV2,
        }),
        invalidatesTags: ['scenariosv2'],
      }),
      getV2Timetable: build.query<GetV2TimetableApiResponse, GetV2TimetableApiArg>({
        query: (queryArg) => ({
          url: `/v2/timetable/`,
          params: { page: queryArg.page, page_size: queryArg.pageSize },
        }),
        providesTags: ['timetablev2'],
      }),
      postV2Timetable: build.mutation<PostV2TimetableApiResponse, PostV2TimetableApiArg>({
        query: (queryArg) => ({
          url: `/v2/timetable/`,
          method: 'POST',
          body: queryArg.timetableForm,
        }),
        invalidatesTags: ['timetablev2'],
      }),
      deleteV2TimetableById: build.mutation<
        DeleteV2TimetableByIdApiResponse,
        DeleteV2TimetableByIdApiArg
      >({
        query: (queryArg) => ({ url: `/v2/timetable/${queryArg.id}/`, method: 'DELETE' }),
        invalidatesTags: ['timetablev2'],
      }),
      getV2TimetableById: build.query<GetV2TimetableByIdApiResponse, GetV2TimetableByIdApiArg>({
        query: (queryArg) => ({ url: `/v2/timetable/${queryArg.id}/` }),
        providesTags: ['timetablev2'],
      }),
      putV2TimetableById: build.mutation<PutV2TimetableByIdApiResponse, PutV2TimetableByIdApiArg>({
        query: (queryArg) => ({
          url: `/v2/timetable/${queryArg.id}/`,
          method: 'PUT',
          body: queryArg.timetableForm,
        }),
        invalidatesTags: ['timetablev2'],
      }),
      getV2TimetableByIdConflicts: build.query<
        GetV2TimetableByIdConflictsApiResponse,
        GetV2TimetableByIdConflictsApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/timetable/${queryArg.id}/conflicts/`,
          params: { infra_id: queryArg.infraId },
        }),
        providesTags: ['timetablev2'],
      }),
      deleteV2TrainSchedule: build.mutation<
        DeleteV2TrainScheduleApiResponse,
        DeleteV2TrainScheduleApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/train_schedule/`,
          method: 'DELETE',
          body: queryArg.body,
        }),
        invalidatesTags: ['train_schedulev2'],
      }),
      postV2TrainSchedule: build.mutation<
        PostV2TrainScheduleApiResponse,
        PostV2TrainScheduleApiArg
      >({
        query: (queryArg) => ({ url: `/v2/train_schedule/`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['train_schedulev2'],
      }),
      postV2TrainScheduleProjectPath: build.mutation<
        PostV2TrainScheduleProjectPathApiResponse,
        PostV2TrainScheduleProjectPathApiArg
      >({
        query: () => ({ url: `/v2/train_schedule/project_path/`, method: 'POST' }),
        invalidatesTags: ['train_schedulev2'],
      }),
      getV2TrainScheduleSimulationSummary: build.query<
        GetV2TrainScheduleSimulationSummaryApiResponse,
        GetV2TrainScheduleSimulationSummaryApiArg
      >({
        query: () => ({ url: `/v2/train_schedule/simulation_summary/` }),
        providesTags: ['train_schedulev2'],
      }),
      getV2TrainScheduleById: build.query<
        GetV2TrainScheduleByIdApiResponse,
        GetV2TrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({ url: `/v2/train_schedule/${queryArg.id}/` }),
        providesTags: ['train_schedulev2'],
      }),
      putV2TrainScheduleById: build.mutation<
        PutV2TrainScheduleByIdApiResponse,
        PutV2TrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/train_schedule/${queryArg.id}/`,
          method: 'PUT',
          body: queryArg.trainScheduleForm,
        }),
        invalidatesTags: ['train_schedulev2', 'timetable'],
      }),
      getV2TrainScheduleByIdPath: build.query<
        GetV2TrainScheduleByIdPathApiResponse,
        GetV2TrainScheduleByIdPathApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/train_schedule/${queryArg.id}/path/`,
          params: { infra_id: queryArg.infraId },
        }),
        providesTags: ['train_schedulev2', 'pathfindingv2'],
      }),
      getV2TrainScheduleByIdSimulation: build.query<
        GetV2TrainScheduleByIdSimulationApiResponse,
        GetV2TrainScheduleByIdSimulationApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/train_schedule/${queryArg.id}/simulation/`,
          params: { infra_id: queryArg.infraId },
        }),
        providesTags: ['train_schedulev2'],
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
  /** status 204 The document was deleted */ void;
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
  /** status 200 The list of ids and names of electrical profile sets available */ LightElectricalProfileSet[];
export type GetElectricalProfileSetApiArg = void;
export type PostElectricalProfileSetApiResponse =
  /** status 200 The list of ids and names of electrical profile sets available */ ElectricalProfileSet;
export type PostElectricalProfileSetApiArg = {
  name: string;
  electricalProfileSetData: ElectricalProfileSetData;
};
export type DeleteElectricalProfileSetByElectricalProfileSetIdApiResponse =
  /** status 204 The electrical profile was deleted successfully */ void;
export type DeleteElectricalProfileSetByElectricalProfileSetIdApiArg = {
  electricalProfileSetId: number;
};
export type GetElectricalProfileSetByElectricalProfileSetIdApiResponse =
  /** status 200 The list of electrical profiles in the set */ ElectricalProfileSetData;
export type GetElectricalProfileSetByElectricalProfileSetIdApiArg = {
  electricalProfileSetId: number;
};
export type GetElectricalProfileSetByElectricalProfileSetIdLevelOrderApiResponse =
  /** status 200 A dictionary mapping electrification modes to a list of electrical profiles ordered by decreasing strength */ {
    [key: string]: LevelValues;
  };
export type GetElectricalProfileSetByElectricalProfileSetIdLevelOrderApiArg = {
  electricalProfileSetId: number;
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
  infra?: number;
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
  /** status 200 An array containing infos about the operations processed */ RailjsonObject[];
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
  /** Total number of elements */
  count?: number;
  /** The index of the following page (null if no more pages available) */
  next?: number | null;
  /** The index of the previous page (null if requesting the first page) */
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
  /** object's geographic in geojson format */
  geographic: Geometry;
  /** Object properties in railjson format */
  railjson: Railjson;
  /** object's schematic in geojson format */
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
export type GetInfraByIdRailjsonApiResponse =
  /** status 200 The infra in railjson format */ RailjsonFile;
export type GetInfraByIdRailjsonApiArg = {
  /** Infra ID */
  id: number;
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
export type GetInfraByInfraIdAttachedAndTrackIdApiResponse =
  /** status 200 All objects attached to the given track (arranged by types) */ {
    [key: string]: string[];
  };
export type GetInfraByInfraIdAttachedAndTrackIdApiArg = {
  /** An infra ID */
  infraId: number;
  /** A track section ID */
  trackId: string;
};
export type GetInfraByInfraIdAutoFixesApiResponse =
  /** status 200 The list of suggested operations */ Operation[];
export type GetInfraByInfraIdAutoFixesApiArg = {
  /** The ID of the infra to fix */
  infraId: number;
};
export type GetInfraByInfraIdLinesAndLineCodeBboxApiResponse =
  /** status 200 The BBox of the line */ Zone;
export type GetInfraByInfraIdLinesAndLineCodeBboxApiArg = {
  /** The ID of the infra to fix */
  infraId: number;
  /** A line code */
  lineCode: number;
};
export type PostInfraByInfraIdPathfindingApiResponse =
  /** status 200 A list of shortest paths between starting and ending track locations */ PathfindingOutput[];
export type PostInfraByInfraIdPathfindingApiArg = {
  /** The ID of the infra to fix */
  infraId: number;
  number?: number | null;
  pathfindingInput: PathfindingInput;
};
export type PostInfraByInfraIdRoutesNodesApiResponse =
  /** status 200 A list of routes IDs */ string[];
export type PostInfraByInfraIdRoutesNodesApiArg = {
  /** The ID of the infra to fix */
  infraId: number;
  /** A mapping node_id -> node_state | null */
  body: {
    [key: string]: string | null;
  };
};
export type GetInfraByInfraIdRoutesTrackRangesApiResponse =
  /** status 200 Foreach route, all the track ranges in it or an error */ (
    | {
        track_ranges: DirectionalTrackRange[];
        type: 'Computed';
      }
    | {
        type: 'NotFound';
      }
    | {
        type: 'CantComputePath';
      }
  )[];
export type GetInfraByInfraIdRoutesTrackRangesApiArg = {
  /** The ID of the infra to fix */
  infraId: number;
  /** A list of comma-separated route ids */
  routes: string;
};
export type GetInfraByInfraIdRoutesAndWaypointTypeWaypointIdApiResponse =
  /** status 200 All routes that starting and ending by the given waypoint */ {
    ending: string[];
    starting: string[];
  };
export type GetInfraByInfraIdRoutesAndWaypointTypeWaypointIdApiArg = {
  /** Infra ID */
  infraId: number;
  /** Type of the waypoint */
  waypointType: 'Detector' | 'BufferStop';
  /** Waypoint ID */
  waypointId: string;
};
export type GetLayersLayerByLayerSlugMvtAndViewSlugApiResponse =
  /** status 200 Successful Response */ {
    attribution: string;
    maxzoom: number;
    minzoom: number;
    name: string;
    promoteId: {
      [key: string]: string;
    };
    scheme: string;
    tiles: string[];
    type: string;
  };
export type GetLayersLayerByLayerSlugMvtAndViewSlugApiArg = {
  infra: number;
  layerSlug: string;
  viewSlug: string;
};
export type GetLayersTileByLayerSlugAndViewSlugZXYApiResponse = unknown;
export type GetLayersTileByLayerSlugAndViewSlugZXYApiArg = {
  infra: number;
  layerSlug: string;
  viewSlug: string;
  x: number;
  y: number;
  z: number;
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
export type PostPathfindingApiResponse = /** status 201 The created path */ PathResponse;
export type PostPathfindingApiArg = {
  pathfindingRequest: PathfindingRequest;
};
export type DeletePathfindingByPathfindingIdApiResponse = unknown;
export type DeletePathfindingByPathfindingIdApiArg = {
  /** A stored path ID */
  pathfindingId: number;
};
export type GetPathfindingByPathfindingIdApiResponse =
  /** status 200 The requested path */ PathResponse;
export type GetPathfindingByPathfindingIdApiArg = {
  /** A stored path ID */
  pathfindingId: number;
};
export type PutPathfindingByPathfindingIdApiResponse =
  /** status 200 The updated path */ PathResponse;
export type PutPathfindingByPathfindingIdApiArg = {
  /** A stored path ID */
  pathfindingId: number;
  pathfindingRequest: PathfindingRequest;
};
export type GetPathfindingByPathfindingIdElectricalProfilesApiResponse =
  /** status 200  */ ProfilesOnPathResponse;
export type GetPathfindingByPathfindingIdElectricalProfilesApiArg = {
  /** A stored path ID */
  pathfindingId: number;
  rollingStockId: number;
  electricalProfileSetId: number;
};
export type GetPathfindingByPathfindingIdElectrificationsApiResponse =
  /** status 200  */ ElectrificationsOnPathResponse;
export type GetPathfindingByPathfindingIdElectrificationsApiArg = {
  /** A stored path ID */
  pathfindingId: number;
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
  /** status 204 The project was deleted successfully */ void;
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
  /** status 201 The created study */ StudyResponse;
export type PostProjectsByProjectIdStudiesApiArg = {
  /** The id of a project */
  projectId: number;
  studyCreateForm: StudyCreateForm;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 204 The study was deleted successfully */ void;
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
};
export type GetProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 200 The requested study */ StudyResponse;
export type GetProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
};
export type PatchProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 200 The updated study */ StudyResponse;
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
  /** status 201 The created scenario */ ScenarioResponse;
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioCreateForm: ScenarioCreateForm;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 204 The scenario was deleted successfully */ void;
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The requested scenario */ ScenarioResponse;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
};
export type PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 204 The scenario was updated successfully */ ScenarioResponse;
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
  /** status 204 The rolling stock was deleted successfully */ void;
export type DeleteRollingStockByRollingStockIdApiArg = {
  rollingStockId: number;
  /** force the deletion even if it’s used */
  force?: boolean;
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
  /** status 200 Data about the simulation produced */ SingleSimulationResponse;
export type PostSingleSimulationApiArg = {
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
export type PostStdcmApiResponse = /** status 201 The simulation result */ {
  path: PathResponse;
  path_payload: PathfindingPayload;
  simulation: SimulationReport;
};
export type PostStdcmApiArg = {
  body: {
    comfort: RollingStockComfortType;
    end_time?: number | null;
    infra_id: number;
    /** Margin after the train passage in seconds
        
        Enforces that the path used by the train should be free and
        available at least that many seconds after its passage. */
    margin_after?: number;
    /** Margin before the train passage in seconds
        
        Enforces that the path used by the train should be free and
        available at least that many seconds before its passage. */
    margin_before?: number;
    /** By how long we can shift the departure time in seconds */
    maximum_departure_delay?: number;
    /** Specifies how long the total run time can be in seconds */
    maximum_run_time?: number;
    rolling_stock_id: number;
    /** Train categories for speed limits */
    speed_limit_tags?: string | null;
    standard_allowance?: AllowanceValue | null;
    start_time?: number | null;
    steps: PathfindingStep[];
    timetable_id: number;
  };
};
export type GetTimetableByIdApiResponse =
  /** status 200 Timetable with schedules */ TimetableWithSchedulesDetails;
export type GetTimetableByIdApiArg = {
  /** Timetable id */
  id: number;
};
export type PostTimetableByIdApiResponse = /** status 200 Import report */ {
  [key: string]: TrainImportReport;
};
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
export type PostTrainScheduleResultsApiResponse =
  /** status 200 The train schedule simulations results and a list of invalid train_ids */ TrainSimulationResponse;
export type PostTrainScheduleResultsApiArg = {
  body: {
    /** A path ID to project the simulation results onto. If not provided, the path of the first train will be used. */
    path_id?: number | null;
    /** The IDs of the trains to simulate */
    train_ids: number[];
  };
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
export type PostV2InfraByInfraIdPathPropertiesApiResponse =
  /** status 200 Path properties */ PathProperties;
export type PostV2InfraByInfraIdPathPropertiesApiArg = {
  /** The infra id */
  infraId: number;
  pathPropertiesInput: PathPropertiesInput;
};
export type PostV2InfraByInfraIdPathfindingBlocksApiResponse =
  /** status 200 Pathfinding Result */ PathfindingResult;
export type PostV2InfraByInfraIdPathfindingBlocksApiArg = {
  /** The infra id */
  infraId: number;
  pathfindingInputV2: PathfindingInputV2;
};
export type GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse =
  /** status 200 The list of scenarios */ PaginatedResponseOfScenarioWithDetails;
export type GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  page?: number;
  pageSize?: number | null;
  ordering?: Ordering;
};
export type PostV2ProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse =
  /** status 201 The created scenario */ ScenarioResponseV2;
export type PostV2ProjectsByProjectIdStudiesAndStudyIdScenariosApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioCreateFormV2: ScenarioCreateFormV2;
};
export type DeleteV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 204 The scenario was deleted successfully */ void;
export type DeleteV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
};
export type GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The requested scenario */ ScenarioResponseV2;
export type GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
};
export type PatchV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 204 The scenario was updated successfully */ ScenarioResponseV2;
export type PatchV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  scenarioPatchFormV2: ScenarioPatchFormV2;
};
export type GetV2TimetableApiResponse =
  /** status 200 List timetables */ PaginatedResponseOfTimetable;
export type GetV2TimetableApiArg = {
  page?: number;
  pageSize?: number | null;
};
export type PostV2TimetableApiResponse =
  /** status 200 Timetable with train schedules ids */ TimetableResult;
export type PostV2TimetableApiArg = {
  timetableForm: TimetableForm;
};
export type DeleteV2TimetableByIdApiResponse = unknown;
export type DeleteV2TimetableByIdApiArg = {
  /** A timetable ID */
  id: number;
};
export type GetV2TimetableByIdApiResponse =
  /** status 200 Timetable with train schedules ids */ TimetableDetailedResult;
export type GetV2TimetableByIdApiArg = {
  /** A timetable ID */
  id: number;
};
export type PutV2TimetableByIdApiResponse =
  /** status 200 Timetable with train schedules ids */ TimetableDetailedResult;
export type PutV2TimetableByIdApiArg = {
  /** A timetable ID */
  id: number;
  timetableForm: TimetableForm;
};
export type GetV2TimetableByIdConflictsApiResponse =
  /** status 200 list of conflict */ ConflictV2[];
export type GetV2TimetableByIdConflictsApiArg = {
  /** The timetable id */
  id: number;
  /** The infra id */
  infraId: number;
};
export type DeleteV2TrainScheduleApiResponse = unknown;
export type DeleteV2TrainScheduleApiArg = {
  body: {
    ids: number[];
  };
};
export type PostV2TrainScheduleApiResponse =
  /** status 200 The train schedule */ TrainScheduleResult[];
export type PostV2TrainScheduleApiArg = {
  body: TrainScheduleForm[];
};
export type PostV2TrainScheduleProjectPathApiResponse = /** status 200 Project Path Output */ {
  [key: string]: ProjectPathResult;
};
export type PostV2TrainScheduleProjectPathApiArg = void;
export type GetV2TrainScheduleSimulationSummaryApiResponse = /** status 200 Project Path Output */ {
  [key: string]: SimulationSummaryResultResponse;
};
export type GetV2TrainScheduleSimulationSummaryApiArg = void;
export type GetV2TrainScheduleByIdApiResponse =
  /** status 200 The train schedule */ TrainScheduleResult;
export type GetV2TrainScheduleByIdApiArg = {
  /** A train schedule ID */
  id: number;
};
export type PutV2TrainScheduleByIdApiResponse =
  /** status 200 The train schedule have been updated */ TrainScheduleResult;
export type PutV2TrainScheduleByIdApiArg = {
  /** A train schedule ID */
  id: number;
  trainScheduleForm: TrainScheduleForm;
};
export type GetV2TrainScheduleByIdPathApiResponse = /** status 200 The path */ PathfindingResult;
export type GetV2TrainScheduleByIdPathApiArg = {
  /** A train schedule ID */
  id: number;
  infraId: number;
};
export type GetV2TrainScheduleByIdSimulationApiResponse =
  /** status 200 Simulation Output */ SimulationResult;
export type GetV2TrainScheduleByIdSimulationApiArg = {
  /** A train schedule ID */
  id: number;
  infraId: number;
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
export type LightElectricalProfileSet = {
  id: number;
  name: string;
};
export type LevelValues = string[];
export type Direction = 'START_TO_STOP' | 'STOP_TO_START';
export type TrackRange = {
  begin: number;
  direction: Direction;
  end: number;
  track_section: string;
};
export type ElectricalProfile = {
  power_class: string;
  track_ranges: TrackRange[];
  value: string;
};
export type ElectricalProfileSetData = {
  level_order: {
    [key: string]: LevelValues;
  };
  levels: ElectricalProfile[];
};
export type ElectricalProfileSet = {
  data: ElectricalProfileSetData;
  id: number;
  name: string;
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
  detectors?: any;
  electrifications?: any;
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
  | 'NeutralSection'
  | 'Switch'
  | 'SwitchType'
  | 'BufferStop'
  | 'Route'
  | 'OperationalPoint'
  | 'Electrification';
export type Railjson = {
  id: string;
  [key: string]: any;
};
export type RailjsonObject = {
  obj_type: ObjectType;
  railjson: Railjson;
};
export type Patch = {
  /** A string containing a JSON Pointer value. */
  from?: string;
  /** The operation to be performed */
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  /** A JSON-Pointer */
  path: string;
  /** The value to be used within the operations. */
  value?: object;
};
export type Patches = Patch[];
export type UpdateOperation = {
  obj_id?: string;
  obj_type: ObjectType;
  operation_type: 'UPDATE';
  railjson_patch: Patches;
};
export type DeleteOperation = {
  obj_id: string;
  obj_type: ObjectType;
  operation_type: 'DELETE';
};
export type Operation =
  | (RailjsonObject & {
      operation_type: 'CREATE';
    })
  | (UpdateOperation & {
      operation_type: 'UPDATE';
    })
  | (DeleteOperation & {
      operation_type: 'DELETE';
    });
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
  | 'overlapping_electrifications'
  | 'unknown_port_name'
  | 'unused_port'
  | 'node_endpoints_not_unique';
export type InfraError = {
  /** Geojson of the geographic geometry of the error */
  geographic?: Geometry;
  /** Information about the error (check schema documentation for more details) */
  information: {
    error_type: InfraErrorType;
    field?: string;
    is_warning: boolean;
    obj_id: string;
    obj_type: 'TrackSection' | 'Signal' | 'BufferStop' | 'Detector' | 'Switch' | 'Route';
  };
  /** Geojson of the schematic geometry of the error */
  schematic?: object | null;
};
export type BoundingBox = (number & number)[][];
export type Zone = {
  geo: BoundingBox;
  sch: BoundingBox;
};
export type DirectionalTrackRange = {
  begin: number;
  direction: Direction;
  end: number;
  track: string;
};
export type PathfindingOutput = {
  detectors: string[];
  switches_directions: {
    [key: string]: string;
  };
  track_ranges: DirectionalTrackRange[];
};
export type PathfindingTrackLocationInput = {
  position: number;
  track: string;
};
export type PathfindingInput = {
  ending: PathfindingTrackLocationInput;
  starting: PathfindingTrackLocationInput;
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
  refill_law: RefillLaw | null;
  soc: number;
  soc_max: number;
  soc_min: number;
};
export type EnergySource =
  | {
      efficiency: number;
      energy_source_type: 'Electrification';
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
export type RollingStockSupportedSignalingSystems = string[];
export type LightRollingStock = {
  base_power_class?: string | null;
  comfort_acceleration: number;
  effort_curves: LightEffortCurves;
  energy_sources: EnergySource[];
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
  supported_signaling_systems: RollingStockSupportedSignalingSystems;
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
  /** The total number of items */
  count: number;
  /** The next page number */
  next: number | null;
  /** The previous page number */
  previous: number | null;
  /** The list of results */
  results: LightRollingStockWithLiveries[];
};
export type Curve = {
  position: number;
  radius: number;
};
export type GeoJsonPointValue = number[];
export type GeoJsonLineStringValue = GeoJsonPointValue[];
export type GeoJsonLineString = {
  coordinates: GeoJsonLineStringValue;
  type: 'LineString';
};
export type Slope = {
  gradient: number;
  position: number;
};
export type GeoJsonPoint = {
  coordinates: GeoJsonPointValue;
  type: 'Point';
};
export type TrackLocation = {
  /** The offset on the track section in meters */
  offset: number;
  track_section: string;
};
export type PathWaypoint = {
  ch: string | null;
  duration: number;
  geo: GeoJsonPoint;
  id: string | null;
  location: TrackLocation;
  name: string | null;
  path_offset: number;
  sch: GeoJsonPoint;
  suggestion: boolean;
  uic: number | null;
};
export type PathResponse = {
  created: string;
  curves: Curve[];
  geographic: GeoJsonLineString;
  id: number;
  length: number;
  owner: string;
  schematic: GeoJsonLineString;
  slopes: Slope[];
  steps: PathWaypoint[];
};
export type WaypointLocation =
  | {
      /** Offset in meters from the start of the waypoint's track section */
      offset: number;
    }
  | {
      /** A geographic coordinate (lon, lat)/WGS84 that will be projected onto the waypoint's track section */
      geo_coordinate: (number & number)[];
    };
export type Waypoint = WaypointLocation & {
  /** A track section UUID */
  track_section: string;
};
export type PathfindingStep = {
  duration: number;
  waypoints: Waypoint[];
};
export type PathfindingRequest = {
  infra: number;
  rolling_stocks?: number[];
  steps: PathfindingStep[];
};
export type RangedValue = {
  begin: number;
  end: number;
  value: string;
};
export type ProfilesOnPathResponse = {
  electrical_profile_ranges: RangedValue[];
  warnings: InternalError[];
};
export type ElectrificationsOnPathResponse = {
  electrification_ranges: RangedValue[];
  warnings: InternalError[];
};
export type Tags = string[];
export type Project = {
  budget?: number | null;
  creation_date: string;
  description: string;
  funders: string;
  id: number;
  image?: number | null;
  last_modification: string;
  name: string;
  objectives: string;
  tags: Tags;
};
export type ProjectWithStudies = Project & {
  studies_count: number;
};
export type PaginatedResponseOfProjectWithStudies = {
  /** The total number of items */
  count: number;
  /** The next page number */
  next: number | null;
  /** The previous page number */
  previous: number | null;
  /** The list of results */
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
  budget?: number | null;
  description?: string;
  funders?: string;
  /** The id of the image document */
  image?: number | null;
  name: string;
  objectives?: string;
  tags?: Tags;
};
export type ProjectPatchForm = {
  budget?: number | null;
  description?: string | null;
  funders?: string | null;
  /** The id of the image document */
  image?: number | null;
  name?: string | null;
  objectives?: string | null;
  tags?: Tags | null;
};
export type Study = {
  actual_end_date?: string | null;
  budget?: number | null;
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
  tags: Tags;
};
export type StudyWithScenarios = Study & {
  scenarios_count: number;
};
export type PaginatedResponseOfStudyWithScenarios = {
  /** The total number of items */
  count: number;
  /** The next page number */
  next: number | null;
  /** The previous page number */
  previous: number | null;
  /** The list of results */
  results: StudyWithScenarios[];
};
export type StudyResponse = Study & {
  project: Project;
  scenarios_count: number;
};
export type StudyCreateForm = {
  actual_end_date?: string | null;
  budget?: number | null;
  business_code?: string;
  description?: string;
  expected_end_date?: string | null;
  name: string;
  service_code?: string;
  start_date?: string | null;
  state: string;
  study_type?: string;
  tags?: Tags;
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
  tags?: Tags | null;
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
  /** The total number of items */
  count: number;
  /** The next page number */
  next: number | null;
  /** The previous page number */
  previous: number | null;
  /** The list of results */
  results: ScenarioWithCountTrains[];
};
export type LightTrainSchedule = {
  departure_time: number;
  id: number;
  train_name: string;
  train_path: number;
};
export type ScenarioResponse = Scenario & {
  electrical_profile_set_name?: string | null;
  infra_name: string;
  project: Project;
  study: Study;
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
  comfort: RollingStockComfortType | null;
  electrical_profile_level: string | null;
  power_restriction_code: string | null;
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
  base_power_class: string | null;
  comfort_acceleration: number;
  effort_curves: EffortCurves;
  /** The time the train takes before actually using electrical power (in seconds). Is null if the train is not electric. */
  electrical_power_startup_time?: number | null;
  energy_sources?: EnergySource[];
  gamma: Gamma;
  inertia_coefficient: number;
  length: number;
  loading_gauge: LoadingGaugeType;
  mass: number;
  max_speed: number;
  name: string;
  /** Mapping of power restriction code to power class */
  power_restrictions: {
    [key: string]: string;
  };
  /** The time it takes to raise this train's pantograph in seconds. Is null if the train is not electric. */
  raise_pantograph_time?: number | null;
  rolling_resistance: RollingResistance;
  startup_acceleration: number;
  startup_time: number;
  supported_signaling_systems: RollingStockSupportedSignalingSystems;
};
export type RollingStock = RollingStockCommon & {
  id: number;
  /** Whether the rolling stock can be edited/deleted or not. */
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
  /** New locked value */
  locked: boolean;
};
export type SearchResultItemTrack = {
  infra_id: number;
  line_code: number;
  line_name: string;
};
export type SearchResultItemOperationalPoint = {
  ch: string;
  ci: number;
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
  /** Whether to return the SQL query instead of executing it */
  dry?: boolean;
  /** The object kind to query - run `editoast search list` to get all possible values */
  object: string;
  query: SearchQuery;
};
export type ResultPosition = {
  offset: number;
  path_offset: number;
  time: number;
  track_section: string;
};
export type RoutingZoneRequirement = {
  end_time: number;
  entry_detector: string;
  exit_detector: string;
  switches: {
    [key: string]: string;
  };
  zone: string;
};
export type RoutingRequirement = {
  begin_time: number;
  route: string;
  zones: RoutingZoneRequirement[];
};
export type SignalSighting = {
  offset: number;
  signal: string;
  state: string;
  time: number;
};
export type SpacingRequirement = {
  begin_time: number;
  end_time: number;
  zone: string;
};
export type ResultSpeed = {
  position: number;
  speed: number;
  time: number;
};
export type ResultStops = {
  ch: string | null;
  duration: number;
  position: number;
  time: number;
};
export type ZoneUpdate = {
  isEntry: boolean;
  offset: number;
  time: number;
  zone: string;
};
export type ResultTrain = {
  head_positions: ResultPosition[];
  mechanical_energy_consumed: number;
  routing_requirements: RoutingRequirement[];
  signal_sightings: SignalSighting[];
  spacing_requirements: SpacingRequirement[];
  speeds: ResultSpeed[];
  stops: ResultStops[];
  zone_updates: ZoneUpdate[];
};
export type ElectrificationUsage =
  | {
      mode: string;
      mode_handled: boolean;
      object_type: 'Electrified';
      profile?: string | null;
      profile_handled: boolean;
    }
  | {
      lower_pantograph: boolean;
      object_type: 'Neutral';
    }
  | {
      object_type: 'NonElectrified';
    };
export type ElectrificationRange = {
  electrificationUsage: ElectrificationUsage;
  start: number;
  stop: number;
};
export type SimulationPowerRestrictionRange = {
  code: string;
  handled: boolean;
  start: number;
  stop: number;
};
export type MrspPoint = {
  /** Relative position of the point on its track section (in meters) */
  position: number;
  /** Speed limit at this point (in m/s) */
  speed: number;
};
export type Mrsp = MrspPoint[];
export type SingleSimulationResponse = {
  base_simulation: ResultTrain;
  eco_simulation?: ResultTrain | null;
  electrification_ranges: ElectrificationRange[];
  power_restriction_ranges: SimulationPowerRestrictionRange[];
  speed_limits: Mrsp;
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
export type TrainScheduleOptions = {
  /** Whether to ignore the electrical profile of the train for simulation */
  ignore_electrical_profiles?: boolean | null;
};
export type RjsPowerRestrictionRange = {
  /** Offset from the start of the path, in meters. */
  begin_position: number;
  /** Offset from the start of the path, in meters. */
  end_position: number;
  /** The power restriction code to apply. */
  power_restriction_code: string;
};
export type ScheduledPoint = {
  /** Offset in meters from the start of the path at which the train must be */
  path_offset: number;
  /** Time in seconds (elapsed since the train's departure) at which the train must be */
  time: number;
};
export type TrainStop = {
  duration: number;
  location: TrackLocation | null;
  position: number | null;
};
export type SingleSimulationRequest = {
  allowances?: Allowance[];
  comfort?: RollingStockComfortType;
  initial_speed?: number;
  options?: TrainScheduleOptions | null;
  power_restriction_ranges?: RjsPowerRestrictionRange[] | null;
  scheduled_points?: ScheduledPoint[];
  stops?: TrainStop[];
  tag?: string | null;
} & {
  electrical_profile_set_id?: number | null;
  path_id: number;
  rolling_stock_id: number;
};
export type RoutePath = {
  route: string;
  signaling_type: string;
  track_sections: DirectionalTrackRange[];
};
export type PathfindingPayload = {
  path_waypoints: PathWaypoint[];
  route_paths: RoutePath[];
};
export type GetCurvePoint = {
  position: number;
  time: number;
};
export type SignalUpdate = {
  /** The labels of the new aspect */
  aspect_label: string;
  /** Whether the signal is blinking */
  blinking: boolean;
  /** The color of the aspect
    
    (Bits 24-31 are alpha, 16-23 are red, 8-15 are green, 0-7 are blue) */
  color: number;
  /** The route ends at this position on the train path */
  position_end: number | null;
  /** The route starts at this position on the train path */
  position_start: number;
  /** The id of the updated signal */
  signal_id: string;
  /** The aspects stop being displayed at this time (number of seconds since 1970-01-01T00:00:00) */
  time_end: number | null;
  /** The aspects start being displayed at this time (number of seconds since 1970-01-01T00:00:00) */
  time_start: number;
  track: string;
  track_offset: number | null;
};
export type FullResultStops = ResultStops & {
  /** The id of the operational point, null if not applicable */
  id: string | null;
  line_code: number | null;
  line_name: string | null;
  /** The name of the operational point, null if not applicable */
  name: string | null;
  track_name: string | null;
  track_number: number | null;
};
export type ReportTrain = {
  head_positions: GetCurvePoint[][];
  mechanical_energy_consumed: number;
  route_aspects: SignalUpdate[];
  speeds: ResultSpeed[];
  stops: FullResultStops[];
  tail_positions: GetCurvePoint[][];
};
export type SimulationReport = {
  base: ReportTrain;
  curves: Curve[];
  eco?: ReportTrain | null;
  /** A list of ranges which should be contiguous and which describe the
    electrification on the path and if it is handled by the train */
  electrification_ranges: ElectrificationRange[];
  id: number;
  labels: string[];
  name: string;
  /** The id of the path used for projection */
  path: number;
  /** The list of ranges where power restrictions are applied */
  power_restriction_ranges: SimulationPowerRestrictionRange[];
  slopes: Slope[];
  speed_limit_tags: string | null;
  vmax: Mrsp;
};
export type Timetable = {
  id: number;
  name: string;
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
  power_restriction_ranges: RjsPowerRestrictionRange[] | null;
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
export type TimetableImportError =
  | {
      RollingStockNotFound: {
        name: string;
      };
    }
  | {
      OperationalPointNotFound: {
        missing_ids: string[];
        missing_uics: number[];
      };
    }
  | {
      PathfindingError: {
        cause: InternalError;
      };
    }
  | {
      SimulationError: {
        cause: InternalError;
      };
    };
export type ImportTimings = {
  pathfinding?: number | null;
  simulation?: number | null;
};
export type TrainImportReport = {
  error?: TimetableImportError | null;
  timings: ImportTimings;
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
    }
  | {
      id: string;
      type: 'operational_point_id';
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
  pathfinding_timeout?: number | null;
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
  power_restriction_ranges?: RjsPowerRestrictionRange[] | null;
  rolling_stock_id?: number | null;
  scheduled_points?: ScheduledPoint[] | null;
  speed_limit_tags?: string | null;
  train_name?: string | null;
};
export type TrainSimulationResponse = {
  /** Requested trains that are invalid and thus not simulated */
  invalid_trains: number[];
  /** The simulation results */
  simulations: SimulationReport[];
};
export type TrainScheduleBatchItem = {
  allowances?: Allowance[];
  comfort?: RollingStockComfortType;
  departure_time: number;
  initial_speed: number;
  labels?: string[];
  options?: TrainScheduleOptions | null;
  power_restriction_ranges?: RjsPowerRestrictionRange[] | null;
  rolling_stock_id: number;
  scheduled_points?: ScheduledPoint[];
  speed_limit_tags?: string | null;
  train_name: string;
};
export type OperationalPointExtensions = {
  identifier?: {
    name: string;
    uic: number;
  } | null;
  sncf?: {
    ch: string;
    ch_long_label: string;
    ch_short_label: string;
    ci: number;
    trigram: string;
  } | null;
};
export type OperationalPointPart = {
  extensions?: {
    sncf?: {
      kp: string;
    } | null;
  };
  position: number;
  track: string;
};
export type PathProperties = {
  electrifications?: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: string[];
  } | null;
  geometry?: GeoJsonLineString | null;
  gradients?: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: number[];
  } | null;
  /** Operational points along the path */
  operational_points?:
    | {
        extensions?: OperationalPointExtensions;
        id: string;
        part: OperationalPointPart;
        /** Distance from the beginning of the path in mm */
        position: number;
      }[]
    | null;
  slopes?: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: number[];
  } | null;
};
export type PathPropertiesInput = {
  /** List of supported electrification modes.
    Empty if does not support any electrification */
  rolling_stock_supported_electrification?: string[];
  /** list of track sections */
  track_ranges: TrackRange[];
};
export type TrackOffset = {
  offset: number;
  track: string;
};
export type PathfindingResult =
  | {
      /** Path description as block ids */
      blocks: string[];
      /** Length of the path in mm */
      length: number;
      /** The path offset in mm of each path item given as input of the pathfinding
    The first value is always `0` (beginning of the path) and the last one is always equal to the `length` of the path in mm */
      path_items_positions: number[];
      /** Path description as route ids */
      routes: string[];
      status: 'success';
      /** Path description as track ranges */
      track_section_ranges: TrackRange[];
    }
  | {
      length: number;
      status: 'not_found_in_blocks';
      track_section_ranges: TrackRange[];
    }
  | {
      length: number;
      status: 'not_found_in_routes';
      track_section_ranges: TrackRange[];
    }
  | {
      status: 'not_found_in_tracks';
    }
  | {
      blocks: string[];
      incompatible_ranges: (number & number)[][];
      length: number;
      routes: string[];
      status: 'incompatible_electrification';
      track_section_ranges: TrackRange[];
    }
  | {
      blocks: string[];
      incompatible_ranges: (number & number)[][];
      length: number;
      routes: string[];
      status: 'incompatible_loading_gauge';
      track_section_ranges: TrackRange[];
    }
  | {
      blocks: string[];
      incompatible_ranges: (number & number)[][];
      length: number;
      routes: string[];
      status: 'incompatible_signaling_system';
      track_section_ranges: TrackRange[];
    }
  | {
      index: number;
      /** The location of a path waypoint */
      path_item:
        | TrackOffset
        | {
            operational_point: string;
          }
        | {
            /** An optional secondary code to identify a more specific location */
            secondary_code?: string | null;
            trigram: string;
          }
        | {
            /** An optional secondary code to identify a more specific location */
            secondary_code?: string | null;
            /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
            uic: number;
          };
      status: 'invalid_path_item';
    }
  | {
      status: 'not_enough_path_items';
    }
  | {
      rolling_stock_name: string;
      status: 'rolling_stock_not_found';
    };
export type PathfindingInputV2 = {
  /** List of waypoints given to the pathfinding */
  path_items: (
    | TrackOffset
    | {
        operational_point: string;
      }
    | {
        /** An optional secondary code to identify a more specific location */
        secondary_code?: string | null;
        trigram: string;
      }
    | {
        /** An optional secondary code to identify a more specific location */
        secondary_code?: string | null;
        /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
        uic: number;
      }
  )[];
  /** Can the rolling stock run on non-electrified tracks */
  rolling_stock_is_thermal: boolean;
  rolling_stock_loading_gauge: LoadingGaugeType;
  /** List of supported electrification modes.
    Empty if does not support any electrification */
  rolling_stock_supported_electrification: string[];
  /** List of supported signaling systems */
  rolling_stock_supported_signaling_systems: string[];
};
export type ScenarioV2 = {
  creation_date: string;
  description: string;
  id: number;
  infra_id: number;
  last_modification: string;
  name: string;
  study_id: number;
  tags: Tags;
  timetable_id: number;
};
export type ScenarioWithDetailsV2 = ScenarioV2 & {
  infra_name: string;
  trains_count: number;
};
export type PaginatedResponseOfScenarioWithDetails = {
  /** The total number of items */
  count: number;
  /** The next page number */
  next: number | null;
  /** The previous page number */
  previous: number | null;
  /** The list of results */
  results: ScenarioWithDetailsV2[];
};
export type ScenarioResponseV2 = ScenarioV2 & {
  infra_name: string;
  project: Project;
  study: Study;
  trains_count: number;
};
export type ScenarioCreateFormV2 = {
  description?: string;
  infra_id: number;
  name: string;
  tags?: Tags;
  timetable_id: number;
};
export type ScenarioPatchFormV2 = {
  description?: string | null;
  infra_id?: number | null;
  name?: string | null;
  tags?: Tags | null;
};
export type TimetableResult = {
  electrical_profile_set_id?: number | null;
  id: number;
};
export type PaginatedResponseOfTimetable = {
  /** The total number of items */
  count: number;
  /** The next page number */
  next: number | null;
  /** The previous page number */
  previous: number | null;
  /** The list of results */
  results: TimetableResult[];
};
export type TimetableForm = {
  electrical_profile_set_id?: number | null;
};
export type TimetableDetailedResult = {
  electrical_profile_set_id?: number | null;
  id: number;
} & {
  train_ids: number[];
};
export type ConflictV2 = {
  conflict_type: ConflictType;
  end_time: string;
  start_time: string;
  train_ids: number[];
  train_names: string[];
};
export type Distribution = 'STANDARD' | 'MARECO';
export type TrainScheduleBase = {
  comfort: 'STANDARD' | 'AIR_CONDITIONING' | 'HEATING';
  constraint_distribution: Distribution;
  initial_speed: number;
  labels: string[];
  margins: {
    boundaries: string[];
    /** The values of the margins. Must contains one more element than the boundaries
        Can be a percentage `X%`, a time in minutes per kilometer `Xmin/km` or `0` */
    values: string[];
  };
  options: {
    use_electrical_profiles: boolean;
  };
  path: ((
    | TrackOffset
    | {
        operational_point: string;
      }
    | {
        /** An optional secondary code to identify a more specific location */
        secondary_code?: string | null;
        trigram: string;
      }
    | {
        /** An optional secondary code to identify a more specific location */
        secondary_code?: string | null;
        /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
        uic: number;
      }
  ) & {
    /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
    deleted?: boolean;
    id: string;
  })[];
  power_restrictions: {
    from: string;
    to: string;
    value: string;
  }[];
  rolling_stock_name: string;
  schedule: {
    arrival?: string | null;
    at: string;
    locked?: boolean;
    stop_for?: string | null;
  }[];
  speed_limit_tag?: string | null;
  start_time: string;
  train_name: string;
};
export type TrainScheduleResult = TrainScheduleBase & {
  id: number;
  timetable_id: number;
};
export type TrainScheduleForm = TrainScheduleBase & {
  timetable_id: number;
};
export type ProjectPathResult = {
  blocks: SignalUpdate[];
  positions: number[];
  times: number[];
};
export type SimulationSummaryResultResponse =
  | {
      Success: {
        energy_consumption: number;
        length: number;
        time: number;
      };
    }
  | 'PathfindingNotFound'
  | 'RunningTimeNotFound';
export type ReportTrainV2 = {
  energy_consumption: number;
  positions: number[];
  speeds: number[];
  times: number[];
};
export type CompleteReportTrain = ReportTrainV2 & {
  routing_requirements: RoutingRequirement[];
  signal_sightings: SignalSighting[];
  spacing_requirements: SpacingRequirement[];
  zone_updates: ZoneUpdate[];
};
export type SimulationResult =
  | {
      base: ReportTrainV2;
      final_output: CompleteReportTrain;
      mrsp: Mrsp;
      power_restriction: string;
      provisional: ReportTrainV2;
      status: 'success';
    }
  | {
      pathfinding_result: PathfindingResult;
      status: 'pathfinding_failed';
    };
export type Version = {
  git_describe: string | null;
};
