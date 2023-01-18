import { emptySplitApi as api } from './emptyApi';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    healthHealthGet: build.query<HealthHealthGetApiResponse, HealthHealthGetApiArg>({
      query: () => ({ url: `/health/` }),
    }),
    getVersion: build.query<GetVersionApiResponse, GetVersionApiArg>({
      query: () => ({ url: `/version` }),
    }),
    infoInfoGet: build.query<InfoInfoGetApiResponse, InfoInfoGetApiArg>({
      query: () => ({ url: `/info/` }),
    }),
    mvtViewMetadataLayerLayerSlugMvtViewSlugGet: build.query<
      MvtViewMetadataLayerLayerSlugMvtViewSlugGetApiResponse,
      MvtViewMetadataLayerLayerSlugMvtViewSlugGetApiArg
    >({
      query: (queryArg) => ({
        url: `/layer/${queryArg.layerSlug}/mvt/${queryArg.viewSlug}/`,
        params: { infra: queryArg.infra },
      }),
    }),
    mvtViewTileTileLayerSlugViewSlugZXYGet: build.query<
      MvtViewTileTileLayerSlugViewSlugZXYGetApiResponse,
      MvtViewTileTileLayerSlugViewSlugZXYGetApiArg
    >({
      query: (queryArg) => ({
        url: `/tile/${queryArg.layerSlug}/${queryArg.viewSlug}/${queryArg.z}/${queryArg.x}/${queryArg.y}/`,
        params: { infra: queryArg.infra },
      }),
    }),
    invalidateLayerLayerLayerSlugInvalidatePost: build.mutation<
      InvalidateLayerLayerLayerSlugInvalidatePostApiResponse,
      InvalidateLayerLayerLayerSlugInvalidatePostApiArg
    >({
      query: (queryArg) => ({
        url: `/layer/${queryArg.layerSlug}/invalidate/`,
        method: 'POST',
        params: { infra: queryArg.infra },
      }),
    }),
    invalidateLayerBboxLayerLayerSlugInvalidateBboxPost: build.mutation<
      InvalidateLayerBboxLayerLayerSlugInvalidateBboxPostApiResponse,
      InvalidateLayerBboxLayerLayerSlugInvalidateBboxPostApiArg
    >({
      query: (queryArg) => ({
        url: `/layer/${queryArg.layerSlug}/invalidate_bbox/`,
        method: 'POST',
        body: queryArg.body,
        params: { infra: queryArg.infra },
      }),
    }),
    getObjectsInBboxLayerLayerSlugObjectsViewSlugMinXMinYMaxXMaxYGet: build.query<
      GetObjectsInBboxLayerLayerSlugObjectsViewSlugMinXMinYMaxXMaxYGetApiResponse,
      GetObjectsInBboxLayerLayerSlugObjectsViewSlugMinXMinYMaxXMaxYGetApiArg
    >({
      query: (queryArg) => ({
        url: `/layer/${queryArg.layerSlug}/objects/${queryArg.viewSlug}/${queryArg.minX}/${queryArg.minY}/${queryArg.maxX}/${queryArg.maxY}/`,
        params: { infra: queryArg.infra },
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as osrdChartosApi };
export type HealthHealthGetApiResponse = /** status 200 Successful Response */ any;
export type HealthHealthGetApiArg = void;
export type GetVersionApiResponse = /** status 200 Return the service version */ {
  git_describe: string | null;
};
export type GetVersionApiArg = void;
export type InfoInfoGetApiResponse = /** status 200 Successful Response */ any;
export type InfoInfoGetApiArg = void;
export type MvtViewMetadataLayerLayerSlugMvtViewSlugGetApiResponse =
  /** status 200 Successful Response */ {
    type?: string;
    name?: string;
    promotedId?: object;
    scheme?: string;
    tiles?: string[];
    attribution?: string;
    minzoom?: number;
    maxzoom?: number;
  };
export type MvtViewMetadataLayerLayerSlugMvtViewSlugGetApiArg = {
  layerSlug: string;
  viewSlug: string;
  infra: number;
};
export type MvtViewTileTileLayerSlugViewSlugZXYGetApiResponse =
  /** status 200 Successful Response */ Blob;
export type MvtViewTileTileLayerSlugViewSlugZXYGetApiArg = {
  layerSlug: string;
  viewSlug: string;
  z: number;
  x: number;
  y: number;
  infra: number;
};
export type InvalidateLayerLayerLayerSlugInvalidatePostApiResponse =
  /** status 204 Successful Response */ undefined;
export type InvalidateLayerLayerLayerSlugInvalidatePostApiArg = {
  layerSlug: string;
  infra: number;
};
export type InvalidateLayerBboxLayerLayerSlugInvalidateBboxPostApiResponse =
  /** status 204 Successful Response */ undefined;
export type InvalidateLayerBboxLayerLayerSlugInvalidateBboxPostApiArg = {
  layerSlug: string;
  infra: number;
  body: BoundingBoxView[];
};
export type GetObjectsInBboxLayerLayerSlugObjectsViewSlugMinXMinYMaxXMaxYGetApiResponse =
  /** status 200 Successful Response */ {
    type?: 'FeatureCollection';
    features?: object[];
  };
export type GetObjectsInBboxLayerLayerSlugObjectsViewSlugMinXMinYMaxXMaxYGetApiArg = {
  layerSlug: string;
  viewSlug: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  infra: number;
};
export type ValidationError = {
  loc: (string | number)[];
  msg: string;
  type: string;
};
export type HttpValidationError = {
  detail?: ValidationError[];
};
export type BoundingBoxView = {
  view: string;
  bbox: number[][][];
};
