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
  'work_schedules',
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
      getDocumentsByDocumentKey: build.query<
        GetDocumentsByDocumentKeyApiResponse,
        GetDocumentsByDocumentKeyApiArg
      >({
        query: (queryArg) => ({ url: `/documents/${queryArg.documentKey}` }),
        providesTags: ['documents'],
      }),
      deleteDocumentsByDocumentKey: build.mutation<
        DeleteDocumentsByDocumentKeyApiResponse,
        DeleteDocumentsByDocumentKeyApiArg
      >({
        query: (queryArg) => ({ url: `/documents/${queryArg.documentKey}`, method: 'DELETE' }),
        invalidatesTags: ['documents'],
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
      getElectricalProfileSetByElectricalProfileSetId: build.query<
        GetElectricalProfileSetByElectricalProfileSetIdApiResponse,
        GetElectricalProfileSetByElectricalProfileSetIdApiArg
      >({
        query: (queryArg) => ({
          url: `/electrical_profile_set/${queryArg.electricalProfileSetId}/`,
        }),
        providesTags: ['electrical_profiles'],
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
        query: () => ({ url: `/health` }),
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
          url: `/infra/railjson`,
          method: 'POST',
          body: queryArg.railJson,
          params: { name: queryArg.name, generate_data: queryArg.generateData },
        }),
        invalidatesTags: ['infra'],
      }),
      postInfraRefresh: build.mutation<PostInfraRefreshApiResponse, PostInfraRefreshApiArg>({
        query: (queryArg) => ({
          url: `/infra/refresh`,
          method: 'POST',
          params: { force: queryArg.force, infras: queryArg.infras },
        }),
        invalidatesTags: ['infra'],
      }),
      getInfraVoltages: build.query<GetInfraVoltagesApiResponse, GetInfraVoltagesApiArg>({
        query: () => ({ url: `/infra/voltages` }),
        providesTags: ['infra', 'rolling_stock'],
      }),
      getInfraByInfraId: build.query<GetInfraByInfraIdApiResponse, GetInfraByInfraIdApiArg>({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/` }),
        providesTags: ['infra'],
      }),
      postInfraByInfraId: build.mutation<PostInfraByInfraIdApiResponse, PostInfraByInfraIdApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra'],
      }),
      putInfraByInfraId: build.mutation<PutInfraByInfraIdApiResponse, PutInfraByInfraIdApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra'],
      }),
      deleteInfraByInfraId: build.mutation<
        DeleteInfraByInfraIdApiResponse,
        DeleteInfraByInfraIdApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/`, method: 'DELETE' }),
        invalidatesTags: ['infra'],
      }),
      getInfraByInfraIdAttachedAndTrackId: build.query<
        GetInfraByInfraIdAttachedAndTrackIdApiResponse,
        GetInfraByInfraIdAttachedAndTrackIdApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/attached/${queryArg.trackId}` }),
        providesTags: ['infra'],
      }),
      getInfraByInfraIdAutoFixes: build.query<
        GetInfraByInfraIdAutoFixesApiResponse,
        GetInfraByInfraIdAutoFixesApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/auto_fixes/` }),
        providesTags: ['infra'],
      }),
      postInfraByInfraIdClone: build.mutation<
        PostInfraByInfraIdCloneApiResponse,
        PostInfraByInfraIdCloneApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/clone`,
          method: 'POST',
          params: { name: queryArg.name },
        }),
        invalidatesTags: ['infra'],
      }),
      getInfraByInfraIdErrors: build.query<
        GetInfraByInfraIdErrorsApiResponse,
        GetInfraByInfraIdErrorsApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/errors`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
            level: queryArg.level,
            error_type: queryArg.errorType,
            object_id: queryArg.objectId,
          },
        }),
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
      postInfraByInfraIdLoad: build.mutation<
        PostInfraByInfraIdLoadApiResponse,
        PostInfraByInfraIdLoadApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/load`, method: 'POST' }),
        invalidatesTags: ['infra'],
      }),
      postInfraByInfraIdLock: build.mutation<
        PostInfraByInfraIdLockApiResponse,
        PostInfraByInfraIdLockApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/lock`, method: 'POST' }),
        invalidatesTags: ['infra'],
      }),
      postInfraByInfraIdObjectsAndObjectType: build.mutation<
        PostInfraByInfraIdObjectsAndObjectTypeApiResponse,
        PostInfraByInfraIdObjectsAndObjectTypeApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/objects/${queryArg.objectType}`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra'],
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
      getInfraByInfraIdRailjson: build.query<
        GetInfraByInfraIdRailjsonApiResponse,
        GetInfraByInfraIdRailjsonApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/railjson` }),
        providesTags: ['infra'],
      }),
      postInfraByInfraIdRoutesNodes: build.mutation<
        PostInfraByInfraIdRoutesNodesApiResponse,
        PostInfraByInfraIdRoutesNodesApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/routes/nodes`,
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
          url: `/infra/${queryArg.infraId}/routes/track_ranges`,
          params: { routes: queryArg.routes },
        }),
        providesTags: ['infra', 'routes'],
      }),
      getInfraByInfraIdRoutesAndWaypointTypeWaypointId: build.query<
        GetInfraByInfraIdRoutesAndWaypointTypeWaypointIdApiResponse,
        GetInfraByInfraIdRoutesAndWaypointTypeWaypointIdApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/routes/${queryArg.waypointType}/${queryArg.waypointId}`,
        }),
        providesTags: ['infra', 'routes'],
      }),
      getInfraByInfraIdSpeedLimitTags: build.query<
        GetInfraByInfraIdSpeedLimitTagsApiResponse,
        GetInfraByInfraIdSpeedLimitTagsApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/speed_limit_tags` }),
        providesTags: ['infra'],
      }),
      postInfraByInfraIdSplitTrackSection: build.mutation<
        PostInfraByInfraIdSplitTrackSectionApiResponse,
        PostInfraByInfraIdSplitTrackSectionApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/split_track_section`,
          method: 'POST',
          body: queryArg.trackOffset,
        }),
        invalidatesTags: ['infra'],
      }),
      getInfraByInfraIdSwitchTypes: build.query<
        GetInfraByInfraIdSwitchTypesApiResponse,
        GetInfraByInfraIdSwitchTypesApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/switch_types` }),
        providesTags: ['infra'],
      }),
      postInfraByInfraIdUnlock: build.mutation<
        PostInfraByInfraIdUnlockApiResponse,
        PostInfraByInfraIdUnlockApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/unlock`, method: 'POST' }),
        invalidatesTags: ['infra'],
      }),
      getInfraByInfraIdVoltages: build.query<
        GetInfraByInfraIdVoltagesApiResponse,
        GetInfraByInfraIdVoltagesApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/voltages`,
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
      getLightRollingStockNameByRollingStockName: build.query<
        GetLightRollingStockNameByRollingStockNameApiResponse,
        GetLightRollingStockNameByRollingStockNameApiArg
      >({
        query: (queryArg) => ({ url: `/light_rolling_stock/name/${queryArg.rollingStockName}/` }),
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
      deletePathfindingByPathfindingId: build.mutation<
        DeletePathfindingByPathfindingIdApiResponse,
        DeletePathfindingByPathfindingIdApiArg
      >({
        query: (queryArg) => ({ url: `/pathfinding/${queryArg.pathfindingId}/`, method: 'DELETE' }),
        invalidatesTags: ['pathfinding'],
      }),
      getPathfindingByPathfindingIdElectricalProfiles: build.query<
        GetPathfindingByPathfindingIdElectricalProfilesApiResponse,
        GetPathfindingByPathfindingIdElectricalProfilesApiArg
      >({
        query: (queryArg) => ({
          url: `/pathfinding/${queryArg.pathfindingId}/electrical_profiles`,
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
        query: (queryArg) => ({ url: `/pathfinding/${queryArg.pathfindingId}/electrifications` }),
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
      getProjectsByProjectId: build.query<
        GetProjectsByProjectIdApiResponse,
        GetProjectsByProjectIdApiArg
      >({
        query: (queryArg) => ({ url: `/projects/${queryArg.projectId}/` }),
        providesTags: ['projects'],
      }),
      deleteProjectsByProjectId: build.mutation<
        DeleteProjectsByProjectIdApiResponse,
        DeleteProjectsByProjectIdApiArg
      >({
        query: (queryArg) => ({ url: `/projects/${queryArg.projectId}/`, method: 'DELETE' }),
        invalidatesTags: ['projects'],
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
      getProjectsByProjectIdStudiesAndStudyId: build.query<
        GetProjectsByProjectIdStudiesAndStudyIdApiResponse,
        GetProjectsByProjectIdStudiesAndStudyIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/`,
        }),
        providesTags: ['studies'],
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
      getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.query<
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
        }),
        providesTags: ['scenarios'],
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
      getRollingStockNameByRollingStockName: build.query<
        GetRollingStockNameByRollingStockNameApiResponse,
        GetRollingStockNameByRollingStockNameApiArg
      >({
        query: (queryArg) => ({ url: `/rolling_stock/name/${queryArg.rollingStockName}/` }),
        providesTags: ['rolling_stock'],
      }),
      getRollingStockPowerRestrictions: build.query<
        GetRollingStockPowerRestrictionsApiResponse,
        GetRollingStockPowerRestrictionsApiArg
      >({
        query: () => ({ url: `/rolling_stock/power_restrictions/` }),
        providesTags: ['rolling_stock'],
      }),
      getRollingStockByRollingStockId: build.query<
        GetRollingStockByRollingStockIdApiResponse,
        GetRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({ url: `/rolling_stock/${queryArg.rollingStockId}/` }),
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
          url: `/search`,
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
        query: () => ({ url: `/sprites/signaling_systems` }),
        providesTags: ['sprites'],
      }),
      getSpritesBySignalingSystemAndFileName: build.query<
        GetSpritesBySignalingSystemAndFileNameApiResponse,
        GetSpritesBySignalingSystemAndFileNameApiArg
      >({
        query: (queryArg) => ({ url: `/sprites/${queryArg.signalingSystem}/${queryArg.fileName}` }),
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
        query: (queryArg) => ({ url: `/timetable/${queryArg.id}/conflicts` }),
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
          url: `/train_schedule/results`,
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
          url: `/train_schedule/standalone_simulation`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['train_schedule'],
      }),
      getTrainScheduleById: build.query<
        GetTrainScheduleByIdApiResponse,
        GetTrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({ url: `/train_schedule/${queryArg.id}/` }),
        providesTags: ['train_schedule'],
      }),
      deleteTrainScheduleById: build.mutation<
        DeleteTrainScheduleByIdApiResponse,
        DeleteTrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({ url: `/train_schedule/${queryArg.id}/`, method: 'DELETE' }),
        invalidatesTags: ['train_schedule', 'timetable'],
      }),
      getTrainScheduleByIdResult: build.query<
        GetTrainScheduleByIdResultApiResponse,
        GetTrainScheduleByIdResultApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/${queryArg.id}/result`,
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
          params: { props: queryArg.props },
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
      getV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.query<
        GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
        }),
        providesTags: ['scenariosv2'],
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
      deleteV2TimetableById: build.mutation<
        DeleteV2TimetableByIdApiResponse,
        DeleteV2TimetableByIdApiArg
      >({
        query: (queryArg) => ({ url: `/v2/timetable/${queryArg.id}/`, method: 'DELETE' }),
        invalidatesTags: ['timetablev2'],
      }),
      getV2TimetableByIdConflicts: build.query<
        GetV2TimetableByIdConflictsApiResponse,
        GetV2TimetableByIdConflictsApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/timetable/${queryArg.id}/conflicts`,
          params: { infra_id: queryArg.infraId },
        }),
        providesTags: ['timetablev2'],
      }),
      postV2TimetableByIdStdcm: build.mutation<
        PostV2TimetableByIdStdcmApiResponse,
        PostV2TimetableByIdStdcmApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/timetable/${queryArg.id}/stdcm/`,
          method: 'POST',
          body: queryArg.body,
          params: { infra: queryArg.infra },
        }),
        invalidatesTags: ['stdcm'],
      }),
      postV2TimetableByIdTrainSchedule: build.mutation<
        PostV2TimetableByIdTrainScheduleApiResponse,
        PostV2TimetableByIdTrainScheduleApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/timetable/${queryArg.id}/train_schedule`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['timetablev2', 'train_schedulev2'],
      }),
      postV2TrainSchedule: build.query<PostV2TrainScheduleApiResponse, PostV2TrainScheduleApiArg>({
        query: (queryArg) => ({ url: `/v2/train_schedule/`, method: 'POST', body: queryArg.body }),
        providesTags: ['train_schedulev2'],
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
        invalidatesTags: ['timetablev2', 'train_schedulev2'],
      }),
      postV2TrainScheduleProjectPath: build.query<
        PostV2TrainScheduleProjectPathApiResponse,
        PostV2TrainScheduleProjectPathApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/train_schedule/project_path`,
          method: 'POST',
          body: queryArg.projectPathForm,
        }),
        providesTags: ['train_schedulev2'],
      }),
      postV2TrainScheduleSimulationSummary: build.query<
        PostV2TrainScheduleSimulationSummaryApiResponse,
        PostV2TrainScheduleSimulationSummaryApiArg
      >({
        query: (queryArg) => ({
          url: `/v2/train_schedule/simulation_summary`,
          method: 'POST',
          body: queryArg.body,
        }),
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
        invalidatesTags: ['train_schedulev2', 'timetablev2'],
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
          url: `/v2/train_schedule/${queryArg.id}/simulation`,
          params: { infra_id: queryArg.infraId },
        }),
        providesTags: ['train_schedulev2'],
      }),
      getVersion: build.query<GetVersionApiResponse, GetVersionApiArg>({
        query: () => ({ url: `/version` }),
      }),
      getVersionCore: build.query<GetVersionCoreApiResponse, GetVersionCoreApiArg>({
        query: () => ({ url: `/version/core` }),
      }),
      postWorkSchedules: build.mutation<PostWorkSchedulesApiResponse, PostWorkSchedulesApiArg>({
        query: (queryArg) => ({
          url: `/work_schedules/`,
          method: 'POST',
          body: queryArg.workScheduleCreateForm,
        }),
        invalidatesTags: ['work_schedules'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedEditoastApi };
export type PostDocumentsApiResponse =
  /** status 201 The document was created */ NewDocumentResponse;
export type PostDocumentsApiArg = {
  /** The document's content type */
  contentType: string;
  body: Blob;
};
export type GetDocumentsByDocumentKeyApiResponse =
  /** status 200 The document's binary content */ Blob;
export type GetDocumentsByDocumentKeyApiArg = {
  /** The document's key */
  documentKey: number;
};
export type DeleteDocumentsByDocumentKeyApiResponse =
  /** status 204 The document was deleted */ void;
export type DeleteDocumentsByDocumentKeyApiArg = {
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
export type GetElectricalProfileSetByElectricalProfileSetIdApiResponse =
  /** status 200 The list of electrical profiles in the set */ ElectricalProfileSetData;
export type GetElectricalProfileSetByElectricalProfileSetIdApiArg = {
  electricalProfileSetId: number;
};
export type DeleteElectricalProfileSetByElectricalProfileSetIdApiResponse =
  /** status 204 The electrical profile was deleted successfully */ void;
export type DeleteElectricalProfileSetByElectricalProfileSetIdApiArg = {
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
export type GetInfraApiResponse = /** status 200 All infras, paginated */ PaginationStats & {
  results: InfraWithState[];
};
export type GetInfraApiArg = {
  page?: number;
  pageSize?: number | null;
};
export type PostInfraApiResponse = /** status 201 The created infra */ Infra;
export type PostInfraApiArg = {
  body: {
    /** The name to give to the new infra */
    name: string;
  };
};
export type PostInfraRailjsonApiResponse = /** status 201 The imported infra id */ {
  infra: number;
};
export type PostInfraRailjsonApiArg = {
  /** The name of the infrastructure. */
  name: string;
  /** Flag indicating whether to generate data. */
  generateData?: boolean;
  railJson: RailJson;
};
export type PostInfraRefreshApiResponse = /** status 200  */ {
  /** The list of infras that were refreshed successfully */
  infra_refreshed: number[];
};
export type PostInfraRefreshApiArg = {
  force?: boolean;
  /** A comma-separated list of infra IDs to refresh
    
    If not provided, all available infras will be refreshed. */
  infras?: number[];
};
export type GetInfraVoltagesApiResponse = /** status 200 Voltages list */ string[];
export type GetInfraVoltagesApiArg = void;
export type GetInfraByInfraIdApiResponse = /** status 200 The infra */ InfraWithState;
export type GetInfraByInfraIdApiArg = {
  /** An existing infra ID */
  infraId: number;
};
export type PostInfraByInfraIdApiResponse =
  /** status 200 The result of the operations */ InfraObject[];
export type PostInfraByInfraIdApiArg = {
  /** An existing infra ID */
  infraId: number;
  body: Operation[];
};
export type PutInfraByInfraIdApiResponse = /** status 200 The infra has been renamed */ Infra;
export type PutInfraByInfraIdApiArg = {
  /** An existing infra ID */
  infraId: number;
  body: {
    /** The new name to give the infra */
    name: string;
  };
};
export type DeleteInfraByInfraIdApiResponse = unknown;
export type DeleteInfraByInfraIdApiArg = {
  /** An existing infra ID */
  infraId: number;
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
  /** An existing infra ID */
  infraId: number;
};
export type PostInfraByInfraIdCloneApiResponse = unknown;
export type PostInfraByInfraIdCloneApiArg = {
  /** An existing infra ID */
  infraId: number;
  /** The name of the new infra */
  name: string;
};
export type GetInfraByInfraIdErrorsApiResponse =
  /** status 200 A paginated list of errors */ PaginationStats & {
    results: {
      information: InfraError;
    }[];
  };
export type GetInfraByInfraIdErrorsApiArg = {
  /** An existing infra ID */
  infraId: number;
  page?: number;
  pageSize?: number | null;
  /** Whether the response should include errors or warnings */
  level?: 'warnings' | 'errors' | 'all';
  /** The type of error to filter on */
  errorType?: InfraErrorTypeLabel | null;
  /** Filter errors and warnings related to a given object */
  objectId?: string | null;
};
export type GetInfraByInfraIdLinesAndLineCodeBboxApiResponse =
  /** status 200 The BBox of the line */ BoundingBox;
export type GetInfraByInfraIdLinesAndLineCodeBboxApiArg = {
  /** An existing infra ID */
  infraId: number;
  /** A line code */
  lineCode: number;
};
export type PostInfraByInfraIdLoadApiResponse = unknown;
export type PostInfraByInfraIdLoadApiArg = {
  /** An existing infra ID */
  infraId: number;
};
export type PostInfraByInfraIdLockApiResponse = unknown;
export type PostInfraByInfraIdLockApiArg = {
  /** An existing infra ID */
  infraId: number;
};
export type PostInfraByInfraIdObjectsAndObjectTypeApiResponse =
  /** status 200 The list of objects */ InfraObjectWithGeometry[];
export type PostInfraByInfraIdObjectsAndObjectTypeApiArg = {
  /** An existing infra ID */
  infraId: number;
  objectType: ObjectType;
  body: string[];
};
export type PostInfraByInfraIdPathfindingApiResponse =
  /** status 200 A list of shortest paths between starting and ending track locations */ PathfindingOutput[];
export type PostInfraByInfraIdPathfindingApiArg = {
  /** An existing infra ID */
  infraId: number;
  number?: number | null;
  pathfindingInput: PathfindingInput;
};
export type GetInfraByInfraIdRailjsonApiResponse =
  /** status 200 The infra in railjson format */ RailJson;
export type GetInfraByInfraIdRailjsonApiArg = {
  /** An existing infra ID */
  infraId: number;
};
export type PostInfraByInfraIdRoutesNodesApiResponse =
  /** status 200 A list of route IDs along with available positions for each specified node */ {
    /** List of available positions for each node on the corresponding routes */
    available_node_positions: {
      [key: string]: string[];
    };
    /** List of route ids crossing a selection of nodes */
    routes: string[];
  };
export type PostInfraByInfraIdRoutesNodesApiArg = {
  /** An existing infra ID */
  infraId: number;
  /** A mapping node_id -> node_state | null */
  body: {
    [key: string]: string | null;
  };
};
export type GetInfraByInfraIdRoutesTrackRangesApiResponse =
  /** status 200 Foreach route, either tracks_ranges + switches found on the route, or an error */ (
    | (RoutePath & {
        type: 'Computed';
      })
    | {
        type: 'NotFound';
      }
    | {
        type: 'CantComputePath';
      }
  )[];
export type GetInfraByInfraIdRoutesTrackRangesApiArg = {
  /** An existing infra ID */
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
export type GetInfraByInfraIdSpeedLimitTagsApiResponse =
  /** status 200 List all speed limit tags */ string[];
export type GetInfraByInfraIdSpeedLimitTagsApiArg = {
  /** An existing infra ID */
  infraId: number;
};
export type PostInfraByInfraIdSplitTrackSectionApiResponse =
  /** status 200 ID of the trackSections created */ string[];
export type PostInfraByInfraIdSplitTrackSectionApiArg = {
  /** An existing infra ID */
  infraId: number;
  trackOffset: TrackOffset;
};
export type GetInfraByInfraIdSwitchTypesApiResponse =
  /** status 200 A list of switch types */ SwitchType[];
export type GetInfraByInfraIdSwitchTypesApiArg = {
  /** An existing infra ID */
  infraId: number;
};
export type PostInfraByInfraIdUnlockApiResponse = unknown;
export type PostInfraByInfraIdUnlockApiArg = {
  /** An existing infra ID */
  infraId: number;
};
export type GetInfraByInfraIdVoltagesApiResponse = /** status 200 Voltages list */ string[];
export type GetInfraByInfraIdVoltagesApiArg = {
  /** An existing infra ID */
  infraId: number;
  includeRollingStockModes?: boolean;
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
export type GetLightRollingStockNameByRollingStockNameApiResponse =
  /** status 200 The rolling stock with their simplified effort curves */ LightRollingStockWithLiveries;
export type GetLightRollingStockNameByRollingStockNameApiArg = {
  rollingStockName: string;
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
export type DeletePathfindingByPathfindingIdApiResponse = unknown;
export type DeletePathfindingByPathfindingIdApiArg = {
  /** A stored path ID */
  pathfindingId: number;
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
export type GetProjectsApiResponse = /** status 200 The list of projects */ PaginationStats & {
  results: ProjectWithStudies[];
};
export type GetProjectsApiArg = {
  page?: number;
  pageSize?: number | null;
  ordering?: Ordering;
};
export type PostProjectsApiResponse = /** status 201 The created project */ ProjectWithStudies;
export type PostProjectsApiArg = {
  projectCreateForm: ProjectCreateForm;
};
export type GetProjectsByProjectIdApiResponse =
  /** status 200 The requested project */ ProjectWithStudies;
export type GetProjectsByProjectIdApiArg = {
  /** The id of a project */
  projectId: number;
};
export type DeleteProjectsByProjectIdApiResponse =
  /** status 204 The project was deleted successfully */ void;
export type DeleteProjectsByProjectIdApiArg = {
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
  /** status 200 The list of studies */ PaginationStats & {
    results: StudyWithScenarios[];
  };
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
export type GetProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 200 The requested study */ StudyResponse;
export type GetProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 204 The study was deleted successfully */ void;
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiArg = {
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
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The requested scenario */ ScenarioResponse;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 204 The scenario was deleted successfully */ void;
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
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
export type GetRollingStockNameByRollingStockNameApiResponse =
  /** status 200 The requested rolling stock */ RollingStockWithLiveries;
export type GetRollingStockNameByRollingStockNameApiArg = {
  rollingStockName: string;
};
export type GetRollingStockPowerRestrictionsApiResponse =
  /** status 200 Retrieve the power restrictions list */ string[];
export type GetRollingStockPowerRestrictionsApiArg = void;
export type GetRollingStockByRollingStockIdApiResponse =
  /** status 200 The requested rolling stock */ RollingStockWithLiveries;
export type GetRollingStockByRollingStockIdApiArg = {
  rollingStockId: number;
};
export type DeleteRollingStockByRollingStockIdApiResponse =
  /** status 204 The rolling stock was deleted successfully */ void;
export type DeleteRollingStockByRollingStockIdApiArg = {
  rollingStockId: number;
  /** force the deletion even if it’s used */
  force?: boolean;
};
export type PatchRollingStockByRollingStockIdApiResponse =
  /** status 200 The created rolling stock */ RollingStockWithLiveries;
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
export type GetTrainScheduleByIdApiResponse = /** status 200 The train schedule */ TrainSchedule;
export type GetTrainScheduleByIdApiArg = {
  /** A train schedule ID */
  id: number;
};
export type DeleteTrainScheduleByIdApiResponse = unknown;
export type DeleteTrainScheduleByIdApiArg = {
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
  /** Path properties */
  props: Property[];
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
  /** status 200 A paginated list of scenarios */ PaginationStats & {
    results: ScenarioWithDetails[];
  };
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
export type GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The requested scenario */ ScenarioResponseV2;
export type GetV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
};
export type DeleteV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 204 The scenario was deleted successfully */ void;
export type DeleteV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
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
export type GetV2TimetableApiResponse = /** status 200 List timetables */ PaginationStats & {
  results: TimetableResult[];
};
export type GetV2TimetableApiArg = {
  page?: number;
  pageSize?: number | null;
};
export type PostV2TimetableApiResponse =
  /** status 200 Timetable with train schedules ids */ TimetableResult;
export type PostV2TimetableApiArg = {
  timetableForm: TimetableForm;
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
export type DeleteV2TimetableByIdApiResponse = unknown;
export type DeleteV2TimetableByIdApiArg = {
  /** A timetable ID */
  id: number;
};
export type GetV2TimetableByIdConflictsApiResponse =
  /** status 200 List of conflict */ ConflictV2[];
export type GetV2TimetableByIdConflictsApiArg = {
  /** A timetable ID */
  id: number;
  infraId: number;
};
export type PostV2TimetableByIdStdcmApiResponse = /** status 201 The simulation result */
  | {
      departure_time: string;
      path: PathfindingResultSuccess;
      simulation: SimulationResponse;
      status: 'success';
    }
  | {
      status: 'path_not_found';
    }
  | {
      error: SimulationResponse;
      status: 'preprocessing_simulation_error';
    };
export type PostV2TimetableByIdStdcmApiArg = {
  /** The infra id */
  infra: number;
  /** timetable_id */
  id: number;
  body: {
    comfort: Comfort;
    /** Can be a percentage `X%`, a time in minutes per 100 kilometer `Xmin/100km` */
    margin?: string | null;
    /** By how long we can shift the departure time in milliseconds
        Deprecated, first step data should be used instead */
    maximum_departure_delay?: number;
    /** Specifies how long the total run time can be in milliseconds */
    maximum_run_time?: number | null;
    rolling_stock_id: number;
    /** Train categories for speed limits */
    speed_limit_tags?: string | null;
    /** Deprecated, first step arrival time should be used instead */
    start_time?: string | null;
    steps: PathfindingItem[];
    /** Margin after the train passage in milliseconds
        
        Enforces that the path used by the train should be free and
        available at least that many milliseconds after its passage. */
    time_gap_after?: number;
    /** Margin before the train passage in seconds
        
        Enforces that the path used by the train should be free and
        available at least that many milliseconds before its passage. */
    time_gap_before?: number;
  };
};
export type PostV2TimetableByIdTrainScheduleApiResponse =
  /** status 200 The created train schedules */ TrainScheduleResult[];
export type PostV2TimetableByIdTrainScheduleApiArg = {
  /** A timetable ID */
  id: number;
  body: TrainScheduleBase[];
};
export type PostV2TrainScheduleApiResponse =
  /** status 200 Retrieve a list of train schedule */ TrainScheduleResult[];
export type PostV2TrainScheduleApiArg = {
  body: {
    ids: number[];
  };
};
export type DeleteV2TrainScheduleApiResponse = unknown;
export type DeleteV2TrainScheduleApiArg = {
  body: {
    ids: number[];
  };
};
export type PostV2TrainScheduleProjectPathApiResponse = /** status 200 Project Path Output */ {
  [key: string]: ProjectPathTrainResult;
};
export type PostV2TrainScheduleProjectPathApiArg = {
  projectPathForm: ProjectPathForm;
};
export type PostV2TrainScheduleSimulationSummaryApiResponse =
  /** status 200 Associate each train id with its simulation summary */ {
    [key: string]: SimulationSummaryResult;
  };
export type PostV2TrainScheduleSimulationSummaryApiArg = {
  body: {
    ids: number[];
    infra_id: number;
  };
};
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
  /** status 200 Simulation Output */ SimulationResponse;
export type GetV2TrainScheduleByIdSimulationApiArg = {
  /** A train schedule ID */
  id: number;
  infraId: number;
};
export type GetVersionApiResponse = /** status 200 Return the service version */ Version;
export type GetVersionApiArg = void;
export type GetVersionCoreApiResponse = /** status 200 Return the core service version */ Version;
export type GetVersionCoreApiArg = void;
export type PostWorkSchedulesApiResponse =
  /** status 201 The id of the created work schedule group */ WorkScheduleCreateResponse;
export type PostWorkSchedulesApiArg = {
  workScheduleCreateForm: WorkScheduleCreateForm;
};
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
  /** The beginning of the range in mm. */
  begin: number;
  direction: Direction;
  /** The end of the range in mm. */
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
export type PaginationStats = {
  /** The total number of items */
  count: number;
  /** The current page number */
  current: number;
  /** The next page number, if any */
  next: number | null;
  /** The total number of pages */
  page_count: number;
  /** The number of items per page */
  page_size: number;
  /** The previous page number, if any */
  previous: number | null;
};
export type Infra = {
  created: string;
  generated_version: string | null;
  id: number;
  locked: boolean;
  modified: string;
  name: string;
  railjson_version: string;
  version: string;
};
export type InfraState =
  | 'NOT_LOADED'
  | 'INITIALIZING'
  | 'DOWNLOADING'
  | 'PARSING_JSON'
  | 'PARSING_INFRA'
  | 'LOADING_SIGNALS'
  | 'BUILDING_BLOCKS'
  | 'CACHED'
  | 'TRANSIENT_ERROR'
  | 'ERROR';
export type InfraWithState = Infra & {
  state: InfraState;
};
export type BufferStop = {
  extensions?: {
    sncf?: {
      kp: string;
    } | null;
  };
  id: string;
  position: number;
  track: string;
};
export type Detector = {
  extensions?: {
    sncf: {
      kp: string;
    };
  };
  id: string;
  position: number;
  track: string;
};
export type ApplicableDirections = 'START_TO_STOP' | 'STOP_TO_START' | 'BOTH';
export type ApplicableDirectionsTrackRange = {
  applicable_directions: ApplicableDirections;
  begin: number;
  end: number;
  track: string;
};
export type Electrification = {
  id: string;
  track_ranges: ApplicableDirectionsTrackRange[];
  voltage: string;
};
export type SwitchPortConnection = {
  dst: string;
  src: string;
};
export type SwitchType = {
  groups: {
    [key: string]: SwitchPortConnection[];
  };
  id: string;
  ports: string[];
};
export type DirectionalTrackRange = {
  begin: number;
  direction: Direction;
  end: number;
  track: string;
};
export type Side = 'LEFT' | 'RIGHT' | 'CENTER';
export type Sign = {
  direction: Direction;
  kp: string;
  position: number;
  side: Side;
  track: string;
  type: string;
  value: string;
};
export type NeutralSection = {
  announcement_track_ranges: DirectionalTrackRange[];
  extensions?: {
    neutral_sncf?: {
      announcement: Sign[];
      end: Sign[];
      exe: Sign;
      rev: Sign[];
    } | null;
  };
  id: string;
  lower_pantograph: boolean;
  track_ranges: DirectionalTrackRange[];
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
export type OperationalPoint = {
  extensions?: {
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
  id: string;
  parts: OperationalPointPart[];
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
export type Route = {
  entry_point: Waypoint;
  entry_point_direction: Direction;
  exit_point: Waypoint;
  id: string;
  release_detectors: string[];
  switches_directions: {
    [key: string]: string;
  };
};
export type Signal = {
  direction: Direction;
  extensions?: {
    sncf?: {
      kp: string;
      label: string;
      side?: Side;
    } | null;
  };
  id: string;
  logical_signals?: {
    conditional_parameters: {
      on_route: string;
      parameters: {
        [key: string]: string;
      };
    }[];
    default_parameters: {
      [key: string]: string;
    };
    next_signaling_systems: string[];
    settings: {
      [key: string]: string;
    };
    signaling_system: string;
  }[];
  position: number;
  sight_distance: number;
  track: string;
};
export type SpeedSection = {
  extensions?: {
    psl_sncf?: {
      announcement: Sign[];
      r: Sign[];
      z: Sign;
    } | null;
  };
  id: string;
  on_routes?: string[] | null;
  speed_limit?: number | null;
  speed_limit_by_tag: {
    [key: string]: number;
  };
  track_ranges: ApplicableDirectionsTrackRange[];
};
export type Endpoint = 'BEGIN' | 'END';
export type TrackEndpoint = {
  endpoint: Endpoint;
  track: string;
};
export type Switch = {
  extensions?: {
    sncf?: {
      label: string;
    } | null;
  };
  group_change_delay: number;
  id: string;
  ports: {
    [key: string]: TrackEndpoint;
  };
  switch_type: string;
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
export type LoadingGaugeLimit = {
  begin: number;
  category: LoadingGaugeType;
  end: number;
};
export type Slope = {
  gradient: number;
  position: number;
};
export type TrackSection = {
  curves: Curve[];
  extensions?: {
    sncf?: {
      line_code: number;
      line_name: string;
      track_name: string;
      track_number: number;
    } | null;
    source?: {
      id: string;
      name: string;
    } | null;
  };
  geo: GeoJsonLineString;
  id: string;
  length: number;
  loading_gauge_limits?: LoadingGaugeLimit[];
  slopes: Slope[];
};
export type RailJson = {
  /** `BufferStops` are obstacles designed to prevent trains from sliding off dead ends. */
  buffer_stops: BufferStop[];
  /** `Detector` is a device that identifies the presence of a train in a TVD section (Track Vacancy Detection section), indicating when a track area is occupied. */
  detectors: Detector[];
  /** To allow electric trains to run on our infrastructure, we need to specify which parts of the infrastructure is electrified. */
  electrifications: Electrification[];
  /** These define the types of switches available for route management. */
  extended_switch_types: SwitchType[];
  /** `NeutralSections` are designated areas of rail infrastructure where train drivers are instructed to cut the power supply to the train, primarily for safety reasons. */
  neutral_sections: NeutralSection[];
  /** Operational point is also known in French as "Point Remarquable" (PR). One `OperationalPoint` is a **collection** of points (`OperationalPointParts`) of interest. */
  operational_points: OperationalPoint[];
  /** A `Route` is an itinerary in the infrastructure. A train path is a sequence of routes. Routes are used to reserve section of path with the interlocking. */
  routes: Route[];
  /** `Signals` are devices that visually convey information to train drivers about whether it is safe to proceed, stop, or slow down, based on the interlocking system and the specific signaling rules in place. */
  signals: Signal[];
  /** The `SpeedSections` represent speed limits (in meters per second) that are applied on some parts of the tracks. One `SpeedSection` can span on several track sections, and do not necessarily cover the whole track sections. Speed sections can overlap. */
  speed_sections: SpeedSection[];
  /** `Switches` allow for route control and redirection of trains. */
  switches: Switch[];
  /** `TrackSection`` is a segment of rail between switches that serves as a bidirectional path for trains, and can be defined as the longest possible stretch of track within a rail infrastructure. */
  track_sections: TrackSection[];
  /** The version of the RailJSON format. Defaults to the current version. */
  version: string;
};
export type InfraObject =
  | {
      obj_type: 'TrackSection';
      railjson: TrackSection;
    }
  | {
      obj_type: 'Signal';
      railjson: Signal;
    }
  | {
      obj_type: 'NeutralSection';
      railjson: NeutralSection;
    }
  | {
      obj_type: 'SpeedSection';
      railjson: SpeedSection;
    }
  | {
      obj_type: 'Switch';
      railjson: Switch;
    }
  | {
      obj_type: 'SwitchType';
      railjson: SwitchType;
    }
  | {
      obj_type: 'Detector';
      railjson: Detector;
    }
  | {
      obj_type: 'BufferStop';
      railjson: BufferStop;
    }
  | {
      obj_type: 'Route';
      railjson: Route;
    }
  | {
      obj_type: 'OperationalPoint';
      railjson: OperationalPoint;
    }
  | {
      obj_type: 'Electrification';
      railjson: Electrification;
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
export type AddOperation = {
  /** JSON-Pointer value [RFC6901](https://tools.ietf.org/html/rfc6901) that references a location
    within the target document where the operation is performed. */
  path: string;
  /** Value to add to the target location. */
  value: any;
};
export type RemoveOperation = {
  /** JSON-Pointer value [RFC6901](https://tools.ietf.org/html/rfc6901) that references a location
    within the target document where the operation is performed. */
  path: string;
};
export type ReplaceOperation = {
  /** JSON-Pointer value [RFC6901](https://tools.ietf.org/html/rfc6901) that references a location
    within the target document where the operation is performed. */
  path: string;
  /** Value to replace with. */
  value: any;
};
export type MoveOperation = {
  /** JSON-Pointer value [RFC6901](https://tools.ietf.org/html/rfc6901) that references a location
    to move value from. */
  from: string;
  /** JSON-Pointer value [RFC6901](https://tools.ietf.org/html/rfc6901) that references a location
    within the target document where the operation is performed. */
  path: string;
};
export type CopyOperation = {
  /** JSON-Pointer value [RFC6901](https://tools.ietf.org/html/rfc6901) that references a location
    to copy value from. */
  from: string;
  /** JSON-Pointer value [RFC6901](https://tools.ietf.org/html/rfc6901) that references a location
    within the target document where the operation is performed. */
  path: string;
};
export type TestOperation = {
  /** JSON-Pointer value [RFC6901](https://tools.ietf.org/html/rfc6901) that references a location
    within the target document where the operation is performed. */
  path: string;
  /** Value to test against. */
  value: any;
};
export type PatchOperation =
  | (AddOperation & {
      op: 'add';
    })
  | (RemoveOperation & {
      op: 'remove';
    })
  | (ReplaceOperation & {
      op: 'replace';
    })
  | (MoveOperation & {
      op: 'move';
    })
  | (CopyOperation & {
      op: 'copy';
    })
  | (TestOperation & {
      op: 'test';
    });
export type Operation =
  | (InfraObject & {
      operation_type: 'CREATE';
    })
  | ({
      obj_id: string;
      obj_type: ObjectType;
      /** Representation of JSON Patch (list of patch operations) */
      railjson_patch: PatchOperation[];
    } & {
      operation_type: 'UPDATE';
    })
  | ({
      obj_id: string;
      obj_type: ObjectType;
    } & {
      operation_type: 'DELETE';
    });
export type ObjectRef = {
  obj_id: string;
  type: ObjectType;
};
export type InfraErrorType =
  | {
      error_type: 'duplicated_group';
      original_group_path: string;
    }
  | {
      error_type: 'empty_object';
    }
  | {
      error_type: 'invalid_group';
      group: string;
      switch_type: string;
    }
  | {
      error_type: 'invalid_reference';
      reference: ObjectRef;
    }
  | {
      error_type: 'invalid_route';
    }
  | {
      error_type: 'invalid_switch_ports';
    }
  | {
      error_type: 'missing_route';
    }
  | {
      endpoint: Endpoint;
      error_type: 'missing_buffer_stop';
    }
  | {
      error_type: 'node_endpoints_not_unique';
    }
  | {
      error_type: 'object_out_of_path';
      reference: ObjectRef;
    }
  | {
      error_type: 'odd_buffer_stop_location';
    }
  | {
      error_type: 'out_of_range';
      expected_range: number[];
      position: number;
    }
  | {
      error_type: 'overlapping_electrifications';
      reference: ObjectRef;
    }
  | {
      error_type: 'overlapping_speed_sections';
      reference: ObjectRef;
    }
  | {
      error_type: 'overlapping_switches';
      reference: ObjectRef;
    }
  | {
      error_type: 'unknown_port_name';
      port_name: string;
    }
  | {
      error_type: 'unused_port';
      port_name: string;
    };
export type InfraError = InfraErrorType & {
  field: string | null;
  is_warning: boolean;
  obj_id: string;
  obj_type: ObjectType;
};
export type InfraErrorTypeLabel =
  | 'duplicated_group'
  | 'empty_object'
  | 'invalid_group'
  | 'invalid_reference'
  | 'invalid_route'
  | 'invalid_switch_ports'
  | 'missing_route'
  | 'missing_buffer_stop'
  | 'node_endpoints_not_unique'
  | 'object_out_of_path'
  | 'odd_buffer_stop_location'
  | 'out_of_range'
  | 'overlapping_electrifications'
  | 'overlapping_speed_sections'
  | 'overlapping_switches'
  | 'unknown_port_name'
  | 'unused_port';
export type BoundingBox = (number & number)[][];
export type GeoJsonPoint = {
  coordinates: GeoJsonPointValue;
  type: 'Point';
};
export type GeoJsonMultiPointValue = GeoJsonPointValue[];
export type GeoJsonMultiPoint = {
  coordinates: GeoJsonMultiPointValue;
  type: 'MultiPoint';
};
export type GeoJsonMultiLineStringValue = GeoJsonLineStringValue[];
export type GeoJsonMultiLineString = {
  coordinates: GeoJsonMultiLineStringValue;
  type: 'MultiLineString';
};
export type GeoJsonPolygonValue = GeoJsonLineStringValue[];
export type GeoJsonPolygon = {
  coordinates: GeoJsonPolygonValue;
  type: 'Polygon';
};
export type GeoJsonMultiPolygonValue = GeoJsonPolygonValue[];
export type GeoJsonMultiPolygon = {
  coordinates: GeoJsonMultiPolygonValue;
  type: 'MultiPolygon';
};
export type GeoJson =
  | GeoJsonPoint
  | GeoJsonMultiPoint
  | GeoJsonLineString
  | GeoJsonMultiLineString
  | GeoJsonPolygon
  | GeoJsonMultiPolygon;
export type InfraObjectWithGeometry = {
  geographic: GeoJson;
  obj_id: string;
  railjson: object;
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
export type RoutePath = {
  switches_directions: (string & string)[][];
  track_ranges: DirectionalTrackRange[];
};
export type TrackOffset = {
  /** Offset in mm */
  offset: number;
  track: string;
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
  metadata?: RollingStockMetadata | null;
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
  slopes: Slope[];
  steps: PathWaypoint[];
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
  description?: string | null;
  funders?: string | null;
  id: number;
  image?: number | null;
  last_modification: string;
  name: string;
  objectives?: string | null;
  tags: Tags;
};
export type ProjectWithStudies = Project & {
  studies_count: number;
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
  description?: string | null;
  funders?: string | null;
  /** The id of the image document */
  image?: number | null;
  name: string;
  objectives?: string | null;
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
  business_code?: string | null;
  creation_date: string;
  description?: string | null;
  expected_end_date?: string | null;
  id: number;
  last_modification: string;
  name: string;
  project_id: number;
  service_code?: string | null;
  start_date?: string | null;
  state: string;
  study_type?: string | null;
  tags: Tags;
};
export type StudyWithScenarios = Study & {
  scenarios_count: number;
};
export type StudyResponse = Study & {
  project: Project;
  scenarios_count: number;
};
export type StudyCreateForm = {
  actual_end_date?: string | null;
  budget?: number | null;
  business_code?: string | null;
  description?: string | null;
  expected_end_date?: string | null;
  name: string;
  service_code?: string | null;
  start_date?: string | null;
  state: string;
  study_type?: string | null;
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
export type RollingStock = {
  base_power_class: string | null;
  comfort_acceleration: number;
  effort_curves: EffortCurves;
  electrical_power_startup_time: number | null;
  energy_sources: EnergySource[];
  gamma: Gamma;
  id: number;
  inertia_coefficient: number;
  length: number;
  loading_gauge: LoadingGaugeType;
  locked: boolean;
  mass: number;
  max_speed: number;
  metadata: RollingStockMetadata | null;
  name: string;
  power_restrictions: {
    [key: string]: string;
  };
  railjson_version: string;
  raise_pantograph_time: number | null;
  rolling_resistance: RollingResistance;
  startup_acceleration: number;
  startup_time: number;
  supported_signaling_systems: string[];
  version: number;
};
export type RollingStockForm = {
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
  locked?: boolean | null;
  mass: number;
  max_speed: number;
  metadata?: RollingStockMetadata | null;
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
export type RollingStockWithLiveries = RollingStock & {
  liveries: RollingStockLiveryMetadata[];
};
export type RollingStockKey =
  | {
      key: number;
      type: 'Id';
    }
  | {
      key: string;
      type: 'Name';
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
      KeyNotFound: {
        rolling_stock_key: RollingStockKey;
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
  budget: number | null;
  description: string | null;
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
  on_stop_signal: boolean;
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
export type PathfindingPayload = {
  path_waypoints: PathWaypoint[];
  route_paths: {
    route: string;
    signaling_type: string;
    track_sections: DirectionalTrackRange[];
  }[];
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
export type PathProperties = {
  curves?: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: number[];
  } | null;
  electrifications?: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: (
      | {
          type: 'electrification';
          voltage: string;
        }
      | {
          lower_pantograph: boolean;
          type: 'neutral_section';
        }
      | {
          type: 'non_electrified';
        }
    )[];
  } | null;
  geometry?: GeoJsonLineString | null;
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
export type Property = 'slopes' | 'curves' | 'electrifications' | 'geometry' | 'operational_points';
export type PathPropertiesInput = {
  /** List of track sections */
  track_section_ranges: TrackRange[];
};
export type PathfindingResultSuccess = {
  /** Path description as block ids */
  blocks: string[];
  /** Length of the path in mm */
  length: number;
  /** The path offset in mm of each path item given as input of the pathfinding
    The first value is always `0` (beginning of the path) and the last one is always equal to the `length` of the path in mm */
  path_item_positions: number[];
  /** Path description as route ids */
  routes: string[];
  /** Path description as track ranges */
  track_section_ranges: TrackRange[];
};
export type PathItemLocation =
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
export type PathfindingResult =
  | (PathfindingResultSuccess & {
      status: 'success';
    })
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
      path_item: PathItemLocation;
      status: 'invalid_path_item';
    }
  | {
      status: 'not_enough_path_items';
    }
  | {
      rolling_stock_name: string;
      status: 'rolling_stock_not_found';
    }
  | {
      core_error: InternalError;
      status: 'pathfinding_failed';
    };
export type PathfindingInputV2 = {
  /** List of waypoints given to the pathfinding */
  path_items: PathItemLocation[];
  /** Can the rolling stock run on non-electrified tracks */
  rolling_stock_is_thermal: boolean;
  rolling_stock_loading_gauge: LoadingGaugeType;
  /** List of supported electrification modes.
    Empty if does not support any electrification */
  rolling_stock_supported_electrifications: string[];
  /** List of supported signaling systems */
  rolling_stock_supported_signaling_systems: string[];
};
export type ScenarioWithDetails = Scenario & {
  electrical_profile_set_name?: string | null;
  infra_name: string;
  train_schedules: LightTrainSchedule[];
  trains_count: number;
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
  conflict_type: 'Spacing' | 'Routing';
  /** Datetime of the end of the conflict */
  end_time: string;
  /** Datetime of the start of the conflict */
  start_time: string;
  /** List of train ids involved in the conflict */
  train_ids: number[];
};
export type ReportTrainV2 = {
  /** Total energy consumption */
  energy_consumption: number;
  /** List of positions of a train
    Both positions (in mm) and times (in ms) must have the same length */
  positions: number[];
  /** Whether the train has reached all its scheduled points on time */
  scheduled_points_honored: boolean;
  /** List of speeds associated to a position */
  speeds: number[];
  times: number[];
};
export type SimulationResponse =
  | {
      base: ReportTrainV2;
      electrical_profiles: {
        /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
        boundaries: number[];
        /** List of `n+1` values associated to the ranges */
        values: (
          | {
              electrical_profile_type: 'no_profile';
            }
          | {
              electrical_profile_type: 'profile';
              handled: boolean;
              profile?: string | null;
            }
        )[];
      };
      final_output: ReportTrainV2 & {
        routing_requirements: RoutingRequirement[];
        signal_sightings: SignalSighting[];
        spacing_requirements: SpacingRequirement[];
        zone_updates: ZoneUpdate[];
      };
      /** A MRSP computation result (Most Restrictive Speed Profile) */
      mrsp: {
        positions: number[];
        speeds: number[];
      };
      provisional: ReportTrainV2;
      status: 'success';
    }
  | {
      pathfinding_result: PathfindingResult;
      status: 'pathfinding_failed';
    }
  | {
      core_error: InternalError;
      status: 'simulation_failed';
    };
export type Comfort = 'STANDARD' | 'AIR_CONDITIONING' | 'HEATING';
export type StepTimingData = {
  /** Time at which the train should arrive at the location */
  arrival_time: string;
  /** The train may arrive up to this duration after the expected arrival time */
  arrival_time_tolerance_after: number;
  /** The train may arrive up to this duration before the expected arrival time */
  arrival_time_tolerance_before: number;
};
export type PathfindingItem = {
  /** The stop duration in milliseconds, None if the train does not stop. */
  duration?: number | null;
  location: PathItemLocation;
  timing_data?: StepTimingData | null;
};
export type Distribution = 'STANDARD' | 'MARECO';
export type TrainScheduleBase = {
  comfort?: 'STANDARD' | 'AIR_CONDITIONING' | 'HEATING';
  constraint_distribution: Distribution;
  initial_speed?: number;
  labels?: string[];
  margins?: {
    boundaries: string[];
    /** The values of the margins. Must contains one more element than the boundaries
        Can be a percentage `X%` or a time in minutes per 100 kilometer `Xmin/100km` */
    values: string[];
  };
  options?: {
    use_electrical_profiles?: boolean;
  };
  path: (PathItemLocation & {
    /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
    deleted?: boolean;
    id: string;
  })[];
  power_restrictions?: {
    from: string;
    to: string;
    value: string;
  }[];
  rolling_stock_name: string;
  schedule?: {
    /** The expected arrival time at the stop.
        This will be used to compute the final simulation time. */
    arrival?: string | null;
    at: string;
    /** Whether the schedule item is locked (only for display purposes) */
    locked?: boolean;
    /** Whether the next signal is expected to be blocking while stopping
        Can be true only if `stop_for` is `Some` */
    on_stop_signal?: boolean;
    /** Duration of the stop.
        Can be `None` if the train does not stop.
        `Some("PT0S")` means the train stops for 0 seconds. */
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
export type ProjectPathTrainResult = {
  /** List of signal updates along the path */
  signal_updates: {
    /** The labels of the new aspect */
    aspect_label: string;
    /** Whether the signal is blinking */
    blinking: boolean;
    /** The color of the aspect
        (Bits 24-31 are alpha, 16-23 are red, 8-15 are green, 0-7 are blue) */
    color: number;
    /** The route ends at this position in mm on the train path */
    position_end: number;
    /** The route starts at this position in mm on the train path */
    position_start: number;
    /** The id of the updated signal */
    signal_id: string;
    /** The aspects stop being displayed at this time (number of seconds since `departure_time`) */
    time_end: number;
    /** The aspects start being displayed at this time (number of mseconds since `departure_time`) */
    time_start: number;
  }[];
  /** List of space-time curves sections along the path */
  space_time_curves: {
    positions: number[];
    times: number[];
  }[];
} & {
  /** Departure time of the train */
  departure_time: string;
  /** Rolling stock length in mm */
  rolling_stock_length: number;
};
export type ProjectPathForm = {
  ids: number[];
  infra_id: number;
  /** Project path input is described by a list of routes and a list of track range */
  path: {
    /** Path description as block ids */
    blocks: string[];
    /** List of route ids */
    routes: string[];
    /** List of track ranges */
    track_section_ranges: TrackRange[];
  };
};
export type SimulationSummaryResult =
  | {
      /** Total energy consumption of a train in kWh */
      energy_consumption: number;
      /** Length of a path in mm */
      length: number;
      /** Whether the train has reached all its scheduled points on time */
      scheduled_points_honored: boolean;
      status: 'success';
      /** Travel time in ms */
      time: number;
    }
  | {
      status: 'pathfinding_not_found';
    }
  | {
      error_type: string;
      status: 'pathfinding_failed';
    }
  | {
      error_type: string;
      status: 'simulation_failed';
    }
  | {
      rolling_stock_name: string;
      status: 'rolling_stock_not_found';
    };
export type TrainScheduleForm = TrainScheduleBase & {
  /** Timetable attached to the train schedule */
  timetable_id?: number | null;
};
export type Version = {
  git_describe: string | null;
};
export type WorkScheduleCreateResponse = {
  work_schedule_group_id: number;
};
export type WorkScheduleItemForm = {
  end_date_time: string;
  obj_id: string;
  start_date_time: string;
  track_ranges: TrackRange[];
  work_schedule_type: 'CATENARY' | 'TRACK';
};
export type WorkScheduleCreateForm = {
  work_schedule_group_name: string;
  work_schedules: WorkScheduleItemForm[];
};
