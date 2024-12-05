import { baseEditoastApi as api } from './baseGeneratedApis';

export const addTagTypes = [
  'authz',
  'documents',
  'electrical_profiles',
  'infra',
  'rolling_stock',
  'delimited_area',
  'pathfinding',
  'routes',
  'layers',
  'projects',
  'studies',
  'scenarios',
  'rolling_stock_livery',
  'search',
  'speed_limit_tags',
  'sprites',
  'stdcm_search_environment',
  'stdcm_log',
  'temporary_speed_limits',
  'timetable',
  'stdcm',
  'train_schedule',
  'work_schedules',
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getAuthzRolesMe: build.query<GetAuthzRolesMeApiResponse, GetAuthzRolesMeApiArg>({
        query: () => ({ url: `/authz/roles/me` }),
        providesTags: ['authz'],
      }),
      getAuthzRolesByUserId: build.query<
        GetAuthzRolesByUserIdApiResponse,
        GetAuthzRolesByUserIdApiArg
      >({
        query: (queryArg) => ({ url: `/authz/roles/${queryArg.userId}` }),
        providesTags: ['authz'],
      }),
      postAuthzRolesByUserId: build.mutation<
        PostAuthzRolesByUserIdApiResponse,
        PostAuthzRolesByUserIdApiArg
      >({
        query: (queryArg) => ({
          url: `/authz/roles/${queryArg.userId}`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['authz'],
      }),
      deleteAuthzRolesByUserId: build.mutation<
        DeleteAuthzRolesByUserIdApiResponse,
        DeleteAuthzRolesByUserIdApiArg
      >({
        query: (queryArg) => ({
          url: `/authz/roles/${queryArg.userId}`,
          method: 'DELETE',
          body: queryArg.body,
        }),
        invalidatesTags: ['authz'],
      }),
      postDocuments: build.mutation<PostDocumentsApiResponse, PostDocumentsApiArg>({
        query: (queryArg) => ({
          url: `/documents`,
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
        query: () => ({ url: `/electrical_profile_set` }),
        providesTags: ['electrical_profiles'],
      }),
      postElectricalProfileSet: build.mutation<
        PostElectricalProfileSetApiResponse,
        PostElectricalProfileSetApiArg
      >({
        query: (queryArg) => ({
          url: `/electrical_profile_set`,
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
          url: `/electrical_profile_set/${queryArg.electricalProfileSetId}`,
        }),
        providesTags: ['electrical_profiles'],
      }),
      deleteElectricalProfileSetByElectricalProfileSetId: build.mutation<
        DeleteElectricalProfileSetByElectricalProfileSetIdApiResponse,
        DeleteElectricalProfileSetByElectricalProfileSetIdApiArg
      >({
        query: (queryArg) => ({
          url: `/electrical_profile_set/${queryArg.electricalProfileSetId}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['electrical_profiles'],
      }),
      getElectricalProfileSetByElectricalProfileSetIdLevelOrder: build.query<
        GetElectricalProfileSetByElectricalProfileSetIdLevelOrderApiResponse,
        GetElectricalProfileSetByElectricalProfileSetIdLevelOrderApiArg
      >({
        query: (queryArg) => ({
          url: `/electrical_profile_set/${queryArg.electricalProfileSetId}/level_order`,
        }),
        providesTags: ['electrical_profiles'],
      }),
      getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
        query: () => ({ url: `/health` }),
      }),
      getInfra: build.query<GetInfraApiResponse, GetInfraApiArg>({
        query: (queryArg) => ({
          url: `/infra`,
          params: { page: queryArg.page, page_size: queryArg.pageSize },
        }),
        providesTags: ['infra'],
      }),
      postInfra: build.mutation<PostInfraApiResponse, PostInfraApiArg>({
        query: (queryArg) => ({ url: `/infra`, method: 'POST', body: queryArg.body }),
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
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}` }),
        providesTags: ['infra'],
      }),
      postInfraByInfraId: build.mutation<PostInfraByInfraIdApiResponse, PostInfraByInfraIdApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra'],
      }),
      putInfraByInfraId: build.mutation<PutInfraByInfraIdApiResponse, PutInfraByInfraIdApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra'],
      }),
      deleteInfraByInfraId: build.mutation<
        DeleteInfraByInfraIdApiResponse,
        DeleteInfraByInfraIdApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}`, method: 'DELETE' }),
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
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/auto_fixes` }),
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
      getInfraByInfraIdDelimitedArea: build.query<
        GetInfraByInfraIdDelimitedAreaApiResponse,
        GetInfraByInfraIdDelimitedAreaApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/delimited_area`,
          body: queryArg.body,
        }),
        providesTags: ['delimited_area'],
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
          url: `/infra/${queryArg.infraId}/lines/${queryArg.lineCode}/bbox`,
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
      postInfraByInfraIdObjectsAndObjectType: build.query<
        PostInfraByInfraIdObjectsAndObjectTypeApiResponse,
        PostInfraByInfraIdObjectsAndObjectTypeApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/objects/${queryArg.objectType}`,
          method: 'POST',
          body: queryArg.body,
        }),
        providesTags: ['infra'],
      }),
      postInfraByInfraIdPathProperties: build.query<
        PostInfraByInfraIdPathPropertiesApiResponse,
        PostInfraByInfraIdPathPropertiesApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/path_properties`,
          method: 'POST',
          body: queryArg.pathPropertiesInput,
          params: { props: queryArg.props },
        }),
        providesTags: ['pathfinding'],
      }),
      postInfraByInfraIdPathfinding: build.query<
        PostInfraByInfraIdPathfindingApiResponse,
        PostInfraByInfraIdPathfindingApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/pathfinding`,
          method: 'POST',
          body: queryArg.infraPathfindingInput,
          params: { number: queryArg.number },
        }),
        providesTags: ['infra', 'pathfinding'],
      }),
      postInfraByInfraIdPathfindingBlocks: build.query<
        PostInfraByInfraIdPathfindingBlocksApiResponse,
        PostInfraByInfraIdPathfindingBlocksApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/pathfinding/blocks`,
          method: 'POST',
          body: queryArg.pathfindingInput,
        }),
        providesTags: ['pathfinding'],
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
          url: `/layers/layer/${queryArg.layerSlug}/mvt/${queryArg.viewSlug}`,
          params: { infra: queryArg.infra },
        }),
        providesTags: ['layers'],
      }),
      getLayersTileByLayerSlugAndViewSlugZXY: build.query<
        GetLayersTileByLayerSlugAndViewSlugZXYApiResponse,
        GetLayersTileByLayerSlugAndViewSlugZXYApiArg
      >({
        query: (queryArg) => ({
          url: `/layers/tile/${queryArg.layerSlug}/${queryArg.viewSlug}/${queryArg.z}/${queryArg.x}/${queryArg.y}`,
          params: { infra: queryArg.infra },
        }),
        providesTags: ['layers'],
      }),
      getLightRollingStock: build.query<
        GetLightRollingStockApiResponse,
        GetLightRollingStockApiArg
      >({
        query: (queryArg) => ({
          url: `/light_rolling_stock`,
          params: { page: queryArg.page, page_size: queryArg.pageSize },
        }),
        providesTags: ['rolling_stock'],
      }),
      getLightRollingStockNameByRollingStockName: build.query<
        GetLightRollingStockNameByRollingStockNameApiResponse,
        GetLightRollingStockNameByRollingStockNameApiArg
      >({
        query: (queryArg) => ({ url: `/light_rolling_stock/name/${queryArg.rollingStockName}` }),
        providesTags: ['rolling_stock'],
      }),
      getLightRollingStockByRollingStockId: build.query<
        GetLightRollingStockByRollingStockIdApiResponse,
        GetLightRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({ url: `/light_rolling_stock/${queryArg.rollingStockId}` }),
        providesTags: ['rolling_stock'],
      }),
      getProjects: build.query<GetProjectsApiResponse, GetProjectsApiArg>({
        query: (queryArg) => ({
          url: `/projects`,
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
          url: `/projects`,
          method: 'POST',
          body: queryArg.projectCreateForm,
        }),
        invalidatesTags: ['projects'],
      }),
      getProjectsByProjectId: build.query<
        GetProjectsByProjectIdApiResponse,
        GetProjectsByProjectIdApiArg
      >({
        query: (queryArg) => ({ url: `/projects/${queryArg.projectId}` }),
        providesTags: ['projects'],
      }),
      deleteProjectsByProjectId: build.mutation<
        DeleteProjectsByProjectIdApiResponse,
        DeleteProjectsByProjectIdApiArg
      >({
        query: (queryArg) => ({ url: `/projects/${queryArg.projectId}`, method: 'DELETE' }),
        invalidatesTags: ['projects'],
      }),
      patchProjectsByProjectId: build.mutation<
        PatchProjectsByProjectIdApiResponse,
        PatchProjectsByProjectIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}`,
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
          url: `/projects/${queryArg.projectId}/studies`,
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
          url: `/projects/${queryArg.projectId}/studies`,
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
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}`,
        }),
        providesTags: ['studies'],
      }),
      deleteProjectsByProjectIdStudiesAndStudyId: build.mutation<
        DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse,
        DeleteProjectsByProjectIdStudiesAndStudyIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['studies'],
      }),
      patchProjectsByProjectIdStudiesAndStudyId: build.mutation<
        PatchProjectsByProjectIdStudiesAndStudyIdApiResponse,
        PatchProjectsByProjectIdStudiesAndStudyIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}`,
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
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios`,
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
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios`,
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
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}`,
        }),
        providesTags: ['scenarios'],
      }),
      deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.mutation<
        DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['scenarios'],
      }),
      patchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.mutation<
        PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
        PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}`,
          method: 'PATCH',
          body: queryArg.scenarioPatchForm,
        }),
        invalidatesTags: ['scenarios'],
      }),
      getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodes: build.query<
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiResponse,
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_nodes`,
          params: { page: queryArg.page, page_size: queryArg.pageSize },
        }),
        providesTags: ['scenarios'],
      }),
      postProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodes: build.mutation<
        PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiResponse,
        PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_nodes`,
          method: 'POST',
          body: queryArg.macroNodeForm,
        }),
        invalidatesTags: ['scenarios'],
      }),
      getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeId: build.query<
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiResponse,
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_nodes/${queryArg.nodeId}`,
        }),
        providesTags: ['scenarios'],
      }),
      putProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeId: build.mutation<
        PutProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiResponse,
        PutProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_nodes/${queryArg.nodeId}`,
          method: 'PUT',
          body: queryArg.macroNodeForm,
        }),
        invalidatesTags: ['scenarios'],
      }),
      deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeId: build.mutation<
        DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiResponse,
        DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_nodes/${queryArg.nodeId}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['scenarios'],
      }),
      postRollingStock: build.mutation<PostRollingStockApiResponse, PostRollingStockApiArg>({
        query: (queryArg) => ({
          url: `/rolling_stock`,
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
        query: (queryArg) => ({ url: `/rolling_stock/name/${queryArg.rollingStockName}` }),
        providesTags: ['rolling_stock'],
      }),
      getRollingStockPowerRestrictions: build.query<
        GetRollingStockPowerRestrictionsApiResponse,
        GetRollingStockPowerRestrictionsApiArg
      >({
        query: () => ({ url: `/rolling_stock/power_restrictions` }),
        providesTags: ['rolling_stock'],
      }),
      getRollingStockByRollingStockId: build.query<
        GetRollingStockByRollingStockIdApiResponse,
        GetRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({ url: `/rolling_stock/${queryArg.rollingStockId}` }),
        providesTags: ['rolling_stock'],
      }),
      deleteRollingStockByRollingStockId: build.mutation<
        DeleteRollingStockByRollingStockIdApiResponse,
        DeleteRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.rollingStockId}`,
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
          url: `/rolling_stock/${queryArg.rollingStockId}`,
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
          url: `/rolling_stock/${queryArg.rollingStockId}/livery`,
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
          url: `/rolling_stock/${queryArg.rollingStockId}/locked`,
          method: 'PATCH',
          body: queryArg.rollingStockLockedUpdateForm,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      getRollingStockByRollingStockIdUsage: build.query<
        GetRollingStockByRollingStockIdUsageApiResponse,
        GetRollingStockByRollingStockIdUsageApiArg
      >({
        query: (queryArg) => ({ url: `/rolling_stock/${queryArg.rollingStockId}/usage` }),
        providesTags: ['rolling_stock'],
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
      getSpeedLimitTags: build.query<GetSpeedLimitTagsApiResponse, GetSpeedLimitTagsApiArg>({
        query: () => ({ url: `/speed_limit_tags` }),
        providesTags: ['speed_limit_tags'],
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
      getStdcmSearchEnvironment: build.query<
        GetStdcmSearchEnvironmentApiResponse,
        GetStdcmSearchEnvironmentApiArg
      >({
        query: () => ({ url: `/stdcm/search_environment` }),
        providesTags: ['stdcm_search_environment'],
      }),
      postStdcmSearchEnvironment: build.mutation<
        PostStdcmSearchEnvironmentApiResponse,
        PostStdcmSearchEnvironmentApiArg
      >({
        query: (queryArg) => ({
          url: `/stdcm/search_environment`,
          method: 'POST',
          body: queryArg.stdcmSearchEnvironmentCreateForm,
        }),
        invalidatesTags: ['stdcm_search_environment'],
      }),
      getStdcmLog: build.query<GetStdcmLogApiResponse, GetStdcmLogApiArg>({
        query: (queryArg) => ({
          url: `/stdcm_log`,
          params: { trace_id: queryArg.traceId, id: queryArg.id },
        }),
        providesTags: ['stdcm_log'],
      }),
      getStdcmLogs: build.query<GetStdcmLogsApiResponse, GetStdcmLogsApiArg>({
        query: (queryArg) => ({
          url: `/stdcm_logs`,
          params: { page: queryArg.page, page_size: queryArg.pageSize },
        }),
        providesTags: ['stdcm_log'],
      }),
      postTemporarySpeedLimitGroup: build.mutation<
        PostTemporarySpeedLimitGroupApiResponse,
        PostTemporarySpeedLimitGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/temporary_speed_limit_group`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['temporary_speed_limits'],
      }),
      postTimetable: build.mutation<PostTimetableApiResponse, PostTimetableApiArg>({
        query: () => ({ url: `/timetable`, method: 'POST' }),
        invalidatesTags: ['timetable'],
      }),
      getTimetableById: build.query<GetTimetableByIdApiResponse, GetTimetableByIdApiArg>({
        query: (queryArg) => ({ url: `/timetable/${queryArg.id}` }),
        providesTags: ['timetable'],
      }),
      deleteTimetableById: build.mutation<
        DeleteTimetableByIdApiResponse,
        DeleteTimetableByIdApiArg
      >({
        query: (queryArg) => ({ url: `/timetable/${queryArg.id}`, method: 'DELETE' }),
        invalidatesTags: ['timetable'],
      }),
      getTimetableByIdConflicts: build.query<
        GetTimetableByIdConflictsApiResponse,
        GetTimetableByIdConflictsApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/conflicts`,
          params: {
            infra_id: queryArg.infraId,
            electrical_profile_set_id: queryArg.electricalProfileSetId,
          },
        }),
        providesTags: ['timetable'],
      }),
      postTimetableByIdStdcm: build.mutation<
        PostTimetableByIdStdcmApiResponse,
        PostTimetableByIdStdcmApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/stdcm`,
          method: 'POST',
          body: queryArg.body,
          params: { infra: queryArg.infra },
        }),
        invalidatesTags: ['stdcm'],
      }),
      postTimetableByIdTrainSchedule: build.mutation<
        PostTimetableByIdTrainScheduleApiResponse,
        PostTimetableByIdTrainScheduleApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/train_schedule`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['timetable', 'train_schedule'],
      }),
      getTowedRollingStock: build.query<
        GetTowedRollingStockApiResponse,
        GetTowedRollingStockApiArg
      >({
        query: (queryArg) => ({
          url: `/towed_rolling_stock`,
          params: { page: queryArg.page, page_size: queryArg.pageSize },
        }),
        providesTags: ['rolling_stock'],
      }),
      postTowedRollingStock: build.mutation<
        PostTowedRollingStockApiResponse,
        PostTowedRollingStockApiArg
      >({
        query: (queryArg) => ({
          url: `/towed_rolling_stock`,
          method: 'POST',
          body: queryArg.towedRollingStockForm,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      getTowedRollingStockByTowedRollingStockId: build.query<
        GetTowedRollingStockByTowedRollingStockIdApiResponse,
        GetTowedRollingStockByTowedRollingStockIdApiArg
      >({
        query: (queryArg) => ({ url: `/towed_rolling_stock/${queryArg.towedRollingStockId}` }),
        providesTags: ['rolling_stock'],
      }),
      patchTowedRollingStockByTowedRollingStockId: build.mutation<
        PatchTowedRollingStockByTowedRollingStockIdApiResponse,
        PatchTowedRollingStockByTowedRollingStockIdApiArg
      >({
        query: (queryArg) => ({
          url: `/towed_rolling_stock/${queryArg.towedRollingStockId}`,
          method: 'PATCH',
          body: queryArg.towedRollingStockForm,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      patchTowedRollingStockByTowedRollingStockIdLocked: build.mutation<
        PatchTowedRollingStockByTowedRollingStockIdLockedApiResponse,
        PatchTowedRollingStockByTowedRollingStockIdLockedApiArg
      >({
        query: (queryArg) => ({
          url: `/towed_rolling_stock/${queryArg.towedRollingStockId}/locked`,
          method: 'PATCH',
          body: queryArg.towedRollingStockLockedForm,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      postTrainSchedule: build.query<PostTrainScheduleApiResponse, PostTrainScheduleApiArg>({
        query: (queryArg) => ({ url: `/train_schedule`, method: 'POST', body: queryArg.body }),
        providesTags: ['train_schedule'],
      }),
      deleteTrainSchedule: build.mutation<
        DeleteTrainScheduleApiResponse,
        DeleteTrainScheduleApiArg
      >({
        query: (queryArg) => ({ url: `/train_schedule`, method: 'DELETE', body: queryArg.body }),
        invalidatesTags: ['timetable', 'train_schedule'],
      }),
      postTrainScheduleProjectPath: build.query<
        PostTrainScheduleProjectPathApiResponse,
        PostTrainScheduleProjectPathApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/project_path`,
          method: 'POST',
          body: queryArg.projectPathForm,
        }),
        providesTags: ['train_schedule'],
      }),
      postTrainScheduleSimulationSummary: build.query<
        PostTrainScheduleSimulationSummaryApiResponse,
        PostTrainScheduleSimulationSummaryApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/simulation_summary`,
          method: 'POST',
          body: queryArg.body,
        }),
        providesTags: ['train_schedule'],
      }),
      getTrainScheduleById: build.query<
        GetTrainScheduleByIdApiResponse,
        GetTrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({ url: `/train_schedule/${queryArg.id}` }),
        providesTags: ['train_schedule'],
      }),
      putTrainScheduleById: build.mutation<
        PutTrainScheduleByIdApiResponse,
        PutTrainScheduleByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/${queryArg.id}`,
          method: 'PUT',
          body: queryArg.trainScheduleForm,
        }),
        invalidatesTags: ['train_schedule', 'timetable'],
      }),
      getTrainScheduleByIdPath: build.query<
        GetTrainScheduleByIdPathApiResponse,
        GetTrainScheduleByIdPathApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/${queryArg.id}/path`,
          params: { infra_id: queryArg.infraId },
        }),
        providesTags: ['train_schedule', 'pathfinding'],
      }),
      getTrainScheduleByIdSimulation: build.query<
        GetTrainScheduleByIdSimulationApiResponse,
        GetTrainScheduleByIdSimulationApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/${queryArg.id}/simulation`,
          params: {
            infra_id: queryArg.infraId,
            electrical_profile_set_id: queryArg.electricalProfileSetId,
          },
        }),
        providesTags: ['train_schedule'],
      }),
      getVersion: build.query<GetVersionApiResponse, GetVersionApiArg>({
        query: () => ({ url: `/version` }),
      }),
      getVersionCore: build.query<GetVersionCoreApiResponse, GetVersionCoreApiArg>({
        query: () => ({ url: `/version/core` }),
      }),
      postWorkSchedules: build.mutation<PostWorkSchedulesApiResponse, PostWorkSchedulesApiArg>({
        query: (queryArg) => ({ url: `/work_schedules`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['work_schedules'],
      }),
      getWorkSchedulesGroup: build.query<
        GetWorkSchedulesGroupApiResponse,
        GetWorkSchedulesGroupApiArg
      >({
        query: () => ({ url: `/work_schedules/group` }),
        providesTags: ['work_schedules'],
      }),
      postWorkSchedulesGroup: build.mutation<
        PostWorkSchedulesGroupApiResponse,
        PostWorkSchedulesGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/work_schedules/group`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['work_schedules'],
      }),
      getWorkSchedulesGroupById: build.query<
        GetWorkSchedulesGroupByIdApiResponse,
        GetWorkSchedulesGroupByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/work_schedules/group/${queryArg.id}`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
            ordering: queryArg.ordering,
          },
        }),
        providesTags: ['work_schedules'],
      }),
      putWorkSchedulesGroupById: build.mutation<
        PutWorkSchedulesGroupByIdApiResponse,
        PutWorkSchedulesGroupByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/work_schedules/group/${queryArg.id}`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['work_schedules'],
      }),
      deleteWorkSchedulesGroupById: build.mutation<
        DeleteWorkSchedulesGroupByIdApiResponse,
        DeleteWorkSchedulesGroupByIdApiArg
      >({
        query: (queryArg) => ({ url: `/work_schedules/group/${queryArg.id}`, method: 'DELETE' }),
        invalidatesTags: ['work_schedules'],
      }),
      postWorkSchedulesProjectPath: build.query<
        PostWorkSchedulesProjectPathApiResponse,
        PostWorkSchedulesProjectPathApiArg
      >({
        query: (queryArg) => ({
          url: `/work_schedules/project_path`,
          method: 'POST',
          body: queryArg.body,
        }),
        providesTags: ['work_schedules'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedEditoastApi };
export type GetAuthzRolesMeApiResponse =
  /** status 200 List the roles of the issuer of the request */ {
    builtin: BuiltinRole[];
  };
export type GetAuthzRolesMeApiArg = void;
export type GetAuthzRolesByUserIdApiResponse = /** status 200 List the roles of a user */ {
  builtin: BuiltinRole[];
};
export type GetAuthzRolesByUserIdApiArg = {
  /** A user ID (not to be mistaken for its identity, cf. editoast user model documentation) */
  userId: number;
};
export type PostAuthzRolesByUserIdApiResponse = unknown;
export type PostAuthzRolesByUserIdApiArg = {
  /** A user ID (not to be mistaken for its identity, cf. editoast user model documentation) */
  userId: number;
  body: {
    roles: BuiltinRole[];
  };
};
export type DeleteAuthzRolesByUserIdApiResponse = unknown;
export type DeleteAuthzRolesByUserIdApiArg = {
  /** A user ID (not to be mistaken for its identity, cf. editoast user model documentation) */
  userId: number;
  body: {
    roles: BuiltinRole[];
  };
};
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
export type GetInfraByInfraIdDelimitedAreaApiResponse =
  /** status 200 The track ranges between a list entries and exits. */ {
    track_ranges: DirectionalTrackRange[];
  };
export type GetInfraByInfraIdDelimitedAreaApiArg = {
  /** An existing infra ID */
  infraId: number;
  body: {
    track_ranges: DirectionalTrackRange[];
  };
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
export type PostInfraByInfraIdPathPropertiesApiResponse =
  /** status 200 Path properties */ PathProperties;
export type PostInfraByInfraIdPathPropertiesApiArg = {
  /** The infra id */
  infraId: number;
  /** Path properties */
  props: Property[];
  pathPropertiesInput: PathPropertiesInput;
};
export type PostInfraByInfraIdPathfindingApiResponse =
  /** status 200 A list of shortest paths between starting and ending track locations */ PathfindingOutput[];
export type PostInfraByInfraIdPathfindingApiArg = {
  /** An existing infra ID */
  infraId: number;
  number?: number | null;
  infraPathfindingInput: InfraPathfindingInput;
};
export type PostInfraByInfraIdPathfindingBlocksApiResponse =
  /** status 200 Pathfinding Result */ PathfindingResult;
export type PostInfraByInfraIdPathfindingBlocksApiArg = {
  /** The infra id */
  infraId: number;
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
export type GetLightRollingStockApiResponse = /** status 200  */ PaginationStats & {
  results: LightRollingStockWithLiveries[];
};
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
  /** status 200 A paginated list of scenarios */ PaginationStats & {
    results: ScenarioWithDetails[];
  };
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
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiResponse =
  /** status 200 List of macro nodes for the requested scenario */ MacroNodeListResponse;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  page?: number;
  pageSize?: number | null;
};
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiResponse =
  /** status 201 Macro node created */ MacroNodeResponse;
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  macroNodeForm: MacroNodeForm;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiResponse =
  /** status 200 The requested Macro node */ MacroNodeResponse;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  nodeId: number;
};
export type PutProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiResponse =
  /** status 200 The requested scenario */ MacroNodeResponse;
export type PutProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  nodeId: number;
  macroNodeForm: MacroNodeForm;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiResponse =
  /** status 204 The macro node was deleted successfully */ void;
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  nodeId: number;
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
  /** force the deletion even if it's used */
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
export type PatchRollingStockByRollingStockIdLockedApiResponse = unknown;
export type PatchRollingStockByRollingStockIdLockedApiArg = {
  rollingStockId: number;
  rollingStockLockedUpdateForm: RollingStockLockedUpdateForm;
};
export type GetRollingStockByRollingStockIdUsageApiResponse =
  /** status 200 A list of the associated scenarios and their respective studies and projects. */ ScenarioReference[];
export type GetRollingStockByRollingStockIdUsageApiArg = {
  rollingStockId: number;
};
export type PostSearchApiResponse = /** status 200 The search results */ SearchResultItem[];
export type PostSearchApiArg = {
  page?: number;
  pageSize?: number | null;
  searchPayload: SearchPayload;
};
export type GetSpeedLimitTagsApiResponse =
  /** status 200 List of configured speed-limit tags */ string[];
export type GetSpeedLimitTagsApiArg = void;
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
export type GetStdcmSearchEnvironmentApiResponse =
  /** status 200  */ StdcmSearchEnvironment | /** status 204 No search environment was created */ void;
export type GetStdcmSearchEnvironmentApiArg = void;
export type PostStdcmSearchEnvironmentApiResponse = /** status 201  */ StdcmSearchEnvironment;
export type PostStdcmSearchEnvironmentApiArg = {
  stdcmSearchEnvironmentCreateForm: StdcmSearchEnvironmentCreateForm;
};
export type GetStdcmLogApiResponse = /** status 200 The STDCM log */ StdcmLog;
export type GetStdcmLogApiArg = {
  traceId?: string | null;
  id?: number | null;
};
export type GetStdcmLogsApiResponse = /** status 200 The list of STDCM Logs */ PaginationStats & {
  results: StdcmLogListItem[];
};
export type GetStdcmLogsApiArg = {
  page?: number;
  pageSize?: number | null;
};
export type PostTemporarySpeedLimitGroupApiResponse =
  /** status 201 The id of the created temporary speed limit group. */ {
    group_id: number;
  };
export type PostTemporarySpeedLimitGroupApiArg = {
  body: {
    speed_limit_group_name: string;
    speed_limits: {
      end_date_time: string;
      obj_id: string;
      speed_limit: number;
      start_date_time: string;
      track_ranges: DirectionalTrackRange[];
    }[];
  };
};
export type PostTimetableApiResponse =
  /** status 200 Timetable with train schedules ids */ TimetableResult;
export type PostTimetableApiArg = void;
export type GetTimetableByIdApiResponse =
  /** status 200 Timetable with train schedules ids */ TimetableDetailedResult;
export type GetTimetableByIdApiArg = {
  /** A timetable ID */
  id: number;
};
export type DeleteTimetableByIdApiResponse = unknown;
export type DeleteTimetableByIdApiArg = {
  /** A timetable ID */
  id: number;
};
export type GetTimetableByIdConflictsApiResponse = /** status 200 List of conflict */ Conflict[];
export type GetTimetableByIdConflictsApiArg = {
  /** A timetable ID */
  id: number;
  infraId: number;
  electricalProfileSetId?: number | null;
};
export type PostTimetableByIdStdcmApiResponse = /** status 201 The simulation result */
  | {
      departure_time: string;
      path: PathfindingResultSuccess;
      simulation: SimulationResponse;
      status: 'success';
    }
  | {
      conflicts: Conflict[];
      pathfinding_result: PathfindingResult;
      status: 'conflicts';
    }
  | {
      error: SimulationResponse;
      status: 'preprocessing_simulation_error';
    };
export type PostTimetableByIdStdcmApiArg = {
  /** The infra id */
  infra: number;
  /** timetable_id */
  id: number;
  body: {
    comfort: Comfort;
    electrical_profile_set_id?: number | null;
    loading_gauge_type?: LoadingGaugeType | null;
    /** Can be a percentage `X%`, a time in minutes per 100 kilometer `Xmin/100km` */
    margin?: string | null;
    /** Maximum speed of the consist in km/h
        Velocity in m·s⁻¹ */
    max_speed?: number | null;
    /** By how long we can shift the departure time in milliseconds
        Deprecated, first step data should be used instead */
    maximum_departure_delay?: number | null;
    /** Specifies how long the total run time can be in milliseconds
        Deprecated, first step data should be used instead */
    maximum_run_time?: number | null;
    rolling_stock_id: number;
    /** Train categories for speed limits */
    speed_limit_tags?: string | null;
    /** Deprecated, first step arrival time should be used instead */
    start_time?: string | null;
    steps: PathfindingItem[];
    temporary_speed_limit_group_id?: number | null;
    /** Margin after the train passage in milliseconds
        
        Enforces that the path used by the train should be free and
        available at least that many milliseconds after its passage. */
    time_gap_after?: number;
    /** Margin before the train passage in seconds
        
        Enforces that the path used by the train should be free and
        available at least that many milliseconds before its passage. */
    time_gap_before?: number;
    /** Total length of the consist in meters
        Length in m */
    total_length?: number | null;
    /** Total mass of the consist
        Mass in kg */
    total_mass?: number | null;
    towed_rolling_stock_id?: number | null;
    work_schedule_group_id?: number | null;
  };
};
export type PostTimetableByIdTrainScheduleApiResponse =
  /** status 200 The created train schedules */ TrainScheduleResult[];
export type PostTimetableByIdTrainScheduleApiArg = {
  /** A timetable ID */
  id: number;
  body: TrainScheduleBase[];
};
export type GetTowedRollingStockApiResponse = /** status 200  */ PaginationStats & {
  results: TowedRollingStock[];
};
export type GetTowedRollingStockApiArg = {
  page?: number;
  pageSize?: number | null;
};
export type PostTowedRollingStockApiResponse =
  /** status 200 The created towed rolling stock */ TowedRollingStock;
export type PostTowedRollingStockApiArg = {
  towedRollingStockForm: TowedRollingStockForm;
};
export type GetTowedRollingStockByTowedRollingStockIdApiResponse =
  /** status 200 The requested towed rolling stock */ TowedRollingStock;
export type GetTowedRollingStockByTowedRollingStockIdApiArg = {
  towedRollingStockId: number;
};
export type PatchTowedRollingStockByTowedRollingStockIdApiResponse =
  /** status 200 The created towed rolling stock */ TowedRollingStock;
export type PatchTowedRollingStockByTowedRollingStockIdApiArg = {
  towedRollingStockId: number;
  towedRollingStockForm: TowedRollingStockForm;
};
export type PatchTowedRollingStockByTowedRollingStockIdLockedApiResponse = unknown;
export type PatchTowedRollingStockByTowedRollingStockIdLockedApiArg = {
  towedRollingStockId: number;
  towedRollingStockLockedForm: TowedRollingStockLockedForm;
};
export type PostTrainScheduleApiResponse =
  /** status 200 Retrieve a list of train schedule */ TrainScheduleResult[];
export type PostTrainScheduleApiArg = {
  body: {
    ids: number[];
  };
};
export type DeleteTrainScheduleApiResponse = unknown;
export type DeleteTrainScheduleApiArg = {
  body: {
    ids: number[];
  };
};
export type PostTrainScheduleProjectPathApiResponse = /** status 200 Project Path Output */ {
  [key: string]: ProjectPathTrainResult;
};
export type PostTrainScheduleProjectPathApiArg = {
  projectPathForm: ProjectPathForm;
};
export type PostTrainScheduleSimulationSummaryApiResponse =
  /** status 200 Associate each train id with its simulation summary */ {
    [key: string]: SimulationSummaryResult;
  };
export type PostTrainScheduleSimulationSummaryApiArg = {
  body: {
    electrical_profile_set_id?: number | null;
    ids: number[];
    infra_id: number;
  };
};
export type GetTrainScheduleByIdApiResponse =
  /** status 200 The train schedule */ TrainScheduleResult;
export type GetTrainScheduleByIdApiArg = {
  /** A train schedule ID */
  id: number;
};
export type PutTrainScheduleByIdApiResponse =
  /** status 200 The train schedule have been updated */ TrainScheduleResult;
export type PutTrainScheduleByIdApiArg = {
  /** A train schedule ID */
  id: number;
  trainScheduleForm: TrainScheduleForm;
};
export type GetTrainScheduleByIdPathApiResponse = /** status 200 The path */ PathfindingResult;
export type GetTrainScheduleByIdPathApiArg = {
  /** A train schedule ID */
  id: number;
  infraId: number;
};
export type GetTrainScheduleByIdSimulationApiResponse =
  /** status 200 Simulation Output */ SimulationResponse;
export type GetTrainScheduleByIdSimulationApiArg = {
  /** A train schedule ID */
  id: number;
  infraId: number;
  electricalProfileSetId?: number;
};
export type GetVersionApiResponse = /** status 200 Return the service version */ Version;
export type GetVersionApiArg = void;
export type GetVersionCoreApiResponse = /** status 200 Return the core service version */ Version;
export type GetVersionCoreApiArg = void;
export type PostWorkSchedulesApiResponse =
  /** status 201 The id of the created work schedule group */ {
    work_schedule_group_id: number;
  };
export type PostWorkSchedulesApiArg = {
  body: {
    work_schedule_group_name: string;
    work_schedules: WorkScheduleItemForm[];
  };
};
export type GetWorkSchedulesGroupApiResponse =
  /** status 201 The existing work schedule group ids */ number[];
export type GetWorkSchedulesGroupApiArg = void;
export type PostWorkSchedulesGroupApiResponse =
  /** status 200 The id of the created work schedule group */ {
    work_schedule_group_id: number;
  };
export type PostWorkSchedulesGroupApiArg = {
  body: {
    work_schedule_group_name?: string | null;
  };
};
export type GetWorkSchedulesGroupByIdApiResponse =
  /** status 200 The work schedules in the group */ PaginationStats & {
    results: WorkSchedule[];
  };
export type GetWorkSchedulesGroupByIdApiArg = {
  page?: number;
  pageSize?: number | null;
  /** A work schedule group ID */
  id: number;
  ordering?: Ordering;
};
export type PutWorkSchedulesGroupByIdApiResponse =
  /** status 200 The work schedules have been created */ WorkSchedule[];
export type PutWorkSchedulesGroupByIdApiArg = {
  /** A work schedule group ID */
  id: number;
  body: WorkScheduleItemForm[];
};
export type DeleteWorkSchedulesGroupByIdApiResponse = unknown;
export type DeleteWorkSchedulesGroupByIdApiArg = {
  /** A work schedule group ID */
  id: number;
};
export type PostWorkSchedulesProjectPathApiResponse =
  /** status 201 Returns a list of work schedules whose track ranges intersect the given path */ {
    /** The date and time when the work schedule ends. */
    end_date_time: string;
    /** a list of intervals `(a, b)` that represent the projections of the work schedule track ranges:
    - `a` is the distance from the beginning of the path to the beginning of the track range
    - `b` is the distance from the beginning of the path to the end of the track range */
    path_position_ranges: Intersection[];
    /** The date and time when the work schedule takes effect. */
    start_date_time: string;
    type: 'CATENARY' | 'TRACK';
  }[];
export type PostWorkSchedulesProjectPathApiArg = {
  body: {
    path_track_ranges: TrackRange[];
    work_schedule_group_id: number;
  };
};
export type BuiltinRole =
  | 'Superuser'
  | 'OpsWrite'
  | 'OpsRead'
  | 'InfraRead'
  | 'InfraWrite'
  | 'RollingStockCollectionRead'
  | 'RollingStockCollectionWrite'
  | 'WorkScheduleWrite'
  | 'WorkScheduleRead'
  | 'MapRead'
  | 'Stdcm'
  | 'StdcmAdmin'
  | 'TimetableRead'
  | 'TimetableWrite'
  | 'DocumentRead'
  | 'DocumentWrite'
  | 'SubjectRead'
  | 'SubjectWrite'
  | 'RoleRead'
  | 'RoleWrite';
export type NewDocumentResponse = {
  document_key: number;
};
export type InternalError = {
  context: {
    [key: string]: unknown;
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
  weight?: number | null;
};
export type Waypoint =
  | {
      id: string;
      type: 'BufferStop';
    }
  | {
      id: string;
      type: 'Detector';
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
  begin: number;
  end: number;
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
  begin: number;
  end: number;
  gradient: number;
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
  value: unknown;
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
  value: unknown;
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
  value: unknown;
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
        /** Importance of the operational point */
        weight: number | null;
      }[]
    | null;
  slopes?: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: number[];
  } | null;
  zones?: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: string[];
  } | null;
};
export type Property =
  | 'slopes'
  | 'curves'
  | 'electrifications'
  | 'geometry'
  | 'operational_points'
  | 'zones';
export type PathPropertiesInput = {
  /** List of track sections */
  track_section_ranges: TrackRange[];
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
export type InfraPathfindingInput = {
  ending: PathfindingTrackLocationInput;
  starting: PathfindingTrackLocationInput;
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
export type TrackOffset = {
  /** Offset in mm */
  offset: number;
  track: string;
};
export type TrackReference =
  | {
      track_id: string;
    }
  | {
      track_name: string;
    };
export type OperationalPointReference = (
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
  track_reference?: TrackReference | null;
};
export type PathItemLocation = TrackOffset | OperationalPointReference;
export type PathfindingInputError =
  | {
      error_type: 'invalid_path_items';
      items: {
        index: number;
        path_item: PathItemLocation;
      }[];
    }
  | {
      error_type: 'not_enough_path_items';
    }
  | {
      error_type: 'rolling_stock_not_found';
      rolling_stock_name: string;
    }
  | {
      error_type: 'zero_length_path';
    };
export type OffsetRange = {
  end: number;
  start: number;
};
export type IncompatibleOffsetRangeWithValue = {
  range: OffsetRange;
  value: string;
};
export type IncompatibleOffsetRange = {
  range: OffsetRange;
};
export type IncompatibleConstraints = {
  incompatible_electrification_ranges: IncompatibleOffsetRangeWithValue[];
  incompatible_gauge_ranges: IncompatibleOffsetRange[];
  incompatible_signaling_system_ranges: IncompatibleOffsetRangeWithValue[];
};
export type PathfindingNotFound =
  | {
      error_type: 'not_found_in_blocks';
      length: number;
      track_section_ranges: TrackRange[];
    }
  | {
      error_type: 'not_found_in_routes';
      length: number;
      track_section_ranges: TrackRange[];
    }
  | {
      error_type: 'not_found_in_tracks';
    }
  | {
      error_type: 'incompatible_constraints';
      incompatible_constraints: IncompatibleConstraints;
      relaxed_constraints_path: PathfindingResultSuccess;
    };
export type PathfindingFailure =
  | (PathfindingInputError & {
      failed_status: 'pathfinding_input_error';
    })
  | (PathfindingNotFound & {
      failed_status: 'pathfinding_not_found';
    })
  | {
      core_error: InternalError;
      failed_status: 'internal_error';
    };
export type PathfindingResult =
  | (PathfindingResultSuccess & {
      status: 'success';
    })
  | (PathfindingFailure & {
      status: 'failure';
    });
export type PathfindingInput = {
  /** List of waypoints given to the pathfinding */
  path_items: PathItemLocation[];
  /** Can the rolling stock run on non-electrified tracks */
  rolling_stock_is_thermal: boolean;
  /** Rolling stock length */
  rolling_stock_length: number;
  rolling_stock_loading_gauge: LoadingGaugeType;
  /** Rolling stock maximum speed */
  rolling_stock_maximum_speed: number;
  /** List of supported electrification modes.
    Empty if does not support any electrification */
  rolling_stock_supported_electrifications: string[];
  /** List of supported signaling systems */
  rolling_stock_supported_signaling_systems: string[];
};
export type RoutePath = {
  switches_directions: (string & string)[][];
  track_ranges: DirectionalTrackRange[];
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
export type SpeedIntervalValueCurve = {
  /** Speed in m/s (sorted ascending)
    External bounds are implicit to [0, rolling_stock.max_speed] */
  boundaries: number[];
  /** Interval values, must be >= 0 (unit to be made explicit at use)
    There must be one more value than boundaries */
  values: number[];
};
export type EtcsBrakeParams = {
  gamma_emergency: SpeedIntervalValueCurve;
  gamma_normal_service: SpeedIntervalValueCurve;
  gamma_service: SpeedIntervalValueCurve;
  k_dry: SpeedIntervalValueCurve;
  k_n_neg: SpeedIntervalValueCurve;
  k_n_pos: SpeedIntervalValueCurve;
  k_wet: SpeedIntervalValueCurve;
  /** T_be: safe brake build up time in s */
  t_be: number;
  /** T_bs1: time service break in s used for SBI1 computation */
  t_bs1: number;
  /** T_bs2: time service break in s used for SBI2 computation */
  t_bs2: number;
  /** T_traction_cut_off: time delay in s from the traction cut-off command to the moment the acceleration due to traction is zero */
  t_traction_cut_off: number;
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
  /** Solid friction
    Solid Friction in N */
  A: number;
  /** Viscosity friction in N·(m/s)⁻¹; N = kg⋅m⋅s⁻²
    Viscosity friction in kg·s⁻¹ */
  B: number;
  /** Aerodynamic drag in N·(m/s)⁻²; N = kg⋅m⋅s⁻²
    Aerodynamic drag in kg·m⁻¹ */
  C: number;
  type: string;
};
export type RollingStockSupportedSignalingSystems = string[];
export type LightRollingStock = {
  base_power_class: string | null;
  /** Acceleration in m·s⁻² */
  comfort_acceleration: number;
  /** Acceleration in m·s⁻² */
  const_gamma: number;
  effort_curves: LightEffortCurves;
  energy_sources: EnergySource[];
  etcs_brake_params: EtcsBrakeParams | null;
  id: number;
  /** Ratio 1:1 */
  inertia_coefficient: number;
  /** Length in m */
  length: number;
  loading_gauge: LoadingGaugeType;
  locked: boolean;
  /** Mass in kg */
  mass: number;
  /** Velocity in m·s⁻¹ */
  max_speed: number;
  metadata: RollingStockMetadata | null;
  name: string;
  power_restrictions: {
    [key: string]: string;
  };
  railjson_version: string;
  rolling_resistance: RollingResistance;
  /** Acceleration in m·s⁻² */
  startup_acceleration: number;
  /** Duration in s */
  startup_time: number;
  supported_signaling_systems: RollingStockSupportedSignalingSystems;
};
export type RollingStockLivery = {
  compound_image_id?: number | null;
  id: number;
  name: string;
  rolling_stock_id: number;
};
export type LightRollingStockWithLiveries = LightRollingStock & {
  liveries: RollingStockLivery[];
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
  electrical_profile_set_id?: number;
  id: number;
  infra_id: number;
  last_modification: string;
  name: string;
  study_id: number;
  tags: Tags;
  timetable_id: number;
};
export type ScenarioWithDetails = Scenario & {
  infra_name: string;
  trains_count: number;
};
export type ScenarioResponse = Scenario & {
  infra_name: string;
  project: Project;
  study: Study;
  trains_count: number;
};
export type ScenarioCreateForm = {
  description?: string;
  electrical_profile_set_id?: number | null;
  infra_id: number;
  name: string;
  tags?: Tags;
  timetable_id: number;
};
export type ScenarioPatchForm = {
  description?: string | null;
  electrical_profile_set_id?: number | null;
  infra_id?: number | null;
  name?: string | null;
  tags?: Tags | null;
};
export type MacroNodeResponse = {
  connection_time: number;
  full_name?: string | null;
  id: number;
  labels: Tags;
  path_item_key: string;
  position_x: number;
  position_y: number;
  trigram?: string | null;
};
export type MacroNodeListResponse = PaginationStats & {
  results: MacroNodeResponse[];
};
export type MacroNodeForm = {
  connection_time: number;
  full_name?: string | null;
  labels: Tags;
  path_item_key: string;
  position_x: number;
  position_y: number;
  trigram?: string | null;
};
export type Comfort = 'STANDARD' | 'AIR_CONDITIONING' | 'HEATING';
export type EffortCurveConditions = {
  comfort: Comfort | null;
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
  /** Acceleration in m·s⁻² */
  comfort_acceleration: number;
  /** Acceleration in m·s⁻² */
  const_gamma: number;
  effort_curves: EffortCurves;
  /** Duration in s */
  electrical_power_startup_time: number | null;
  energy_sources: EnergySource[];
  etcs_brake_params: EtcsBrakeParams | null;
  id: number;
  /** Ratio 1:1 */
  inertia_coefficient: number;
  /** Length in m */
  length: number;
  loading_gauge: LoadingGaugeType;
  locked: boolean;
  /** Mass in kg */
  mass: number;
  /** Velocity in m·s⁻¹ */
  max_speed: number;
  metadata: RollingStockMetadata | null;
  name: string;
  power_restrictions: {
    [key: string]: string;
  };
  railjson_version: string;
  /** Duration in s */
  raise_pantograph_time: number | null;
  rolling_resistance: RollingResistance;
  /** Acceleration in m·s⁻² */
  startup_acceleration: number;
  /** Duration in s */
  startup_time: number;
  supported_signaling_systems: string[];
  version: number;
};
export type RollingStockForm = {
  base_power_class: string | null;
  /** Acceleration in m·s⁻² */
  comfort_acceleration: number;
  /** Acceleration in m·s⁻² */
  const_gamma: number;
  effort_curves: EffortCurves;
  /** The time the train takes before actually using electrical power (in seconds). Is null if the train is not electric.
    Duration in s */
  electrical_power_startup_time?: number | null;
  energy_sources?: EnergySource[];
  etcs_brake_params?: EtcsBrakeParams | null;
  /** Ratio 1:1 */
  inertia_coefficient: number;
  /** Length in m */
  length: number;
  loading_gauge: LoadingGaugeType;
  locked?: boolean | null;
  /** Mass in kg */
  mass: number;
  /** Velocity in m·s⁻¹ */
  max_speed: number;
  metadata?: RollingStockMetadata | null;
  name: string;
  /** Mapping of power restriction code to power class */
  power_restrictions: {
    [key: string]: string;
  };
  /** The time it takes to raise this train's pantograph in seconds. Is null if the train is not electric.
    Duration in s */
  raise_pantograph_time?: number | null;
  rolling_resistance: RollingResistance;
  /** Acceleration in m·s⁻² */
  startup_acceleration: number;
  /** Duration in s */
  startup_time: number;
  supported_signaling_systems: RollingStockSupportedSignalingSystems;
};
export type RollingStockWithLiveries = RollingStock & {
  liveries: RollingStockLivery[];
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
export type ScenarioReference = {
  project_id: number;
  project_name: string;
  scenario_id: number;
  scenario_name: string;
  study_id: number;
  study_name: string;
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
      IsLocked: {
        rolling_stock_id: number;
      };
    }
  | {
      IsUsed: {
        rolling_stock_id: number;
        usage: ScenarioReference[];
      };
    }
  | 'BasePowerClassEmpty';
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
export type Margins = {
  boundaries: string[];
  /** The values of the margins. Must contains one more element than the boundaries
    Can be a percentage `X%` or a time in minutes per 100 kilometer `Xmin/100km` */
  values: string[];
};
export type TrainScheduleOptions = {
  use_electrical_profiles?: boolean;
};
export type PathItem = PathItemLocation & {
  /** Metadata given to mark a point as wishing to be deleted by the user.
    It's useful for soft deleting the point (waiting to fix / remove all references)
    If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  id: string;
};
export type PowerRestrictionItem = {
  from: string;
  to: string;
  value: string;
};
export type ReceptionSignal = 'OPEN' | 'STOP' | 'SHORT_SLIP_STOP';
export type ScheduleItem = {
  /** The expected arrival time at the stop.
    This will be used to compute the final simulation time. */
  arrival?: string | null;
  at: string;
  /** Whether the schedule item is locked (only for display purposes) */
  locked?: boolean;
  reception_signal?: ReceptionSignal;
  /** Duration of the stop.
    Can be `None` if the train does not stop.
    If `None`, `reception_signal` must be `Open`.
    `Some("PT0S")` means the train stops for 0 seconds. */
  stop_for?: string | null;
};
export type SearchResultItemTrainSchedule = {
  comfort: number;
  constraint_distribution: number;
  id: number;
  initial_speed: number;
  labels: (string | null)[];
  margins: Margins;
  options: TrainScheduleOptions;
  path: PathItem[];
  power_restrictions: PowerRestrictionItem[];
  rolling_stock_name: string;
  schedule: ScheduleItem[];
  speed_limit_tag?: string | null;
  start_time: string;
  timetable_id: number;
  train_name: string;
};
export type SearchResultItem =
  | SearchResultItemTrack
  | SearchResultItemOperationalPoint
  | SearchResultItemSignal
  | SearchResultItemProject
  | SearchResultItemStudy
  | SearchResultItemScenario
  | SearchResultItemTrainSchedule;
export type SearchQuery = boolean | number | number | string | (SearchQuery | null)[];
export type SearchPayload = {
  /** Whether to return the SQL query instead of executing it
    
    Only available in debug builds. */
  dry?: boolean;
  /** The object kind to query - run `editoast search list` to get all possible values */
  object: string;
  query: SearchQuery;
};
export type StdcmSearchEnvironment = {
  electrical_profile_set_id?: number;
  id: number;
  infra_id: number;
  search_window_begin: string;
  search_window_end: string;
  temporary_speed_limit_group_id?: number;
  timetable_id: number;
  work_schedule_group_id?: number;
};
export type StdcmSearchEnvironmentCreateForm = {
  electrical_profile_set_id?: number | null;
  infra_id: number;
  search_window_begin: string;
  search_window_end: string;
  temporary_speed_limit_group_id?: number | null;
  timetable_id: number;
  work_schedule_group_id?: number | null;
};
export type RoutingZoneRequirement = {
  /** Time in ms */
  end_time: number;
  entry_detector: string;
  exit_detector: string;
  switches: {
    [key: string]: string;
  };
  zone: string;
};
export type RoutingRequirement = {
  /** Time in ms */
  begin_time: number;
  route: string;
  zones: RoutingZoneRequirement[];
};
export type SpacingRequirement = {
  begin_time: number;
  end_time: number;
  zone: string;
};
export type WorkScheduleType = 'CATENARY' | 'TRACK';
export type WorkSchedule = {
  end_date_time: string;
  id: number;
  obj_id: string;
  start_date_time: string;
  track_ranges: TrackRange[];
  work_schedule_group_id: number;
  work_schedule_type: WorkScheduleType;
};
export type StdcmRequest = {
  comfort: Comfort;
  /** Infrastructure expected version */
  expected_version: string;
  /** Infrastructure id */
  infra: number;
  margin?:
    | (
        | {
            Percentage: number;
          }
        | {
            MinPer100Km: number;
          }
      )
    | null;
  /** Maximum departure delay in milliseconds. */
  maximum_departure_delay: number;
  /** Maximum run time of the simulation in milliseconds */
  maximum_run_time: number;
  /** List of waypoints. Each waypoint is a list of track offset. */
  path_items: PathItem[];
  physics_consist: {
    base_power_class?: string | null;
    comfort_acceleration: number;
    /** The constant gamma braking coefficient used when NOT circulating
        under ETCS/ERTMS signaling system */
    const_gamma: number;
    effort_curves: EffortCurves;
    /** The time the train takes before actually using electrical power.
        Is null if the train is not electric or the value not specified. */
    electrical_power_startup_time?: number | null;
    etcs_brake_params?: EtcsBrakeParams | null;
    inertia_coefficient: number;
    /** Length of the rolling stock */
    length: number;
    /** Mass of the rolling stock */
    mass: number;
    /** Maximum speed of the rolling stock */
    max_speed: number;
    /** Mapping of power restriction code to power class */
    power_restrictions?: {
      [key: string]: string;
    };
    /** The time it takes to raise this train's pantograph.
        Is null if the train is not electric or the value not specified. */
    raise_pantograph_time?: number | null;
    rolling_resistance: RollingResistance;
    startup_acceleration: number;
    startup_time: number;
  };
  rolling_stock_loading_gauge: LoadingGaugeType;
  rolling_stock_supported_signaling_systems: RollingStockSupportedSignalingSystems;
  speed_limit_tag?: string | null;
  start_time: string;
  /** List of applicable temporary speed limits between the train departure and arrival */
  temporary_speed_limits: {
    /** Speed limitation in m/s */
    speed_limit: number;
    /** Track ranges on which the speed limitation applies */
    track_ranges: TrackRange[];
  }[];
  /** Gap between the created train and following trains in milliseconds */
  time_gap_after: number;
  /** Gap between the created train and previous trains in milliseconds */
  time_gap_before: number;
  /** Numerical integration time step in milliseconds. Use default value if not specified. */
  time_step?: number | null;
  trains_requirements: {
    [key: string]: {
      routing_requirements: RoutingRequirement[];
      spacing_requirements: SpacingRequirement[];
      start_time: string;
    };
  };
  /** List of planned work schedules */
  work_schedules: WorkSchedule[];
};
export type ReportTrain = {
  /** Total energy consumption */
  energy_consumption: number;
  /** Time in ms of each path item given as input of the pathfinding
    The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path) */
  path_item_times: number[];
  /** List of positions of a train
    Both positions (in mm) and times (in ms) must have the same length */
  positions: number[];
  /** List of speeds associated to a position */
  speeds: number[];
  times: number[];
};
export type SignalCriticalPosition = {
  /** Position in mm */
  position: number;
  signal: string;
  state: string;
  /** Time in ms */
  time: number;
};
export type ZoneUpdate = {
  is_entry: boolean;
  position: number;
  time: number;
  zone: string;
};
export type SimulationResponse =
  | {
      base: ReportTrain;
      electrical_profiles: {
        /** List of `n` boundaries of the ranges (block path).
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
      final_output: ReportTrain & {
        routing_requirements: RoutingRequirement[];
        signal_critical_positions: SignalCriticalPosition[];
        spacing_requirements: SpacingRequirement[];
        zone_updates: ZoneUpdate[];
      };
      /** A MRSP computation result (Most Restrictive Speed Profile) */
      mrsp: {
        /** List of `n` boundaries of the ranges (block path).
        A boundary is a distance from the beginning of the path in mm. */
        boundaries: number[];
        /** List of `n+1` values associated to the ranges */
        values: {
          source?:
            | (
                | {
                    speed_limit_source_type: 'given_train_tag';
                    tag: string;
                  }
                | {
                    speed_limit_source_type: 'fallback_tag';
                    tag: string;
                  }
                | {
                    speed_limit_source_type: 'unknown_tag';
                  }
              )
            | null;
          /** in meters per second */
          speed: number;
        }[];
      };
      provisional: ReportTrain;
      status: 'success';
    }
  | {
      pathfinding_failed: PathfindingFailure;
      status: 'pathfinding_failed';
    }
  | {
      core_error: InternalError;
      status: 'simulation_failed';
    };
export type StdcmResponse =
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
export type StdcmLog = {
  created: string;
  id: number;
  request: StdcmRequest;
  response: StdcmResponse;
  trace_id?: string | null;
  user_id?: number | null;
};
export type StdcmLogListItem = {
  id: number;
  trace_id?: string | null;
};
export type TimetableResult = {
  timetable_id: number;
};
export type TimetableDetailedResult = {
  timetable_id: number;
  train_ids: number[];
};
export type ConflictRequirement = {
  end_time: string;
  start_time: string;
  zone: string;
};
export type Conflict = {
  conflict_type: 'Spacing' | 'Routing';
  /** Datetime of the end of the conflict */
  end_time: string;
  /** List of requirements causing the conflict */
  requirements: ConflictRequirement[];
  /** Datetime of the start of the conflict */
  start_time: string;
  /** List of train ids involved in the conflict */
  train_ids: number[];
  /** List of work schedule ids involved in the conflict */
  work_schedule_ids: number[];
};
export type PathfindingItem = {
  /** The stop duration in milliseconds, None if the train does not stop. */
  duration?: number | null;
  location: PathItemLocation;
  timing_data?: {
    /** Time at which the train should arrive at the location */
    arrival_time: string;
    /** The train may arrive up to this duration after the expected arrival time */
    arrival_time_tolerance_after: number;
    /** The train may arrive up to this duration before the expected arrival time */
    arrival_time_tolerance_before: number;
  } | null;
};
export type Distribution = 'STANDARD' | 'MARECO';
export type TrainScheduleBase = {
  comfort?: Comfort;
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
    reception_signal?: ReceptionSignal;
    /** Duration of the stop.
        Can be `None` if the train does not stop.
        If `None`, `reception_signal` must be `Open`.
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
export type RollingResistancePerWeight = {
  /** Solid friction in N·kg⁻¹; N = kg⋅m⋅s⁻²
    Acceleration in m·s⁻² */
  A: number;
  /** Viscosity friction in (N·kg⁻¹)·(m/s)⁻¹; N = kg⋅m⋅s⁻²
    Viscosity friction per weight in s⁻¹ */
  B: number;
  /** Aerodynamic drag per kg in (N·kg⁻¹)·(m/s)⁻²; N = kg⋅m⋅s⁻²
    Aerodynamic drag per kg in m⁻¹ */
  C: number;
  type: string;
};
export type TowedRollingStock = {
  /** Acceleration in m·s⁻² */
  comfort_acceleration: number;
  /** Acceleration in m·s⁻² */
  const_gamma: number;
  id: number;
  /** Ratio 1:1 */
  inertia_coefficient: number;
  label: string;
  /** Length in m */
  length: number;
  locked: boolean;
  /** Mass in kg */
  mass: number;
  /** Velocity in m·s⁻¹ */
  max_speed: number | null;
  name: string;
  railjson_version: string;
  rolling_resistance: RollingResistancePerWeight;
  /** Acceleration in m·s⁻² */
  startup_acceleration: number;
};
export type TowedRollingStockForm = {
  /** Acceleration in m·s⁻² */
  comfort_acceleration: number;
  /** Acceleration in m·s⁻² */
  const_gamma: number;
  /** Ratio 1:1 */
  inertia_coefficient: number;
  label: string;
  /** Length in m */
  length: number;
  locked: boolean;
  /** Mass in kg */
  mass: number;
  /** Velocity in m·s⁻¹ */
  max_speed?: number | null;
  name: string;
  rolling_resistance: RollingResistancePerWeight;
  /** Acceleration in m·s⁻² */
  startup_acceleration: number;
};
export type TowedRollingStockLockedForm = {
  /** New locked value */
  locked: boolean;
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
    /** The name of the signaling system of the signal */
    signaling_system: string;
    /** The aspects stop being displayed at this time (number of ms since `departure_time`) */
    time_end: number;
    /** The aspects start being displayed at this time (number of ms since `departure_time`) */
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
  electrical_profile_set_id?: number | null;
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
      /** Base simulation time for each train schedule path item.
    The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path) */
      path_item_times_base: number[];
      /** Final simulation time for each train schedule path item.
    The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path) */
      path_item_times_final: number[];
      /** Provisional simulation time for each train schedule path item.
    The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path) */
      path_item_times_provisional: number[];
      status: 'success';
      /** Travel time in ms */
      time: number;
    }
  | (PathfindingNotFound & {
      status: 'pathfinding_not_found';
    })
  | {
      core_error: InternalError;
      status: 'pathfinding_failure';
    }
  | {
      error_type: string;
      status: 'simulation_failed';
    }
  | (PathfindingInputError & {
      status: 'pathfinding_input_error';
    });
export type TrainScheduleForm = TrainScheduleBase & {
  /** Timetable attached to the train schedule */
  timetable_id?: number | null;
};
export type Version = {
  git_describe: string | null;
};
export type WorkScheduleItemForm = {
  end_date_time: string;
  obj_id: string;
  start_date_time: string;
  track_ranges: TrackRange[];
  work_schedule_type: 'CATENARY' | 'TRACK';
};
export type Intersection = {
  /** Distance of the end of the intersection relative to the beginning of the path */
  end: number;
  /** Distance of the beginning of the intersection relative to the beginning of the path */
  start: number;
};
