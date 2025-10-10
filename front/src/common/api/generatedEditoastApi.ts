import { baseEditoastApi as api } from './baseGeneratedApis';
export const addTagTypes = [
  'authz',
  'documents',
  'electrical_profiles',
  'fonts',
  'infra',
  'rolling_stock',
  'delimited_area',
  'pathfinding',
  'routes',
  'layers',
  'timetable',
  'paced_train',
  'train_schedule',
  'etcs_braking_curves',
  'projects',
  'studies',
  'scenarios',
  'rolling_stock_livery',
  'round_trips',
  'search',
  'similar_trains',
  'stdcm',
  'sncf',
  'sprites',
  'stdcm_search_environment',
  'sub_categories',
  'temporary_speed_limits',
  'work_schedules',
  'worker',
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      postAuthzGrants: build.mutation<PostAuthzGrantsApiResponse, PostAuthzGrantsApiArg>({
        query: (queryArg) => ({ url: `/authz/grants`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['authz'],
      }),
      getAuthzMe: build.query<GetAuthzMeApiResponse, GetAuthzMeApiArg>({
        query: () => ({ url: `/authz/me` }),
        providesTags: ['authz'],
      }),
      postAuthzMeGrants: build.mutation<PostAuthzMeGrantsApiResponse, PostAuthzMeGrantsApiArg>({
        query: (queryArg) => ({ url: `/authz/me/grants`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['authz'],
      }),
      getAuthzMeGroups: build.query<GetAuthzMeGroupsApiResponse, GetAuthzMeGroupsApiArg>({
        query: () => ({ url: `/authz/me/groups` }),
        providesTags: ['authz'],
      }),
      postAuthzMePrivileges: build.mutation<
        PostAuthzMePrivilegesApiResponse,
        PostAuthzMePrivilegesApiArg
      >({
        query: (queryArg) => ({ url: `/authz/me/privileges`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['authz'],
      }),
      getAuthzByResourceTypeAndResourceId: build.query<
        GetAuthzByResourceTypeAndResourceIdApiResponse,
        GetAuthzByResourceTypeAndResourceIdApiArg
      >({
        query: (queryArg) => ({
          url: `/authz/${queryArg.resourceType}/${queryArg.resourceId}`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['authz'],
      }),
      postDocuments: build.mutation<PostDocumentsApiResponse, PostDocumentsApiArg>({
        query: (queryArg) => ({
          url: `/documents`,
          method: 'POST',
          body: queryArg.body,
          headers: {
            content_type: queryArg.contentType,
          },
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
          params: {
            name: queryArg.name,
          },
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
      getFontsByFontAndGlyph: build.query<
        GetFontsByFontAndGlyphApiResponse,
        GetFontsByFontAndGlyphApiArg
      >({
        query: (queryArg) => ({ url: `/fonts/${queryArg.font}/${queryArg.glyph}` }),
        providesTags: ['fonts'],
      }),
      getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
        query: () => ({ url: `/health` }),
      }),
      getInfra: build.query<GetInfraApiResponse, GetInfraApiArg>({
        query: (queryArg) => ({
          url: `/infra`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
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
          params: {
            name: queryArg.name,
            generate_data: queryArg.generateData,
          },
        }),
        invalidatesTags: ['infra'],
      }),
      postInfraRefresh: build.mutation<PostInfraRefreshApiResponse, PostInfraRefreshApiArg>({
        query: (queryArg) => ({
          url: `/infra/refresh`,
          method: 'POST',
          params: {
            force: queryArg.force,
            infras: queryArg.infras,
          },
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
      putInfraByInfraId: build.mutation<PutInfraByInfraIdApiResponse, PutInfraByInfraIdApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['infra'],
      }),
      postInfraByInfraId: build.mutation<PostInfraByInfraIdApiResponse, PostInfraByInfraIdApiArg>({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}`,
          method: 'POST',
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
          params: {
            name: queryArg.name,
          },
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
      postInfraByInfraIdLock: build.mutation<
        PostInfraByInfraIdLockApiResponse,
        PostInfraByInfraIdLockApiArg
      >({
        query: (queryArg) => ({ url: `/infra/${queryArg.infraId}/lock`, method: 'POST' }),
        invalidatesTags: ['infra'],
      }),
      postInfraByInfraIdMatchOperationalPoints: build.query<
        PostInfraByInfraIdMatchOperationalPointsApiResponse,
        PostInfraByInfraIdMatchOperationalPointsApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/match_operational_points`,
          method: 'POST',
          body: queryArg.body,
        }),
        providesTags: ['infra'],
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
      getInfraByInfraIdObjectsAndObjectTypeIds: build.query<
        GetInfraByInfraIdObjectsAndObjectTypeIdsApiResponse,
        GetInfraByInfraIdObjectsAndObjectTypeIdsApiArg
      >({
        query: (queryArg) => ({
          url: `/infra/${queryArg.infraId}/objects/${queryArg.objectType}/ids`,
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
          params: {
            number: queryArg['number'],
          },
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
          params: {
            routes: queryArg.routes,
          },
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
          params: {
            include_rolling_stock_modes: queryArg.includeRollingStockModes,
          },
        }),
        providesTags: ['infra'],
      }),
      getLayersLayerByLayerSlugMvtAndViewSlug: build.query<
        GetLayersLayerByLayerSlugMvtAndViewSlugApiResponse,
        GetLayersLayerByLayerSlugMvtAndViewSlugApiArg
      >({
        query: (queryArg) => ({
          url: `/layers/layer/${queryArg.layerSlug}/mvt/${queryArg.viewSlug}`,
          params: {
            infra: queryArg.infra,
          },
        }),
        providesTags: ['layers'],
      }),
      getLayersTileByLayerSlugAndViewSlugZXY: build.query<
        GetLayersTileByLayerSlugAndViewSlugZXYApiResponse,
        GetLayersTileByLayerSlugAndViewSlugZXYApiArg
      >({
        query: (queryArg) => ({
          url: `/layers/tile/${queryArg.layerSlug}/${queryArg.viewSlug}/${queryArg.z}/${queryArg.x}/${queryArg.y}`,
          params: {
            infra: queryArg.infra,
          },
        }),
        providesTags: ['layers'],
      }),
      getLightRollingStock: build.query<
        GetLightRollingStockApiResponse,
        GetLightRollingStockApiArg
      >({
        query: (queryArg) => ({
          url: `/light_rolling_stock`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
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
      deletePacedTrain: build.mutation<DeletePacedTrainApiResponse, DeletePacedTrainApiArg>({
        query: (queryArg) => ({ url: `/paced_train`, method: 'DELETE', body: queryArg.body }),
        invalidatesTags: ['timetable', 'paced_train'],
      }),
      postPacedTrainOccupancyBlocks: build.query<
        PostPacedTrainOccupancyBlocksApiResponse,
        PostPacedTrainOccupancyBlocksApiArg
      >({
        query: (queryArg) => ({
          url: `/paced_train/occupancy_blocks`,
          method: 'POST',
          body: queryArg.occupancyBlockForm,
        }),
        providesTags: ['paced_train'],
      }),
      postPacedTrainProjectPath: build.query<
        PostPacedTrainProjectPathApiResponse,
        PostPacedTrainProjectPathApiArg
      >({
        query: (queryArg) => ({
          url: `/paced_train/project_path`,
          method: 'POST',
          body: queryArg.projectPathForm,
        }),
        providesTags: ['paced_train'],
      }),
      postPacedTrainProjectPathOp: build.query<
        PostPacedTrainProjectPathOpApiResponse,
        PostPacedTrainProjectPathOpApiArg
      >({
        query: (queryArg) => ({
          url: `/paced_train/project_path_op`,
          method: 'POST',
          body: queryArg.body,
        }),
        providesTags: ['train_schedule'],
      }),
      postPacedTrainSimulationSummary: build.query<
        PostPacedTrainSimulationSummaryApiResponse,
        PostPacedTrainSimulationSummaryApiArg
      >({
        query: (queryArg) => ({
          url: `/paced_train/simulation_summary`,
          method: 'POST',
          body: queryArg.body,
        }),
        providesTags: ['paced_train'],
      }),
      postPacedTrainTrackOccupancy: build.mutation<
        PostPacedTrainTrackOccupancyApiResponse,
        PostPacedTrainTrackOccupancyApiArg
      >({
        query: (queryArg) => ({
          url: `/paced_train/track_occupancy`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['paced_train'],
      }),
      getPacedTrainById: build.query<GetPacedTrainByIdApiResponse, GetPacedTrainByIdApiArg>({
        query: (queryArg) => ({ url: `/paced_train/${queryArg.id}` }),
        providesTags: ['timetable', 'paced_train'],
      }),
      putPacedTrainById: build.mutation<PutPacedTrainByIdApiResponse, PutPacedTrainByIdApiArg>({
        query: (queryArg) => ({
          url: `/paced_train/${queryArg.id}`,
          method: 'PUT',
          body: queryArg.body,
        }),
        invalidatesTags: ['timetable', 'paced_train'],
      }),
      getPacedTrainByIdEtcsBrakingCurves: build.query<
        GetPacedTrainByIdEtcsBrakingCurvesApiResponse,
        GetPacedTrainByIdEtcsBrakingCurvesApiArg
      >({
        query: (queryArg) => ({
          url: `/paced_train/${queryArg.id}/etcs_braking_curves`,
          params: {
            infra_id: queryArg.infraId,
            electrical_profile_set_id: queryArg.electricalProfileSetId,
            exception_key: queryArg.exceptionKey,
          },
        }),
        providesTags: ['paced_train', 'etcs_braking_curves'],
      }),
      getPacedTrainByIdPath: build.query<
        GetPacedTrainByIdPathApiResponse,
        GetPacedTrainByIdPathApiArg
      >({
        query: (queryArg) => ({
          url: `/paced_train/${queryArg.id}/path`,
          params: {
            infra_id: queryArg.infraId,
            exception_key: queryArg.exceptionKey,
          },
        }),
        providesTags: ['paced_train', 'pathfinding'],
      }),
      getPacedTrainByIdSimulation: build.query<
        GetPacedTrainByIdSimulationApiResponse,
        GetPacedTrainByIdSimulationApiArg
      >({
        query: (queryArg) => ({
          url: `/paced_train/${queryArg.id}/simulation`,
          params: {
            infra_id: queryArg.infraId,
            electrical_profile_set_id: queryArg.electricalProfileSetId,
            exception_key: queryArg.exceptionKey,
          },
        }),
        providesTags: ['paced_train'],
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
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
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
          body: queryArg.macroNodeBatchForm,
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
      getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotes: build.query<
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesApiResponse,
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_notes`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['scenarios'],
      }),
      postProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotes: build.mutation<
        PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesApiResponse,
        PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_notes`,
          method: 'POST',
          body: queryArg.macroNoteBatchForm,
        }),
        invalidatesTags: ['scenarios'],
      }),
      getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteId: build.query<
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiResponse,
        GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_notes/${queryArg.noteId}`,
        }),
        providesTags: ['scenarios'],
      }),
      putProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteId: build.mutation<
        PutProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiResponse,
        PutProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_notes/${queryArg.noteId}`,
          method: 'PUT',
          body: queryArg.macroNoteForm,
        }),
        invalidatesTags: ['scenarios'],
      }),
      deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteId: build.mutation<
        DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiResponse,
        DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiArg
      >({
        query: (queryArg) => ({
          url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/macro_notes/${queryArg.noteId}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['scenarios'],
      }),
      postRollingStock: build.mutation<PostRollingStockApiResponse, PostRollingStockApiArg>({
        query: (queryArg) => ({
          url: `/rolling_stock`,
          method: 'POST',
          body: queryArg.rollingStockForm,
          params: {
            locked: queryArg.locked,
          },
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
      putRollingStockByRollingStockId: build.mutation<
        PutRollingStockByRollingStockIdApiResponse,
        PutRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.rollingStockId}`,
          method: 'PUT',
          body: queryArg.rollingStockForm,
        }),
        invalidatesTags: ['rolling_stock'],
      }),
      deleteRollingStockByRollingStockId: build.mutation<
        DeleteRollingStockByRollingStockIdApiResponse,
        DeleteRollingStockByRollingStockIdApiArg
      >({
        query: (queryArg) => ({
          url: `/rolling_stock/${queryArg.rollingStockId}`,
          method: 'DELETE',
          params: {
            force: queryArg.force,
          },
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
      postRoundTripsPacedTrains: build.mutation<
        PostRoundTripsPacedTrainsApiResponse,
        PostRoundTripsPacedTrainsApiArg
      >({
        query: (queryArg) => ({
          url: `/round_trips/paced_trains`,
          method: 'POST',
          body: queryArg.roundTrips,
        }),
        invalidatesTags: ['round_trips'],
      }),
      postRoundTripsPacedTrainsDelete: build.mutation<
        PostRoundTripsPacedTrainsDeleteApiResponse,
        PostRoundTripsPacedTrainsDeleteApiArg
      >({
        query: (queryArg) => ({
          url: `/round_trips/paced_trains/delete`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['round_trips'],
      }),
      postRoundTripsTrainSchedules: build.mutation<
        PostRoundTripsTrainSchedulesApiResponse,
        PostRoundTripsTrainSchedulesApiArg
      >({
        query: (queryArg) => ({
          url: `/round_trips/train_schedules`,
          method: 'POST',
          body: queryArg.roundTrips,
        }),
        invalidatesTags: ['round_trips'],
      }),
      postRoundTripsTrainSchedulesDelete: build.mutation<
        PostRoundTripsTrainSchedulesDeleteApiResponse,
        PostRoundTripsTrainSchedulesDeleteApiArg
      >({
        query: (queryArg) => ({
          url: `/round_trips/train_schedules/delete`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['round_trips'],
      }),
      postSearch: build.mutation<PostSearchApiResponse, PostSearchApiArg>({
        query: (queryArg) => ({
          url: `/search`,
          method: 'POST',
          body: queryArg.searchPayload,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        invalidatesTags: ['search'],
      }),
      postSimilarTrains: build.mutation<PostSimilarTrainsApiResponse, PostSimilarTrainsApiArg>({
        query: (queryArg) => ({ url: `/similar_trains`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['similar_trains', 'stdcm', 'sncf'],
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
      getStdcmSearchEnvironmentList: build.query<
        GetStdcmSearchEnvironmentListApiResponse,
        GetStdcmSearchEnvironmentListApiArg
      >({
        query: (queryArg) => ({
          url: `/stdcm/search_environment/list`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['stdcm_search_environment'],
      }),
      deleteStdcmSearchEnvironmentByEnvId: build.mutation<
        DeleteStdcmSearchEnvironmentByEnvIdApiResponse,
        DeleteStdcmSearchEnvironmentByEnvIdApiArg
      >({
        query: (queryArg) => ({
          url: `/stdcm/search_environment/${queryArg.envId}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['stdcm_search_environment'],
      }),
      getSubCategory: build.query<GetSubCategoryApiResponse, GetSubCategoryApiArg>({
        query: (queryArg) => ({
          url: `/sub_category`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['sub_categories'],
      }),
      postSubCategory: build.mutation<PostSubCategoryApiResponse, PostSubCategoryApiArg>({
        query: (queryArg) => ({ url: `/sub_category`, method: 'POST', body: queryArg.body }),
        invalidatesTags: ['sub_categories'],
      }),
      deleteSubCategoryByCode: build.mutation<
        DeleteSubCategoryByCodeApiResponse,
        DeleteSubCategoryByCodeApiArg
      >({
        query: (queryArg) => ({ url: `/sub_category/${queryArg.code}`, method: 'DELETE' }),
        invalidatesTags: ['sub_categories'],
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
      getTimetableByIdPacedTrains: build.query<
        GetTimetableByIdPacedTrainsApiResponse,
        GetTimetableByIdPacedTrainsApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/paced_trains`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['timetable'],
      }),
      postTimetableByIdPacedTrains: build.mutation<
        PostTimetableByIdPacedTrainsApiResponse,
        PostTimetableByIdPacedTrainsApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/paced_trains`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['timetable', 'paced_train'],
      }),
      getTimetableByIdRequirements: build.query<
        GetTimetableByIdRequirementsApiResponse,
        GetTimetableByIdRequirementsApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/requirements`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
            infra_id: queryArg.infraId,
            electrical_profile_set_id: queryArg.electricalProfileSetId,
          },
        }),
        providesTags: ['timetable'],
      }),
      getTimetableByIdRoundTripsPacedTrains: build.query<
        GetTimetableByIdRoundTripsPacedTrainsApiResponse,
        GetTimetableByIdRoundTripsPacedTrainsApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/round_trips/paced_trains`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['timetable', 'round_trips'],
      }),
      getTimetableByIdRoundTripsTrainSchedules: build.query<
        GetTimetableByIdRoundTripsTrainSchedulesApiResponse,
        GetTimetableByIdRoundTripsTrainSchedulesApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/round_trips/train_schedules`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['timetable', 'round_trips'],
      }),
      postTimetableByIdStdcm: build.mutation<
        PostTimetableByIdStdcmApiResponse,
        PostTimetableByIdStdcmApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/stdcm`,
          method: 'POST',
          body: queryArg.body,
          params: {
            infra: queryArg.infra,
            return_debug_payloads: queryArg.returnDebugPayloads,
          },
        }),
        invalidatesTags: ['stdcm'],
      }),
      getTimetableByIdTrainSchedules: build.query<
        GetTimetableByIdTrainSchedulesApiResponse,
        GetTimetableByIdTrainSchedulesApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/train_schedules`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ['timetable'],
      }),
      postTimetableByIdTrainSchedules: build.mutation<
        PostTimetableByIdTrainSchedulesApiResponse,
        PostTimetableByIdTrainSchedulesApiArg
      >({
        query: (queryArg) => ({
          url: `/timetable/${queryArg.id}/train_schedules`,
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
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
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
          params: {
            locked: queryArg.locked,
          },
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
      putTowedRollingStockByTowedRollingStockId: build.mutation<
        PutTowedRollingStockByTowedRollingStockIdApiResponse,
        PutTowedRollingStockByTowedRollingStockIdApiArg
      >({
        query: (queryArg) => ({
          url: `/towed_rolling_stock/${queryArg.towedRollingStockId}`,
          method: 'PUT',
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
      deleteTrainSchedule: build.mutation<
        DeleteTrainScheduleApiResponse,
        DeleteTrainScheduleApiArg
      >({
        query: (queryArg) => ({ url: `/train_schedule`, method: 'DELETE', body: queryArg.body }),
        invalidatesTags: ['timetable', 'train_schedule'],
      }),
      postTrainScheduleOccupancyBlocks: build.query<
        PostTrainScheduleOccupancyBlocksApiResponse,
        PostTrainScheduleOccupancyBlocksApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/occupancy_blocks`,
          method: 'POST',
          body: queryArg.occupancyBlockForm,
        }),
        providesTags: ['train_schedule'],
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
      postTrainScheduleProjectPathOp: build.query<
        PostTrainScheduleProjectPathOpApiResponse,
        PostTrainScheduleProjectPathOpApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/project_path_op`,
          method: 'POST',
          body: queryArg.body,
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
      postTrainScheduleTrackOccupancy: build.mutation<
        PostTrainScheduleTrackOccupancyApiResponse,
        PostTrainScheduleTrackOccupancyApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/track_occupancy`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['train_schedule'],
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
      getTrainScheduleByIdEtcsBrakingCurves: build.query<
        GetTrainScheduleByIdEtcsBrakingCurvesApiResponse,
        GetTrainScheduleByIdEtcsBrakingCurvesApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/${queryArg.id}/etcs_braking_curves`,
          params: {
            infra_id: queryArg.infraId,
            electrical_profile_set_id: queryArg.electricalProfileSetId,
          },
        }),
        providesTags: ['train_schedule', 'etcs_braking_curves'],
      }),
      getTrainScheduleByIdPath: build.query<
        GetTrainScheduleByIdPathApiResponse,
        GetTrainScheduleByIdPathApiArg
      >({
        query: (queryArg) => ({
          url: `/train_schedule/${queryArg.id}/path`,
          params: {
            infra_id: queryArg.infraId,
          },
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
      postWorkerLoad: build.query<PostWorkerLoadApiResponse, PostWorkerLoadApiArg>({
        query: (queryArg) => ({ url: `/worker_load`, method: 'POST', body: queryArg.body }),
        providesTags: ['worker'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedEditoastApi };
export type PostAuthzGrantsApiResponse = unknown;
export type PostAuthzGrantsApiArg = {
  /** List of new authorization to add or to remove (i.e. grants a resource to a person) */
  body:
    | {
        grant: GrantBody[];
      }
    | {
        revoke: RevokeBody[];
      };
};
export type GetAuthzMeApiResponse = /** status 200 Get the info of the current user */ {
  id: number;
  name: string;
  roles: Role[];
};
export type GetAuthzMeApiArg = void;
export type PostAuthzMeGrantsApiResponse =
  /** status 200 Get grants info of the current user for the given resources in body */ {
    [key: string]: {
      grant: InfraGrant;
      id: number;
    }[];
  };
export type PostAuthzMeGrantsApiArg = {
  /** HashMap of resource type with a list of resource id to get the grants for. If a resource doesn't exist, it will be omitted. */
  body: {
    [key: string]: number[];
  };
};
export type GetAuthzMeGroupsApiResponse = /** status 200 Get the groups of the current user */ {
  id: number;
  name: string;
}[];
export type GetAuthzMeGroupsApiArg = void;
export type PostAuthzMePrivilegesApiResponse =
  /** status 200 The privileges of the user sending the request over each requested resource. */ {
    [key: string]: {
      privileges: InfraPrivilege[];
      resource_id: number;
    }[];
  };
export type PostAuthzMePrivilegesApiArg = {
  /** The resources of which to get the request sender's privileges. If a resource doesn't exist, it will be omitted. */
  body: {
    [key: string]: number[];
  };
};
export type GetAuthzByResourceTypeAndResourceIdApiResponse =
  /** status 200 Get list of user that have a grant on the resource */ {
    stats: PaginationStats;
    subjects: {
      grant: InfraGrant;
      id: number;
      name: string;
      type: SubjectType;
    }[];
  };
export type GetAuthzByResourceTypeAndResourceIdApiArg = {
  resourceType: ResourceType;
  resourceId: number;
  page?: number;
  pageSize?: number;
};
export type PostDocumentsApiResponse =
  /** status 201 The document was created */ NewDocumentResponse;
export type PostDocumentsApiArg = {
  /** The document's content type */
  contentType: string;
  body: string;
};
export type GetDocumentsByDocumentKeyApiResponse = unknown;
export type GetDocumentsByDocumentKeyApiArg = {
  /** The document's key */
  documentKey: number;
};
export type DeleteDocumentsByDocumentKeyApiResponse = unknown;
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
export type DeleteElectricalProfileSetByElectricalProfileSetIdApiResponse = unknown;
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
export type GetFontsByFontAndGlyphApiResponse = unknown;
export type GetFontsByFontAndGlyphApiArg = {
  /** Requested font */
  font: string;
  /** Requested unicode block */
  glyph: string;
};
export type GetHealthApiResponse = unknown;
export type GetHealthApiArg = void;
export type GetInfraApiResponse = /** status 200 All infras, paginated */ PaginationStats & {
  results: Infra[];
};
export type GetInfraApiArg = {
  page?: number;
  pageSize?: number;
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
export type GetInfraByInfraIdApiResponse = /** status 200 The infra */ Infra;
export type GetInfraByInfraIdApiArg = {
  /** An existing infra ID */
  infraId: number;
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
export type PostInfraByInfraIdApiResponse =
  /** status 200 The result of the operations */ InfraObject[];
export type PostInfraByInfraIdApiArg = {
  /** An existing infra ID */
  infraId: number;
  body: Operation[];
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
  pageSize?: number;
  /** Whether the response should include errors or warnings */
  level?: 'warnings' | 'errors' | 'all';
  /** The type of error to filter on */
  errorType?:
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
  /** Filter errors and warnings related to a given object */
  objectId?: string;
};
export type GetInfraByInfraIdLinesAndLineCodeBboxApiResponse =
  /** status 200 The BBox of the line */ BoundingBox;
export type GetInfraByInfraIdLinesAndLineCodeBboxApiArg = {
  /** An existing infra ID */
  infraId: number;
  /** A line code */
  lineCode: number;
};
export type PostInfraByInfraIdLockApiResponse = unknown;
export type PostInfraByInfraIdLockApiArg = {
  /** An existing infra ID */
  infraId: number;
};
export type PostInfraByInfraIdMatchOperationalPointsApiResponse = /** status 200
Take a list of operational point references and return for each of them the list of operational
points that they match on a given infrastructure and a mapping between the track indentifiers of
the returned operational points parts their related track name.
If an input OperationalPointReference contains a track reference, that track reference is also
used to filter out operational points that match the input operational point identifier but do
not match the input track reference (i.e. operational points which do not have any part that
matches the input track reference).
 */ {
  related_operational_points: RelatedOperationalPoint[][];
  track_names: {
    [key: string]: string | null;
  };
};
export type PostInfraByInfraIdMatchOperationalPointsApiArg = {
  /** An existing infra ID */
  infraId: number;
  body: {
    operational_point_references: OperationalPointReference[];
  };
};
export type PostInfraByInfraIdObjectsAndObjectTypeApiResponse =
  /** status 200 The list of objects */ InfraObjectWithGeometry[];
export type PostInfraByInfraIdObjectsAndObjectTypeApiArg = {
  /** An existing infra ID */
  infraId: number;
  objectType: ObjectType;
  body: string[];
};
export type GetInfraByInfraIdObjectsAndObjectTypeIdsApiResponse =
  /** status 200 The list of objects */ {
    ids: string[];
  };
export type GetInfraByInfraIdObjectsAndObjectTypeIdsApiArg = {
  /** An existing infra ID */
  infraId: number;
  objectType: ObjectType;
};
export type PostInfraByInfraIdPathPropertiesApiResponse =
  /** status 200 Path properties */ PathProperties;
export type PostInfraByInfraIdPathPropertiesApiArg = {
  /** The infra id */
  infraId: number;
  pathPropertiesInput: PathPropertiesInput;
};
export type PostInfraByInfraIdPathfindingApiResponse =
  /** status 200 A list of shortest paths between starting and ending track locations */ PathfindingOutput[];
export type PostInfraByInfraIdPathfindingApiArg = {
  /** An existing infra ID */
  infraId: number;
  number?: number;
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
  pageSize?: number;
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
export type DeletePacedTrainApiResponse = unknown;
export type DeletePacedTrainApiArg = {
  body: {
    ids: number[];
  };
};
export type PostPacedTrainOccupancyBlocksApiResponse = /** status 200  */ {
  [key: string]: OccupancyBlocksPacedTrainResult;
};
export type PostPacedTrainOccupancyBlocksApiArg = {
  occupancyBlockForm: OccupancyBlockForm;
};
export type PostPacedTrainProjectPathApiResponse = /** status 200 Project Path Output */ {
  [key: string]: ProjectPathPacedTrainResult;
};
export type PostPacedTrainProjectPathApiArg = {
  projectPathForm: ProjectPathForm;
};
export type PostPacedTrainProjectPathOpApiResponse =
  /** status 200 Project paced trains on a list of operational points. */ {
    [key: string]: ProjectPathPacedTrainResult;
  };
export type PostPacedTrainProjectPathOpApiArg = {
  body: {
    electrical_profile_set_id?: number | null;
    infra_id: number;
    /** Distances between operational points in mm */
    operational_points_distances: number[];
    operational_points_refs: (
      | {
          /** The object id of an operational point */
          operational_point: string;
        }
      | {
          /** An optional secondary code to identify a more specific location */
          secondary_code?: string | null;
          /** The operational point trigram */
          trigram: string;
        }
      | {
          /** An optional secondary code to identify a more specific location */
          secondary_code?: string | null;
          /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
          uic: number;
        }
    )[];
    train_ids: number[];
  };
};
export type PostPacedTrainSimulationSummaryApiResponse =
  /** status 200 Associate each paced train id with its simulation summaries */ {
    [key: string]: PacedTrainSimulationSummaryResult;
  };
export type PostPacedTrainSimulationSummaryApiArg = {
  body: {
    electrical_profile_set_id?: number | null;
    ids: number[];
    infra_id: number;
  };
};
export type PostPacedTrainTrackOccupancyApiResponse =
  /** status 200 Track section occupancy periods for paced trains */ {
    [key: string]: ((
      | {
          index: number;
          type: 'BaseOccurrence';
        }
      | {
          exception_key: string;
          index: number;
          type: 'ModifiedException';
        }
      | {
          exception_key: string;
          type: 'CreatedException';
        }
    ) & {
      duration: string;
      time_begin: string;
    } & {
      paced_train_id: number;
    })[];
  };
export type PostPacedTrainTrackOccupancyApiArg = {
  body: {
    electrical_profile_set_id?: number | null;
    infra_id: number;
    operational_point_id: string;
    paced_train_ids: number[];
  };
};
export type GetPacedTrainByIdApiResponse =
  /** status 200 The requested paced train */ PacedTrainResponse;
export type GetPacedTrainByIdApiArg = {
  id: number;
};
export type PutPacedTrainByIdApiResponse = unknown;
export type PutPacedTrainByIdApiArg = {
  id: number;
  body: TrainSchedule & {
    exceptions: PacedTrainException[];
    paced: {
      /** Time between two occurrences, an ISO 8601 format is expected */
      interval: PositiveDuration;
      /** Duration of the paced train, an ISO 8601 format is expected */
      time_window: PositiveDuration;
    };
  };
};
export type GetPacedTrainByIdEtcsBrakingCurvesApiResponse =
  /** status 200 ETCS Braking Curves Output */ EtcsBrakingCurvesResponse;
export type GetPacedTrainByIdEtcsBrakingCurvesApiArg = {
  id: number;
  infraId: number;
  electricalProfileSetId?: number;
  exceptionKey?: string;
};
export type GetPacedTrainByIdPathApiResponse = /** status 200 The path */ PathfindingResult;
export type GetPacedTrainByIdPathApiArg = {
  id: number;
  infraId: number;
  exceptionKey?: string;
};
export type GetPacedTrainByIdSimulationApiResponse =
  /** status 200 Simulation Output */ SimulationResponse;
export type GetPacedTrainByIdSimulationApiArg = {
  id: number;
  infraId: number;
  electricalProfileSetId?: number;
  exceptionKey?: string;
};
export type GetProjectsApiResponse = /** status 200 The list of projects */ PaginationStats & {
  results: ProjectWithStudies[];
};
export type GetProjectsApiArg = {
  page?: number;
  pageSize?: number;
  ordering?:
    | 'NameAsc'
    | 'NameDesc'
    | 'CreationDateAsc'
    | 'CreationDateDesc'
    | 'LastModifiedDesc'
    | 'LastModifiedAsc';
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
export type DeleteProjectsByProjectIdApiResponse = unknown;
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
  pageSize?: number;
  ordering?:
    | 'NameAsc'
    | 'NameDesc'
    | 'CreationDateAsc'
    | 'CreationDateDesc'
    | 'LastModifiedDesc'
    | 'LastModifiedAsc';
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
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse = unknown;
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
  pageSize?: number;
  ordering?:
    | 'NameAsc'
    | 'NameDesc'
    | 'CreationDateAsc'
    | 'CreationDateDesc'
    | 'LastModifiedDesc'
    | 'LastModifiedAsc';
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
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse = unknown;
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
};
export type PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The scenario was updated successfully */ ScenarioResponse;
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
  pageSize?: number;
};
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiResponse =
  /** status 201 Macro nodes created */ MacroNodeBatchResponse;
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  macroNodeBatchForm: MacroNodeBatchForm;
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
  /** status 200 The updated macro node */ MacroNodeResponse;
export type PutProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  nodeId: number;
  macroNodeForm: MacroNodeForm;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiResponse =
  unknown;
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  nodeId: number;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesApiResponse =
  /** status 200 List of macro notes for the requested scenario */ MacroNoteListResponse;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  page?: number;
  pageSize?: number;
};
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesApiResponse =
  /** status 201 Macro notes created */ MacroNoteBatchResponse;
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  macroNoteBatchForm: MacroNoteBatchForm;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiResponse =
  /** status 200 The requested macro note */ MacroNoteResponse;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  noteId: number;
};
export type PutProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiResponse =
  /** status 200 The updated macro note */ MacroNoteResponse;
export type PutProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  noteId: number;
  macroNoteForm: MacroNoteForm;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiResponse =
  unknown;
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNotesNoteIdApiArg = {
  /** The id of a project */
  projectId: number;
  studyId: number;
  scenarioId: number;
  noteId: number;
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
export type PutRollingStockByRollingStockIdApiResponse =
  /** status 200 The created rolling stock */ RollingStockWithLiveries;
export type PutRollingStockByRollingStockIdApiArg = {
  rollingStockId: number;
  rollingStockForm: RollingStockForm;
};
export type DeleteRollingStockByRollingStockIdApiResponse = unknown;
export type DeleteRollingStockByRollingStockIdApiArg = {
  rollingStockId: number;
  /** force the deletion even if it's used */
  force?: boolean;
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
export type PostRoundTripsPacedTrainsApiResponse = unknown;
export type PostRoundTripsPacedTrainsApiArg = {
  roundTrips: RoundTrips;
};
export type PostRoundTripsPacedTrainsDeleteApiResponse = unknown;
export type PostRoundTripsPacedTrainsDeleteApiArg = {
  /** IDs of paced trains to remove from round trips or one-way. */
  body: number[];
};
export type PostRoundTripsTrainSchedulesApiResponse = unknown;
export type PostRoundTripsTrainSchedulesApiArg = {
  roundTrips: RoundTrips;
};
export type PostRoundTripsTrainSchedulesDeleteApiResponse = unknown;
export type PostRoundTripsTrainSchedulesDeleteApiArg = {
  /** IDs of train schedules to remove from round trips or one-way. */
  body: number[];
};
export type PostSearchApiResponse = /** status 200 The search results */ SearchResultItem[];
export type PostSearchApiArg = {
  page?: number;
  pageSize?: number;
  searchPayload: SearchPayload;
};
export type PostSimilarTrainsApiResponse =
  /** status 200 A combination of reference train identifiers similar to the provided train */ {
    similar_trains: {
      begin: string;
      end: string;
      /** `train` is `None` if no similar train
        was found for the segment; otherwise, it is `Some`. */
      train?: null | {
        start_time: string;
        train_name: string;
      };
    }[];
  };
export type PostSimilarTrainsApiArg = {
  body: {
    infra_id: number;
    rolling_stock: {
      name?: string | null;
      speed_limit_tag?: string | null;
    };
    timetable_id: number;
    waypoints: SimilarTrainWaypoint[];
  };
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
export type GetStdcmSearchEnvironmentApiResponse =
  /** status 200  */ StdcmSearchEnvironmentResponse;
export type GetStdcmSearchEnvironmentApiArg = void;
export type PostStdcmSearchEnvironmentApiResponse = /** status 201  */ StdcmSearchEnvironment;
export type PostStdcmSearchEnvironmentApiArg = {
  stdcmSearchEnvironmentCreateForm: StdcmSearchEnvironmentCreateForm;
};
export type GetStdcmSearchEnvironmentListApiResponse =
  /** status 200 The paginated list of all existing stdcm search environments */ PaginationStats & {
    results: StdcmSearchEnvironmentResponse[];
  };
export type GetStdcmSearchEnvironmentListApiArg = {
  page?: number;
  pageSize?: number;
};
export type DeleteStdcmSearchEnvironmentByEnvIdApiResponse = unknown;
export type DeleteStdcmSearchEnvironmentByEnvIdApiArg = {
  /** An stdcm search environment ID */
  envId: number;
};
export type GetSubCategoryApiResponse =
  /** status 200 The list of sub categories */ SubCategoryPage;
export type GetSubCategoryApiArg = {
  page?: number;
  pageSize?: number;
};
export type PostSubCategoryApiResponse = /** status 200 Create sub categories */ SubCategory[];
export type PostSubCategoryApiArg = {
  body: SubCategory[];
};
export type DeleteSubCategoryByCodeApiResponse = unknown;
export type DeleteSubCategoryByCodeApiArg = {
  code: string;
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
export type DeleteTimetableByIdApiResponse = unknown;
export type DeleteTimetableByIdApiArg = {
  /** A timetable ID */
  id: number;
};
export type GetTimetableByIdConflictsApiResponse = /** status 200 List of conflicts */ Conflict[];
export type GetTimetableByIdConflictsApiArg = {
  /** A timetable ID */
  id: number;
  infraId: number;
  electricalProfileSetId?: number;
};
export type GetTimetableByIdPacedTrainsApiResponse =
  /** status 200 Timetable with paced train ids */ PaginationStats & {
    results: PacedTrainResponse[];
  };
export type GetTimetableByIdPacedTrainsApiArg = {
  /** A timetable ID */
  id: number;
  page?: number;
  pageSize?: number;
};
export type PostTimetableByIdPacedTrainsApiResponse =
  /** status 200 The created paced trains */ PacedTrainResponse[];
export type PostTimetableByIdPacedTrainsApiArg = {
  /** A timetable ID */
  id: number;
  body: PacedTrain[];
};
export type GetTimetableByIdRequirementsApiResponse =
  /** status 200 The paginated list of timetable requirements */ PaginationStats & {
    results: TrainRequirementsById[];
  };
export type GetTimetableByIdRequirementsApiArg = {
  /** A timetable ID */
  id: number;
  page?: number;
  pageSize?: number;
  infraId: number;
  electricalProfileSetId?: number;
};
export type GetTimetableByIdRoundTripsPacedTrainsApiResponse =
  /** status 200  */ PaginationStats & {
    results: RoundTrips;
  };
export type GetTimetableByIdRoundTripsPacedTrainsApiArg = {
  /** A timetable ID */
  id: number;
  page?: number;
  pageSize?: number;
};
export type GetTimetableByIdRoundTripsTrainSchedulesApiResponse =
  /** status 200  */ PaginationStats & {
    results: RoundTrips;
  };
export type GetTimetableByIdRoundTripsTrainSchedulesApiArg = {
  /** A timetable ID */
  id: number;
  page?: number;
  pageSize?: number;
};
export type PostTimetableByIdStdcmApiResponse = /** status 200 The simulation result */
  | {
      core_payload?: null | StdcmRequest;
      departure_time: string;
      pathfinding_result: PathfindingResultSuccess;
      simulation: SimulationResponseSuccess;
      status: 'success';
    }
  | {
      core_payload?: null | StdcmRequest;
      status: 'path_not_found';
    }
  | {
      core_payload?: null | StdcmRequest;
      error: SimulationResponse;
      status: 'preprocessing_simulation_error';
    };
export type PostTimetableByIdStdcmApiArg = {
  /** timetable_id */
  id: number;
  /** The infra id */
  infra: number;
  /** If true, extra payloads are returned to help with debugging */
  returnDebugPayloads?: boolean | null;
  body: {
    comfort: Comfort;
    electrical_profile_set_id?: number | null;
    loading_gauge_type?: null | LoadingGaugeType;
    /** Can be a percentage `X%`, a time in minutes per 100 kilometer `Xmin/100km` */
    margin?: string | null;
    /**  Maximum speed of the consist in km/h
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
    /**  Total length of the consist in meters
        Length in m */
    total_length?: number | null;
    /**  Total mass of the consist
        Mass in kg */
    total_mass?: number | null;
    towed_rolling_stock_id?: number | null;
    work_schedule_group_id?: number | null;
  };
};
export type GetTimetableByIdTrainSchedulesApiResponse =
  /** status 200 Timetable with train schedules ids */ PaginationStats & {
    results: TrainScheduleResponse[];
  };
export type GetTimetableByIdTrainSchedulesApiArg = {
  /** A timetable ID */
  id: number;
  page?: number;
  pageSize?: number;
};
export type PostTimetableByIdTrainSchedulesApiResponse =
  /** status 200 The created train schedules */ TrainScheduleResponse[];
export type PostTimetableByIdTrainSchedulesApiArg = {
  /** A timetable ID */
  id: number;
  body: TrainSchedule[];
};
export type GetTowedRollingStockApiResponse = /** status 200  */ PaginationStats & {
  results: TowedRollingStock[];
};
export type GetTowedRollingStockApiArg = {
  page?: number;
  pageSize?: number;
};
export type PostTowedRollingStockApiResponse =
  /** status 200 The created towed rolling stock */ TowedRollingStock;
export type PostTowedRollingStockApiArg = {
  locked?: boolean;
  towedRollingStockForm: TowedRollingStockForm;
};
export type GetTowedRollingStockByTowedRollingStockIdApiResponse =
  /** status 200 The requested towed rolling stock */ TowedRollingStock;
export type GetTowedRollingStockByTowedRollingStockIdApiArg = {
  towedRollingStockId: number;
};
export type PutTowedRollingStockByTowedRollingStockIdApiResponse =
  /** status 200 The modified towed rolling stock */ TowedRollingStock;
export type PutTowedRollingStockByTowedRollingStockIdApiArg = {
  towedRollingStockId: number;
  towedRollingStockForm: TowedRollingStockForm;
};
export type PatchTowedRollingStockByTowedRollingStockIdLockedApiResponse = unknown;
export type PatchTowedRollingStockByTowedRollingStockIdLockedApiArg = {
  towedRollingStockId: number;
  towedRollingStockLockedForm: TowedRollingStockLockedForm;
};
export type DeleteTrainScheduleApiResponse = unknown;
export type DeleteTrainScheduleApiArg = {
  body: {
    ids: number[];
  };
};
export type PostTrainScheduleOccupancyBlocksApiResponse = /** status 200  */ {
  [key: string]: SignalUpdate[];
};
export type PostTrainScheduleOccupancyBlocksApiArg = {
  occupancyBlockForm: OccupancyBlockForm;
};
export type PostTrainScheduleProjectPathApiResponse = /** status 200 Project Path Output */ {
  [key: string]: SpaceTimeCurve[];
};
export type PostTrainScheduleProjectPathApiArg = {
  projectPathForm: ProjectPathForm;
};
export type PostTrainScheduleProjectPathOpApiResponse =
  /** status 200 Project train schedules on a list of operational points. */ {
    [key: string]: SpaceTimeCurve[];
  };
export type PostTrainScheduleProjectPathOpApiArg = {
  body: {
    electrical_profile_set_id?: number | null;
    infra_id: number;
    /** Distances between operational points in mm */
    operational_points_distances: number[];
    operational_points_refs: (
      | {
          /** The object id of an operational point */
          operational_point: string;
        }
      | {
          /** An optional secondary code to identify a more specific location */
          secondary_code?: string | null;
          /** The operational point trigram */
          trigram: string;
        }
      | {
          /** An optional secondary code to identify a more specific location */
          secondary_code?: string | null;
          /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
          uic: number;
        }
    )[];
    train_ids: number[];
  };
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
export type PostTrainScheduleTrackOccupancyApiResponse =
  /** status 200 Track section occupancy periods for a set of train schedules */ {
    [key: string]: ({
      duration: string;
      time_begin: string;
    } & {
      train_schedule_id: number;
    })[];
  };
export type PostTrainScheduleTrackOccupancyApiArg = {
  body: {
    electrical_profile_set_id?: number | null;
    infra_id: number;
    operational_point_id: string;
    train_schedule_ids: number[];
  };
};
export type GetTrainScheduleByIdApiResponse =
  /** status 200 The train schedule */ TrainScheduleResponse;
export type GetTrainScheduleByIdApiArg = {
  /** A train schedule ID */
  id: number;
};
export type PutTrainScheduleByIdApiResponse =
  /** status 200 The train schedule have been updated */ TrainScheduleResponse;
export type PutTrainScheduleByIdApiArg = {
  /** A train schedule ID */
  id: number;
  trainScheduleForm: TrainScheduleForm;
};
export type GetTrainScheduleByIdEtcsBrakingCurvesApiResponse =
  /** status 200 ETCS Braking Curves Output */ EtcsBrakingCurvesResponse;
export type GetTrainScheduleByIdEtcsBrakingCurvesApiArg = {
  /** A train schedule ID */
  id: number;
  infraId: number;
  electricalProfileSetId?: number;
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
  /** status 200 The existing work schedule group ids */ number[];
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
  pageSize?: number;
  /** A work schedule group ID */
  id: number;
  ordering?:
    | 'NameAsc'
    | 'NameDesc'
    | 'CreationDateAsc'
    | 'CreationDateDesc'
    | 'LastModifiedDesc'
    | 'LastModifiedAsc';
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
  /** status 200 Returns a list of work schedules whose track ranges intersect the given path */ {
    /** The date and time when the work schedule ends. */
    end_date_time: string;
    /** a list of intervals `(a, b)` that represent the projections of the work schedule track ranges:
    - `a` is the distance from the beginning of the path to the beginning of the track range
    - `b` is the distance from the beginning of the path to the end of the track range */
    path_position_ranges: Intersection[];
    /** The date and time when the work schedule takes effect. */
    start_date_time: string;
    /** The type of the work schedule. */
    type: 'CATENARY' | 'TRACK';
  }[];
export type PostWorkSchedulesProjectPathApiArg = {
  body: {
    path_track_ranges: CoreTrackRange[];
    work_schedule_group_id: number;
  };
};
export type PostWorkerLoadApiResponse = /** status 200 The worker status */ WorkerStatus;
export type PostWorkerLoadApiArg = {
  body: {
    /** The infra id of the worker to load */
    infra_id: number;
    /** The timetable id to load, if any */
    timetable_id?: number | null;
  };
};
export type InfraGrant = 'READER' | 'WRITER' | 'OWNER';
export type ResourceType = 'infra';
export type GrantBody = {
  grant: InfraGrant;
  resource_id: number;
  resource_type: ResourceType;
  subject_id: number;
};
export type RevokeBody = {
  resource_id: number;
  resource_type: ResourceType;
  subject_id: number;
};
export type Role = 'Admin' | 'Stdcm' | 'OperationalStudies';
export type InfraPrivilege =
  | 'can_read'
  | 'can_share_read'
  | 'can_write'
  | 'can_share_write'
  | 'can_delete'
  | 'can_share_ownership';
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
export type SubjectType = 'User' | 'Group';
export type NewDocumentResponse = {
  document_key: number;
};
export type LightElectricalProfileSet = {
  id: number;
  name: string;
};
export type LevelValues = string[];
export type TrackRange = {
  begin: number;
  end: number;
  track: string;
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
  generated_version: number | null;
  id: number;
  locked: boolean;
  modified: string;
  name: string;
  railjson_version: string;
  version: number;
};
export type BufferStop = {
  extensions?: {
    sncf?: null | {
      kp: string;
    };
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
export type Direction = 'START_TO_STOP' | 'STOP_TO_START';
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
    neutral_sncf?: null | {
      announcement: Sign[];
      end: Sign[];
      exe: Sign;
      rev: Sign[];
    };
  };
  id: string;
  lower_pantograph: boolean;
  track_ranges: DirectionalTrackRange[];
};
export type OperationalPointPart = {
  extensions?: {
    sncf?: null | {
      kp: string;
    };
  };
  position: number;
  track: string;
};
export type OperationalPoint = {
  extensions?: {
    identifier?: null | {
      name: string;
      uic: number;
    };
    sncf?: null | {
      ch: string;
      ch_long_label: string;
      ch_short_label: string;
      ci: number;
      trigram: string;
    };
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
    sncf?: null | {
      kp: string;
      label: string;
      side?: Side;
    };
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
    psl_sncf?: null | {
      announcement: Sign[];
      r: Sign[];
      z: Sign;
    };
  };
  id: string;
  on_routes?: string[] | null;
  speed_limit?: null | number;
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
    sncf?: null | {
      label: string;
    };
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
    sncf?: null | {
      line_code: number;
      line_name: string;
      track_name: string;
      track_number: number;
    };
    source?: null | {
      id: string;
      name: string;
    };
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
export type BoundingBox = {
  max_lat: number;
  max_lon: number;
  min_lat: number;
  min_lon: number;
};
export type GeoJsonPoint = {
  coordinates: GeoJsonPointValue;
  type: 'Point';
};
export type RelatedOperationalPointPart = OperationalPointPart & {
  geo?: null | GeoJsonPoint;
};
export type RelatedOperationalPoint = {
  extensions?: {
    identifier?: null | {
      name: string;
      uic: number;
    };
    sncf?: null | {
      ch: string;
      ch_long_label: string;
      ch_short_label: string;
      ci: number;
      trigram: string;
    };
  };
  geo?: null | GeoJsonPoint;
  id: string;
  parts: RelatedOperationalPointPart[];
  weight?: number | null;
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
      /** The object id of an operational point */
      operational_point: string;
    }
  | {
      /** An optional secondary code to identify a more specific location */
      secondary_code?: string | null;
      /** The operational point trigram */
      trigram: string;
    }
  | {
      /** An optional secondary code to identify a more specific location */
      secondary_code?: string | null;
      /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
      uic: number;
    }
) & {
  track_reference?: null | TrackReference;
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
  identifier?: null | {
    name: string;
    uic: number;
  };
  sncf?: null | {
    ch: string;
    ch_long_label: string;
    ch_short_label: string;
    ci: number;
    trigram: string;
  };
};
export type PathProperties = {
  /** Curves along the path */
  curves: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: number[];
  };
  /** Electrification modes and neutral section along the path */
  electrifications: {
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
  };
  /** Geometry of the path */
  geometry: GeoJsonLineString;
  /** Operational points along the path */
  operational_points: {
    /** Extensions associated to the operational point */
    extensions?: OperationalPointExtensions;
    /** Id of the operational point */
    id: string;
    /** The part along the path */
    part: OperationalPointPart;
    /** Distance from the beginning of the path in mm */
    position: number;
    /** Importance of the operational point */
    weight: number | null;
  }[];
  /** Slopes along the path */
  slopes: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: number[];
  };
  /** Zones along the path */
  zones: {
    /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
    boundaries: number[];
    /** List of `n+1` values associated to the ranges */
    values: string[];
  };
};
export type CoreTrackRange = {
  /** The beginning of the range in mm. */
  begin: number;
  /** The direction of the range. */
  direction: Direction;
  /** The end of the range in mm. */
  end: number;
  /** The track section identifier. */
  track_section: string;
};
export type PathPropertiesInput = {
  /** List of track sections */
  track_section_ranges: CoreTrackRange[];
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
export type ObjectRange = {
  /** The beginning of the range in mm. */
  begin: number;
  /** The end of the range in mm. */
  end: number;
  /** The object identifier. */
  id: string;
};
export type TrainPath = {
  /** Block ranges, in order. */
  blocks: ObjectRange[];
  /** Route ranges, in order. */
  routes: ObjectRange[];
  /** Track section ranges, in order. */
  track_section_ranges: CoreTrackRange[];
};
export type PathfindingResultSuccess = {
  /** Length of the path in mm */
  length: number;
  /** Full description of the path data */
  path: TrainPath;
  /** The path offset in mm of each path item given as input of the pathfinding
    The first value is always `0` (beginning of the path) and the last one is always equal to the `length` of the path in mm */
  path_item_positions: number[];
};
export type TrackOffset = {
  /** Offset in mm */
  offset: number;
  /** Track section identifier */
  track: string;
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
      track_section_ranges: CoreTrackRange[];
    }
  | {
      error_type: 'not_found_in_routes';
      length: number;
      track_section_ranges: CoreTrackRange[];
    }
  | {
      error_type: 'not_found_in_tracks';
    }
  | {
      error_type: 'incompatible_constraints';
      incompatible_constraints: IncompatibleConstraints;
      relaxed_constraints_path: PathfindingResultSuccess;
    };
export type InternalError = {
  context: {
    [key: string]: unknown;
  };
  message: string;
  status?: number;
  type: string;
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
  /** The loading gauge of the rolling stock */
  rolling_stock_loading_gauge: LoadingGaugeType;
  /** Rolling stock maximum speed */
  rolling_stock_maximum_speed: number;
  /** List of supported electrification modes.
    Empty if does not support any electrification */
  rolling_stock_supported_electrifications: string[];
  /** List of supported signaling systems */
  rolling_stock_supported_signaling_systems: string[];
  /** Speed limit tag, used to estimate the travel time */
  speed_limit_tag?: string | null;
};
export type RoutePath = {
  switches_directions: {
    group_id: string;
    switch_id: string;
  }[];
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
  refill_law: null | RefillLaw;
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
  /** A_brake_emergency: the emergency deceleration curve (values > 0 m/s²) */
  gamma_emergency: SpeedIntervalValueCurve;
  /** A_brake_normal_service: the normal service deceleration curve used to compute guidance curve (values > 0 m/s²) */
  gamma_normal_service: SpeedIntervalValueCurve;
  /** A_brake_service: the full service deceleration curve (values > 0 m/s²) */
  gamma_service: SpeedIntervalValueCurve;
  /** Kdry_rst: the rolling stock deceleration correction factors for dry rails
    Boundaries should be the same as gammaEmergency
    Values (no unit) should be contained in [0, 1] */
  k_dry: SpeedIntervalValueCurve;
  /** Kn-: the correction acceleration factor on normal service deceleration in negative gradients
    Values (in m/s²) should be contained in [0, 10] */
  k_n_neg: SpeedIntervalValueCurve;
  /** Kn+: the correction acceleration factor on normal service deceleration in positive gradients
    Values (in m/s²) should be contained in [0, 10] */
  k_n_pos: SpeedIntervalValueCurve;
  /** Kwet_rst: the rolling stock deceleration correction factors for wet rails
    Boundaries should be the same as gammaEmergency
    Values (no unit) should be contained in [0, 1] */
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
export type TrainMainCategory =
  | 'HIGH_SPEED_TRAIN'
  | 'INTERCITY_TRAIN'
  | 'REGIONAL_TRAIN'
  | 'NIGHT_TRAIN'
  | 'COMMUTER_TRAIN'
  | 'FREIGHT_TRAIN'
  | 'FAST_FREIGHT_TRAIN'
  | 'TRAM_TRAIN'
  | 'TOURISTIC_TRAIN'
  | 'WORK_TRAIN';
export type TrainMainCategories = TrainMainCategory[];
export type RollingResistance = {
  /**  Solid friction
    Solid Friction in N */
  A: number;
  /**  Viscosity friction in N·(m/s)⁻¹; N = kg⋅m⋅s⁻²
    Viscosity friction in kg·s⁻¹ */
  B: number;
  /**  Aerodynamic drag in N·(m/s)⁻²; N = kg⋅m⋅s⁻²
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
  etcs_brake_params: null | EtcsBrakeParams;
  id: number;
  inertia_coefficient: number;
  /** Length in m */
  length: number;
  loading_gauge: LoadingGaugeType;
  locked: boolean;
  /** Mass in kg */
  mass: number;
  /** Velocity in m·s⁻¹ */
  max_speed: number;
  metadata: null | RollingStockMetadata;
  name: string;
  other_categories: TrainMainCategories;
  power_restrictions: {
    [key: string]: string;
  };
  primary_category: TrainMainCategory;
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
export type SignalUpdate = {
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
};
export type OccupancyBlocksPacedTrainResult = {
  /** Exceptions whose blocks are different from the paced train */
  exceptions: {
    [key: string]: SignalUpdate[];
  };
  /** Paced train */
  paced_train: SignalUpdate[];
};
export type OccupancyBlockForm = {
  electrical_profile_set_id?: number | null;
  ids: number[];
  infra_id: number;
  path: TrainPath;
};
export type SpaceTimeCurve = {
  /** List of positions of a train in mm
    Both positions and times must have the same length */
  positions: number[];
  /** List of times in ms since `departure_time` associated to a position */
  times: number[];
};
export type ProjectPathPacedTrainResult = {
  /** Exceptions whose projection is different from the paced train */
  exceptions: {
    [key: string]: SpaceTimeCurve[];
  };
  /** Paced train */
  paced_train: SpaceTimeCurve[];
};
export type ProjectPathForm = {
  electrical_profile_set_id?: number | null;
  ids: number[];
  infra_id: number;
  track_section_ranges: {
    /** The beginning of the range in mm. */
    begin: number;
    /** The direction of the range. */
    direction: Direction;
    /** The end of the range in mm. */
    end: number;
    /** The track section identifier. */
    track_section: string;
  }[];
};
export type SimulationSummaryResult =
  | {
      /** Total energy consumption of a train in kWh */
      energy_consumption: number;
      /** Length of a path in mm */
      length: number;
      /** The path offset in mm of each path item given as input of the pathfinding
    The first value is always `0` (beginning of the path) and the last one is always equal to the `length` of the path in mm */
      path_item_positions: number[];
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
export type PacedTrainSimulationSummaryResult = {
  /** The key is the `exception_key` */
  exceptions: {
    [key: string]: SimulationSummaryResult;
  };
  paced_train: SimulationSummaryResult;
};
export type TrainCategory =
  | {
      main_category: TrainMainCategory;
    }
  | {
      sub_category_code: string;
    };
export type Comfort = 'STANDARD' | 'AIR_CONDITIONING' | 'HEATING';
export type Distribution = 'STANDARD' | 'MARECO';
export type PositiveDuration = string;
export type ReceptionSignal = 'OPEN' | 'STOP' | 'SHORT_SLIP_STOP';
export type TrainSchedule = {
  category?: null | TrainCategory;
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
    use_speed_limits_for_simulation?: boolean;
  };
  path: (PathItemLocation & {
    /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
    deleted?: boolean;
    /** The unique identifier of the path item.
        This is used to reference path items in the train schedule. */
    id: string;
  })[];
  power_restrictions?: {
    from: string;
    to: string;
    value: string;
  }[];
  rolling_stock_name: string;
  schedule?: {
    arrival?: null | PositiveDuration;
    /** Position on the path of the schedule item. */
    at: string;
    /** Whether the schedule item is locked (only for display purposes) */
    locked?: boolean;
    reception_signal?: ReceptionSignal;
    stop_for?: null | PositiveDuration;
  }[];
  speed_limit_tag?: null | string;
  start_time: string;
  train_name: string;
};
export type ConstraintDistributionChangeGroup = {
  value: Distribution;
};
export type InitialSpeedChangeGroup = {
  value: number;
};
export type LabelsChangeGroup = {
  value: string[];
};
export type TrainScheduleOptions = {
  use_electrical_profiles?: boolean;
  use_speed_limits_for_simulation?: boolean;
};
export type OptionsChangeGroup = {
  value: TrainScheduleOptions;
};
export type Margins = {
  boundaries: string[];
  /** The values of the margins. Must contains one more element than the boundaries
    Can be a percentage `X%` or a time in minutes per 100 kilometer `Xmin/100km` */
  values: string[];
};
export type PathItem = PathItemLocation & {
  /** Metadata given to mark a point as wishing to be deleted by the user.
    It's useful for soft deleting the point (waiting to fix / remove all references)
    If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  /** The unique identifier of the path item.
    This is used to reference path items in the train schedule. */
  id: string;
};
export type PowerRestrictionItem = {
  from: string;
  to: string;
  value: string;
};
export type ScheduleItem = {
  arrival?: null | PositiveDuration;
  /** Position on the path of the schedule item. */
  at: string;
  /** Whether the schedule item is locked (only for display purposes) */
  locked?: boolean;
  reception_signal?: ReceptionSignal;
  stop_for?: null | PositiveDuration;
};
export type PathAndScheduleChangeGroup = {
  margins: Margins;
  path: PathItem[];
  power_restrictions: PowerRestrictionItem[];
  schedule: ScheduleItem[];
};
export type RollingStockChangeGroup = {
  comfort: Comfort;
  rolling_stock_name: string;
};
export type RollingStockCategoryChangeGroup = {
  value?: null | TrainCategory;
};
export type SpeedLimitTagChangeGroup = {
  value?: null | string;
};
export type StartTimeChangeGroup = {
  value: string;
};
export type TrainNameChangeGroup = {
  value: string;
};
export type PacedTrainException = {
  occurrence_index?: number;
} & {
  constraint_distribution?: ConstraintDistributionChangeGroup;
  disabled?: boolean;
  initial_speed?: InitialSpeedChangeGroup;
  /** Unique key for the exception within the paced train, required and generated by the frontend. */
  key: string;
  labels?: LabelsChangeGroup;
  options?: OptionsChangeGroup;
  path_and_schedule?: PathAndScheduleChangeGroup;
  rolling_stock?: RollingStockChangeGroup;
  rolling_stock_category?: RollingStockCategoryChangeGroup;
  speed_limit_tag?: SpeedLimitTagChangeGroup;
  start_time?: StartTimeChangeGroup;
  train_name?: TrainNameChangeGroup;
};
export type PacedTrain = TrainSchedule & {
  exceptions: PacedTrainException[];
  paced: {
    /** Time between two occurrences, an ISO 8601 format is expected */
    interval: PositiveDuration;
    /** Duration of the paced train, an ISO 8601 format is expected */
    time_window: PositiveDuration;
  };
};
export type PacedTrainResponse = PacedTrain & {
  id: number;
  timetable_id: number;
};
export type EtcsConflictCurves = {
  conflict_type: 'Spacing' | 'Routing';
  guidance: {
    /** List of positions of a train
        Both positions (in mm) and times (in ms) must have the same length */
    positions: number[];
    /** List of speeds (in m/s) associated to a position */
    speeds: number[];
    /** List of times (in ms) associated to a position */
    times: number[];
  };
  indication: {
    /** List of positions of a train
        Both positions (in mm) and times (in ms) must have the same length */
    positions: number[];
    /** List of speeds (in m/s) associated to a position */
    speeds: number[];
    /** List of times (in ms) associated to a position */
    times: number[];
  };
  permitted_speed: {
    /** List of positions of a train
        Both positions (in mm) and times (in ms) must have the same length */
    positions: number[];
    /** List of speeds (in m/s) associated to a position */
    speeds: number[];
    /** List of times (in ms) associated to a position */
    times: number[];
  };
};
export type EtcsCurves = {
  guidance: {
    /** List of positions of a train
        Both positions (in mm) and times (in ms) must have the same length */
    positions: number[];
    /** List of speeds (in m/s) associated to a position */
    speeds: number[];
    /** List of times (in ms) associated to a position */
    times: number[];
  };
  indication?: null | {
    /** List of positions of a train
        Both positions (in mm) and times (in ms) must have the same length */
    positions: number[];
    /** List of speeds (in m/s) associated to a position */
    speeds: number[];
    /** List of times (in ms) associated to a position */
    times: number[];
  };
  permitted_speed: {
    /** List of positions of a train
        Both positions (in mm) and times (in ms) must have the same length */
    positions: number[];
    /** List of speeds (in m/s) associated to a position */
    speeds: number[];
    /** List of times (in ms) associated to a position */
    times: number[];
  };
};
export type EtcsBrakingCurvesResponse = {
  /** List of ETCS conflict braking curves associated to the train schedule's ETCS signals.
    For each non-route delimiter (F) signal, the associated spacing conflict curve is returned.
    For each route delimiter (Nf) signal, 2 sets of curves are returned, associated to the
    corresponding potential spacing or routing conflict. */
  conflicts: EtcsConflictCurves[];
  /** List of ETCS braking curves associated to the train schedule's ETCS slowdowns */
  slowdowns: EtcsCurves[];
  /** List of ETCS braking curves associated to the train schedule's ETCS stops */
  stops: EtcsCurves[];
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
export type SignalCriticalPosition = {
  /** Position in mm */
  position: number;
  signal: string;
  state: string;
  /** Time in ms */
  time: number;
};
export type SpacingRequirement = {
  begin_time: number;
  end_time: number;
  zone: string;
};
export type ZoneUpdate = {
  is_entry: boolean;
  position: number;
  time: number;
  zone: string;
};
export type SimulationResponseSuccess = {
  /** Simulation without any regularity margins */
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
  /** User-selected simulation: can be base or provisional */
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
      /** source of the speed-limit if relevant (tag used) */
      source?:
        | null
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
          );
      /** in meters per second */
      speed: number;
    }[];
  };
  /** Simulation that takes into account the regularity margins */
  provisional: ReportTrain;
};
export type SimulationResponse =
  | (SimulationResponseSuccess & {
      status: 'success';
    })
  | {
      pathfinding_failed: PathfindingFailure;
      status: 'pathfinding_failed';
    }
  | {
      core_error: InternalError;
      status: 'simulation_failed';
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
  tags?: null | Tags;
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
  tags?: null | Tags;
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
  paced_trains_count: number;
  trains_count: number;
};
export type ScenarioResponse = Scenario & {
  infra_name: string;
  paced_trains_count: number;
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
  tags?: null | Tags;
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
export type MacroNodeBatchResponse = {
  macro_nodes: MacroNodeResponse[];
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
export type MacroNodeBatchForm = {
  macro_nodes: MacroNodeForm[];
};
export type MacroNoteResponse = {
  id: number;
  labels: Tags;
  text: string;
  title: string;
  x: number;
  y: number;
};
export type MacroNoteListResponse = PaginationStats & {
  results: MacroNoteResponse[];
};
export type MacroNoteBatchResponse = {
  macro_notes: MacroNoteResponse[];
};
export type MacroNoteForm = {
  labels: Tags;
  text: string;
  title: string;
  x: number;
  y: number;
};
export type MacroNoteBatchForm = {
  macro_notes: MacroNoteForm[];
};
export type EffortCurveConditions = {
  comfort: null | Comfort;
  electrical_profile_level: string | null;
  power_restriction_code: string | null;
};
export type EffortCurve = {
  /** Max efforts in N. Must contains the same number of elements as `speeds`. */
  max_efforts: number[];
  /** Speeds in m/s. Must contains the same number of elements as `max_efforts` */
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
  etcs_brake_params: null | EtcsBrakeParams;
  id: number;
  inertia_coefficient: number;
  /** Length in m */
  length: number;
  loading_gauge: LoadingGaugeType;
  locked: boolean;
  /** Mass in kg */
  mass: number;
  /** Velocity in m·s⁻¹ */
  max_speed: number;
  metadata: null | RollingStockMetadata;
  name: string;
  other_categories: TrainMainCategories;
  power_restrictions: {
    [key: string]: string;
  };
  primary_category: TrainMainCategory;
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
  /**  The constant gamma braking coefficient used when NOT circulating
     under ETCS/ERTMS signaling system
    Acceleration in m·s⁻² */
  const_gamma: number;
  effort_curves: EffortCurves;
  /**  The time the train takes before actually using electrical power (in seconds).
     Is null if the train is not electric.
    Duration in s */
  electrical_power_startup_time?: number | null;
  energy_sources?: EnergySource[];
  etcs_brake_params?: null | EtcsBrakeParams;
  inertia_coefficient: number;
  /** Length in m */
  length: number;
  loading_gauge: LoadingGaugeType;
  /** Mass in kg */
  mass: number;
  /** Velocity in m·s⁻¹ */
  max_speed: number;
  metadata?: null | RollingStockMetadata;
  name: string;
  other_categories: TrainMainCategories;
  /** Mapping of power restriction code to power class */
  power_restrictions: {
    [key: string]: string;
  };
  primary_category: TrainMainCategory;
  railjson_version?: string;
  /**  The time it takes to raise this train's pantograph in seconds.
     Is null if the train is not electric.
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
export type RollingStockLiveryCreateForm = {
  images: number[][];
  name: string;
};
export type RollingStockLockedUpdateForm = {
  /** New locked value */
  locked: boolean;
};
export type ScenarioReference = {
  project_id: number;
  project_name: string;
  scenario_id: number;
  scenario_name: string;
  study_id: number;
  study_name: string;
};
export type RoundTrips = {
  /** List of one-way trains */
  one_ways?: number[];
  /** List of round trips, each represented by a tuple */
  round_trips?: number[][];
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
  obj_id: string;
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
  business_code: string | null;
  description: string | null;
  id: number;
  last_modification: string;
  name: string;
  project_id: number;
  scenarios_count: number;
  service_code: string | null;
  study_type: string | null;
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
  paced_trains_count: number;
  study_id: number;
  tags: string[];
  trains_count: number;
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
export type SearchResultItemUser = {
  id: number;
  identity_id: string;
  name: string;
};
export type SearchResultItem =
  | SearchResultItemTrack
  | SearchResultItemOperationalPoint
  | SearchResultItemSignal
  | SearchResultItemProject
  | SearchResultItemStudy
  | SearchResultItemScenario
  | SearchResultItemTrainSchedule
  | SearchResultItemUser;
export type SearchQuery = boolean | number | number | string | object;
export type SearchPayload = {
  /** Whether to return the SQL query instead of executing it
    
    Only available in debug builds. */
  dry?: boolean;
  /** The object kind to query - run `editoast search list` to get all possible values */
  object: string;
  /** The query to run */
  query: SearchQuery;
};
export type SimilarTrainWaypoint = {
  id: string;
  stop: boolean;
};
export type SpeedLimits = {
  default_speed_limit_tag?: string | null;
  speed_limit_tags: {
    [key: string]: number;
  };
};
export type StdcmSearchEnvironmentResponse = {
  active_perimeter?: null | GeoJson;
  electrical_profile_set_id?: number | null;
  enabled_from: string;
  enabled_until: string;
  id: number;
  infra_id: number;
  operational_points?: number[] | null;
  operational_points_id_filtered?: string[] | null;
  search_window_begin: string;
  search_window_end: string;
  speed_limits?: null | SpeedLimits;
  temporary_speed_limit_group_id?: number | null;
  timetable_id: number;
  work_schedule_group_id?: number | null;
};
export type OperationalPoints = number[];
export type OperationalPointIds = string[];
export type StdcmSearchEnvironment = {
  active_perimeter?: null | GeoJson;
  default_speed_limit_tag?: string | null;
  electrical_profile_set_id?: number;
  /** The time window start point where the environment is enabled. */
  enabled_from: string;
  /** The time window end point where the environment is enabled.
    This value is usually lower than the `search_window_begin`, since a search is performed before the train rolls. */
  enabled_until: string;
  id: number;
  infra_id: number;
  operational_points: OperationalPoints;
  operational_points_id_filtered: OperationalPointIds;
  /** The start of the search time window.
    Usually, trains schedules from the `timetable_id` runs within this window. */
  search_window_begin: string;
  /** The end of the search time window. */
  search_window_end: string;
  /** Map of speed limit tag with their value */
  speed_limit_tags: {
    [key: string]: number;
  };
  temporary_speed_limit_group_id?: number;
  timetable_id: number;
  work_schedule_group_id?: number;
};
export type StdcmSearchEnvironmentCreateForm = {
  active_perimeter?: null | GeoJson;
  electrical_profile_set_id?: number | null;
  enabled_from: string;
  enabled_until: string;
  infra_id: number;
  operational_points?: number[] | null;
  operational_points_id_filtered?: string[] | null;
  search_window_begin: string;
  search_window_end: string;
  speed_limits?: null | SpeedLimits;
  temporary_speed_limit_group_id?: number | null;
  timetable_id: number;
  work_schedule_group_id?: number | null;
};
export type SubCategoryColor = string;
export type SubCategory = {
  background_color: SubCategoryColor;
  code: string;
  color: SubCategoryColor;
  hovered_color: SubCategoryColor;
  main_category: TrainMainCategory;
  name: string;
};
export type SubCategoryPage = PaginationStats & {
  results: SubCategory[];
};
export type TimetableResult = {
  timetable_id: number;
};
export type ConflictRequirement = {
  end_time: string;
  start_time: string;
  zone: string;
};
export type Conflict = {
  /** Type of the conflict */
  conflict_type: 'Spacing' | 'Routing';
  /** Datetime of the end of the conflict */
  end_time: string;
  /** List of paced train occurrences involved in the conflict.
    Each occurrence is identified by a `paced_train_id` and its `index` */
  paced_train_occurrence_ids: ((
    | {
        index: number;
      }
    | {
        exception_key: string;
        index: number;
      }
    | {
        exception_key: string;
      }
  ) & {
    paced_train_id: number;
  })[];
  /** List of requirements causing the conflict */
  requirements: ConflictRequirement[];
  /** Datetime of the start of the conflict */
  start_time: string;
  /** List of train schedule ids involved in the conflict */
  train_schedule_ids: number[];
  /** List of work schedule ids involved in the conflict */
  work_schedule_ids: number[];
};
export type TrainRequirementsById = {
  routing_requirements: RoutingRequirement[];
  spacing_requirements: SpacingRequirement[];
  start_time: string;
  train_id: string;
};
export type UndirectedTrackRange = {
  /** The beginning of the range in mm. */
  begin: number;
  /** The end of the range in mm. */
  end: number;
  /** The track section identifier. */
  track_section: string;
};
export type WorkSchedule = {
  /** End time as a time delta from the stdcm start time in ms */
  end_time: number;
  /** Start time as a time delta from the stdcm start time in ms */
  start_time: number;
  /** List of unavailable track ranges */
  track_ranges: UndirectedTrackRange[];
};
export type StdcmRequest = {
  /** The comfort of the train */
  comfort: Comfort;
  /** Infrastructure expected version */
  expected_version: number;
  /** Infrastructure id */
  infra: number;
  /** Margin to apply to the whole train */
  margin?:
    | null
    | (
        | {
            Percentage: number;
          }
        | {
            MinPer100Km: number;
          }
      );
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
    etcs_brake_params?: null | EtcsBrakeParams;
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
  /** The loading gauge of the rolling stock */
  rolling_stock_loading_gauge: LoadingGaugeType;
  /** List of supported signaling systems */
  rolling_stock_supported_signaling_systems: RollingStockSupportedSignalingSystems;
  speed_limit_tag?: string | null;
  start_time: string;
  /** List of applicable temporary speed limits between the train departure and arrival */
  temporary_speed_limits: {
    /** Speed limitation in m/s */
    speed_limit: number;
    /** Track ranges on which the speed limitation applies */
    track_ranges: CoreTrackRange[];
  }[];
  /** Gap between the created train and following trains in milliseconds */
  time_gap_after: number;
  /** Gap between the created train and previous trains in milliseconds */
  time_gap_before: number;
  /** Numerical integration time step in milliseconds. Use default value if not specified. */
  time_step?: number | null;
  /** Timetable id */
  timetable_id: number;
  /** List of planned work schedules */
  work_schedules: WorkSchedule[];
};
export type PathfindingItem = {
  /** The stop duration in milliseconds, None if the train does not stop. */
  duration?: number | null;
  /** The associated location */
  location: PathItemLocation;
  /** Time at which the train should arrive at the location, if specified */
  timing_data?: null | {
    /** Time at which the train should arrive at the location */
    arrival_time: string;
    /** The train may arrive up to this duration after the expected arrival time */
    arrival_time_tolerance_after: number;
    /** The train may arrive up to this duration before the expected arrival time */
    arrival_time_tolerance_before: number;
  };
};
export type TrainScheduleResponse = TrainSchedule & {
  id: number;
  timetable_id: number;
};
export type RollingResistancePerWeight = {
  /**  Solid friction in N·kg⁻¹; N = kg⋅m⋅s⁻²
    Acceleration in m·s⁻² */
  A: number;
  /**  Viscosity friction in (N·kg⁻¹)·(m/s)⁻¹; N = kg⋅m⋅s⁻²
    Viscosity friction per weight in s⁻¹ */
  B: number;
  /**  Aerodynamic drag per kg in (N·kg⁻¹)·(m/s)⁻²; N = kg⋅m⋅s⁻²
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
  railjson_version: string;
  rolling_resistance: RollingResistancePerWeight;
  /** Acceleration in m·s⁻² */
  startup_acceleration: number;
  version: number;
};
export type TowedRollingStockForm = {
  /** Acceleration in m·s⁻² */
  comfort_acceleration: number;
  /**  The constant gamma braking coefficient used when NOT circulating
     under ETCS/ERTMS signaling system
    Acceleration in m·s⁻² */
  const_gamma: number;
  inertia_coefficient: number;
  label: string;
  /** Length in m */
  length: number;
  /** Mass in kg */
  mass: number;
  /** Velocity in m·s⁻¹ */
  max_speed?: number | null;
  name: string;
  railjson_version?: string;
  rolling_resistance: RollingResistancePerWeight;
  /** Acceleration in m·s⁻² */
  startup_acceleration: number;
};
export type TowedRollingStockLockedForm = {
  /** New locked value */
  locked: boolean;
};
export type TrainScheduleForm = TrainSchedule & {
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
export type WorkerStatus = 'NOT_READY' | 'LOADING' | 'READY' | 'ERROR';
