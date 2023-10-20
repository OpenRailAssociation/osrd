mod catenaries;
mod electrical_profiles;
mod rangemap_utils;

use std::collections::{HashMap, HashSet};

use actix_web::{
    delete,
    dev::HttpServiceFactory,
    get, post, put,
    web::{self, Data, Json, Path},
    HttpResponse, Responder,
};
use chrono::NaiveDateTime;
use derivative::Derivative;
use diesel::{ExpressionMethods, QueryDsl};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::EditoastError;
use geos::geojson::{self, Geometry};
use geos::Geom;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{
    core::{
        pathfinding::{PathfindingRequest, PathfindingResponse, PathfindingWaypoints, Waypoint},
        AsCoreRequest, CoreClient,
    },
    error::Result,
    models::{
        infra_objects::{
            operational_point::OperationalPointModel, track_section::TrackSectionModel,
        },
        Create, CurveGraph, Delete, Infra, PathWaypoint, Pathfinding, PathfindingChangeset,
        PathfindingPayload, Retrieve, RollingStockModel, SlopeGraph, Update,
    },
    schema::{
        rolling_stock::RollingStock,
        utils::geometry::{diesel_linestring_to_geojson, geojson_to_diesel_linestring},
        ApplicableDirectionsTrackRange, OperationalPoint, TrackRange, TrackSection,
    },
    tables, DbPool,
};

#[derive(Debug, Error, EditoastError, Serialize)]
#[editoast_error(base_id = "pathfinding")]
#[allow(clippy::enum_variant_names)]
enum PathfindingError {
    #[error("Pathfinding {pathfinding_id} does not exist")]
    #[editoast_error(status = 404)]
    NotFound { pathfinding_id: i64 },
    #[error("Catenary {catenary_id} overlaps with other catenaries")]
    #[editoast_error(status = 500)]
    CatenaryOverlap {
        catenary_id: String,
        overlapping_ranges: Vec<ApplicableDirectionsTrackRange>,
    },
    #[error("Electrical Profile overlaps with others")]
    #[editoast_error(status = 500)]
    ElectricalProfilesOverlap { overlapping_ranges: Vec<TrackRange> },
    #[error("Infra {infra_id} does not exist")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error("Track sections do not exist: {track_sections:?}")]
    #[editoast_error(status = 404)]
    TrackSectionsNotFound { track_sections: HashSet<String> },
    #[error("Operational points do not exist: {operational_points:?}")]
    #[editoast_error(status = 404)]
    OperationalPointNotFound { operational_points: HashSet<String> },
    #[error("Rolling stock with id {rolling_stock_id} doesn't exist")]
    #[editoast_error(status = 404)]
    RollingStockNotFound { rolling_stock_id: i64 },
}

/// Returns `/pathfinding` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/pathfinding").service((
        get_pf,
        del_pf,
        create_pf,
        update_pf,
        catenaries::routes(),
        electrical_profiles::routes(),
    ))
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
struct Response {
    id: i64,
    owner: uuid::Uuid,
    length: f64,
    created: NaiveDateTime,
    slopes: SlopeGraph,
    curves: CurveGraph,
    geographic: Geometry,
    schematic: Geometry,
    steps: Vec<PathWaypoint>,
}

impl From<Pathfinding> for Response {
    fn from(value: Pathfinding) -> Self {
        let Pathfinding {
            id,
            owner,
            length,
            created,
            slopes,
            curves,
            geographic,
            schematic,
            payload,
            ..
        } = value;
        Self {
            id,
            owner,
            length,
            created,
            slopes: slopes.0,
            curves: curves.0,
            geographic: diesel_linestring_to_geojson(geographic),
            schematic: diesel_linestring_to_geojson(schematic),
            steps: payload.0.path_waypoints,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
struct PathfindingRequestPayload {
    infra: i64,
    steps: Vec<StepPayload>,
    #[serde(default)]
    rolling_stocks: Vec<i64>,
}

#[derive(Debug, Default, Serialize, Deserialize, PartialEq, Clone)]
pub struct StepPayload {
    pub duration: f64,
    pub waypoints: Vec<WaypointPayload>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct WaypointPayload {
    track_section: String,
    #[serde(flatten)]
    location: TrackSectionLocation,
}

#[derive(Debug, Clone, Derivative, Serialize, Deserialize, PartialEq)]
#[derivative(Default)]
#[serde(rename_all = "snake_case")]
enum TrackSectionLocation {
    GeoCoordinate((f64, f64)),
    #[derivative(Default)]
    Offset(f64),
}

impl WaypointPayload {
    /// Projects the waypoint onto the tracksection and builds a bidirectional Core
    /// waypoint payload
    fn compute_waypoints(&self, track_map: &TrackMap) -> Vec<Waypoint> {
        let track = track_map.get(&self.track_section).unwrap();
        let offset = match self.location {
            TrackSectionLocation::GeoCoordinate((lon, lat)) => {
                let point =
                    geos::Geometry::try_from(geojson::Geometry::new(geojson::Value::Point(vec![
                        lon, lat,
                    ])))
                    .unwrap();
                let normalized_offset = geos::Geometry::try_from(track.geo.clone())
                    .unwrap()
                    .project_normalized(&point)
                    .expect("could not compute the projection of the waypoint");
                normalized_offset * track.length
            }
            TrackSectionLocation::Offset(offset) => offset,
        };
        let [wp, wp2] = Waypoint::bidirectional(&track.id, offset);
        vec![wp, wp2]
    }
}

pub type TrackMap = HashMap<String, TrackSection>;
type OpMap = HashMap<String, OperationalPoint>;

/// Computes a hash map (obj_id => TrackSection) for each obj_id in an iterator
async fn make_track_map<I: Iterator<Item = String>>(
    conn: &mut PgConnection,
    infra_id: i64,
    it: I,
) -> Result<TrackMap> {
    use tables::infra_object_track_section::dsl;
    // TODO: implement a BatchRetrieve trait for tracksections for a better error handling + check all tracksections are there
    let ids = it.collect::<HashSet<_>>().into_iter().collect::<Vec<_>>();
    let expected_count = ids.len();
    let tracksections: Vec<_> = match dsl::infra_object_track_section
        .filter(dsl::infra_id.eq(infra_id))
        .filter(dsl::obj_id.eq_any(&ids))
        .get_results::<TrackSectionModel>(conn)
        .await
    {
        Ok(ts) if ts.len() != expected_count => {
            let got = HashSet::<String>::from_iter(ts.into_iter().map(|ts| ts.obj_id));
            let expected = HashSet::<String>::from_iter(ids);
            let diff = expected.difference(&got).collect::<HashSet<_>>();
            return Err(PathfindingError::TrackSectionsNotFound {
                track_sections: diff.into_iter().map(|s| s.to_owned()).collect(),
            }
            .into());
        }
        res => res,
    }?;
    Ok(HashMap::from_iter(
        tracksections.into_iter().map(|ts| (ts.obj_id, ts.data.0)),
    ))
}

async fn make_op_map<I: Iterator<Item = String>>(
    conn: &mut PgConnection,
    infra: i64,
    it: I,
) -> Result<OpMap> {
    use tables::infra_object_operational_point::dsl;
    // TODO: implement a BatchRetrieve trait for tracksections for a better error handling + check all tracksections are there
    let ids = it.collect::<HashSet<_>>().into_iter().collect::<Vec<_>>();
    let expected_count = ids.len();
    let tracksections: Vec<_> = match dsl::infra_object_operational_point
        .filter(dsl::infra_id.eq(infra))
        .filter(dsl::obj_id.eq_any(&ids))
        .get_results::<OperationalPointModel>(conn)
        .await
    {
        Ok(ts) if ts.len() != expected_count => {
            let got = HashSet::<String>::from_iter(ts.into_iter().map(|ts| ts.obj_id));
            let expected = HashSet::<String>::from_iter(ids);
            let diff = expected.difference(&got).collect::<HashSet<_>>();
            return Err(PathfindingError::OperationalPointNotFound {
                operational_points: diff.into_iter().map(|s| s.to_owned()).collect(),
            }
            .into());
        }
        res => res,
    }?;
    Ok(HashMap::from_iter(
        tracksections.into_iter().map(|ts| (ts.obj_id, ts.data.0)),
    ))
}

impl PathfindingRequestPayload {
    /// Queries all track sections of the payload and builds a track hash map
    async fn fetch_track_map(&self, conn: &mut PgConnection) -> Result<TrackMap> {
        fetch_pathfinding_payload_track_map(conn, self.infra, &self.steps).await
    }

    /// Parses all payload waypoints into Core pathfinding request waypoints
    fn parse_waypoints(&self, track_map: &TrackMap) -> Result<PathfindingWaypoints> {
        parse_pathfinding_payload_waypoints(&self.steps, track_map)
    }

    /// Fetches all payload's rolling stocks
    async fn parse_rolling_stocks(&self, conn: &mut PgConnection) -> Result<Vec<RollingStock>> {
        let mut rolling_stocks = vec![];
        for id in &self.rolling_stocks {
            let rs: RollingStock = RollingStockModel::retrieve_conn(conn, *id)
                .await?
                .ok_or(PathfindingError::RollingStockNotFound {
                    rolling_stock_id: *id,
                })?
                .into();
            rolling_stocks.push(rs);
        }
        Ok(rolling_stocks)
    }
}

pub async fn fetch_pathfinding_payload_track_map(
    conn: &mut PgConnection,
    infra: i64,
    steps: &[StepPayload],
) -> Result<TrackMap> {
    make_track_map(
        conn,
        infra,
        steps
            .iter()
            .flat_map(|step| step.waypoints.iter())
            .map(|waypoint| waypoint.track_section.clone()),
    )
    .await
}

pub fn parse_pathfinding_payload_waypoints(
    steps: &[StepPayload],
    track_map: &TrackMap,
) -> Result<PathfindingWaypoints> {
    let waypoints = steps
        .iter()
        .flat_map(|step| &step.waypoints)
        .map(|wp| wp.compute_waypoints(track_map))
        .collect();
    Ok(waypoints)
}

impl PathfindingResponse {
    pub async fn fetch_track_map(&self, infra: i64, conn: &mut PgConnection) -> Result<TrackMap> {
        make_track_map(
            conn,
            infra,
            self.path_waypoints
                .iter()
                .map(|wp| wp.location.track_section.0.clone()),
        )
        .await
    }

    pub async fn fetch_op_map(&self, infra: i64, conn: &mut PgConnection) -> Result<OpMap> {
        make_op_map(
            conn,
            infra,
            self.path_waypoints.iter().filter_map(|wp| wp.id.clone()),
        )
        .await
    }
}

impl Pathfinding {
    /// Post-processes the Core pathfinding reponse and build a [Pathfinding] model
    pub fn from_core_response(
        steps_duration: Vec<f64>,
        response: PathfindingResponse,
        track_map: &TrackMap,
        op_map: &OpMap,
    ) -> Result<Self> {
        let PathfindingResponse {
            length,
            geographic,
            schematic,
            route_paths,
            path_waypoints,
            slopes,
            curves,
            ..
        } = response;
        let mut steps_duration = steps_duration.into_iter();
        let path_waypoints = path_waypoints
            .iter()
            .map(|waypoint| {
                let duration = if waypoint.suggestion {
                    0.0
                } else {
                    steps_duration.next().unwrap()
                };
                let op_name = waypoint
                    .id
                    .as_ref()
                    .map(|op_id| op_map.get(op_id).expect("unexpected OP id"))
                    .and_then(|op| op.extensions.identifier.as_ref())
                    .map(|ident| ident.name.as_ref().to_owned());
                let track = track_map
                    .get(&waypoint.location.track_section.0)
                    .expect("unexpected track id");
                let normalized_offset = waypoint.location.offset / track.length;
                let geo = geos::Geometry::try_from(&track.geo)
                    .unwrap()
                    .interpolate_normalized(normalized_offset)
                    .unwrap();
                let sch = geos::Geometry::try_from(&track.sch)
                    .unwrap()
                    .interpolate_normalized(normalized_offset)
                    .unwrap();
                let geo = geos::geojson::Geometry::try_from(geo).unwrap();
                let sch = geos::geojson::Geometry::try_from(sch).unwrap();
                PathWaypoint {
                    id: waypoint.id.clone(),
                    name: op_name,
                    location: waypoint.location.clone(),
                    duration,
                    path_offset: waypoint.path_offset,
                    suggestion: waypoint.suggestion,
                    geo,
                    sch,
                }
            })
            .collect();
        Ok(Pathfinding {
            length,
            payload: diesel_json::Json(PathfindingPayload {
                route_paths: route_paths.to_vec(),
                path_waypoints,
            }),
            slopes: diesel_json::Json(slopes.to_vec()),
            curves: diesel_json::Json(curves.to_vec()),
            geographic: geojson_to_diesel_linestring(&geographic),
            schematic: geojson_to_diesel_linestring(&schematic),
            ..Default::default() // creation date, uuid, id, infra_id
        })
    }
}

/// Builds a Core pathfinding request, runs it, post-processes the response and stores it in the DB
async fn call_core_pf_and_save_result(
    payload: Json<PathfindingRequestPayload>,
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
    update_id: Option<i64>,
) -> Result<Pathfinding> {
    // Checks that the pf to update exists in the first place in order to fail early and avoid unnecessary core requests
    if let Some(id) = update_id {
        if Pathfinding::retrieve(db_pool.clone(), id).await?.is_none() {
            return Err(PathfindingError::NotFound { pathfinding_id: id }.into());
        }
    }
    let payload = payload.into_inner();
    let infra_id = payload.infra;
    let infra = Infra::retrieve(db_pool.clone(), infra_id)
        .await?
        .ok_or(PathfindingError::InfraNotFound { infra_id })?;

    let conn = &mut db_pool.get().await?;
    let track_map = payload.fetch_track_map(conn).await?;
    let mut waypoints = payload.parse_waypoints(&track_map)?;
    let mut rolling_stocks = payload.parse_rolling_stocks(conn).await?;
    let mut path_request = PathfindingRequest::new(infra.id.unwrap(), infra.version.unwrap());
    path_request
        .with_waypoints(&mut waypoints)
        .with_rolling_stocks(&mut rolling_stocks);
    let steps_duration = payload.steps.iter().map(|step| step.duration).collect();
    run_pathfinding(
        &path_request,
        core,
        conn,
        infra_id,
        update_id,
        steps_duration,
    )
    .await
}

/// Run a pathfinding request and store the result in the DB
/// If `update_id` is provided then update the corresponding path instead of creating a new one
pub async fn run_pathfinding(
    path_request: &PathfindingRequest,
    core: Data<CoreClient>,
    conn: &mut PgConnection,
    infra_id: i64,
    update_id: Option<i64>,
    steps_duration: Vec<f64>,
) -> Result<Pathfinding> {
    assert_eq!(steps_duration.len(), path_request.nb_waypoints());
    let response = path_request.fetch(core.as_ref()).await?;
    let response_track_map = response.fetch_track_map(infra_id, conn).await?;
    let response_op_map = response.fetch_op_map(infra_id, conn).await?;
    let pathfinding = Pathfinding::from_core_response(
        steps_duration,
        response,
        &response_track_map,
        &response_op_map,
    )?;
    let changeset = PathfindingChangeset {
        id: None,
        infra_id: Some(infra_id),
        ..pathfinding.into()
    };
    let pathfinding: Pathfinding = if let Some(id) = update_id {
        changeset
            .update_conn(conn, id)
            .await?
            .expect("row should exist - checked earlier")
            .into()
    } else {
        changeset.create_conn(conn).await?.into()
    };
    Ok(pathfinding)
}

#[post("")]
async fn create_pf(
    payload: Json<PathfindingRequestPayload>,
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
) -> Result<Json<Response>> {
    let pathfinding = call_core_pf_and_save_result(payload, db_pool, core, None).await?;
    Ok(Json(pathfinding.into()))
}

#[put("{id}")]
async fn update_pf(
    path: Path<i64>,
    payload: Json<PathfindingRequestPayload>,
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
) -> Result<Json<Response>> {
    let pathfinding =
        call_core_pf_and_save_result(payload, db_pool, core, Some(path.into_inner())).await?;
    Ok(Json(pathfinding.into()))
}

#[get("{id}")]
async fn get_pf(path: Path<i64>, db_pool: Data<DbPool>) -> Result<Json<Response>> {
    let pathfinding_id = path.into_inner();
    match Pathfinding::retrieve(db_pool, pathfinding_id).await? {
        Some(pf) => Ok(Json(pf.into())),
        None => Err(PathfindingError::NotFound { pathfinding_id }.into()),
    }
}

#[delete("{id}")]
async fn del_pf(path: Path<i64>, db_pool: Data<DbPool>) -> Result<impl Responder> {
    let pathfinding_id = path.into_inner();
    if Pathfinding::delete(db_pool, pathfinding_id).await? {
        Ok(HttpResponse::NoContent())
    } else {
        Err(PathfindingError::NotFound { pathfinding_id }.into())
    }
}

#[cfg(test)]
mod test {
    use actix_http::StatusCode;
    use actix_web::test::{call_service, TestRequest};
    use serde_json::json;

    use crate::core::mocking::MockingClient;
    use crate::fixtures::tests::{
        db_pool, empty_infra, fast_rolling_stock, pathfinding, small_infra, TestFixture,
    };
    use crate::models::{Infra, Pathfinding, Retrieve};
    use crate::views::pathfinding::{PathfindingError, Response};
    use crate::views::tests::create_test_service_with_core_client;
    use crate::{assert_editoast_error_type, assert_status_and_read};
    use crate::{models::RollingStockModel, views::tests::create_test_service};

    #[rstest::rstest]
    async fn test_get_pf(#[future] pathfinding: TestFixture<Pathfinding>) {
        let pf = &pathfinding.await.model;
        let app = create_test_service().await;
        let req = TestRequest::get()
            .uri(&format!("/pathfinding/{}", pf.id))
            .to_request();
        let response = call_service(&app, req).await;
        let response: Response = assert_status_and_read!(response, StatusCode::OK);
        let expected_response = Response::from(pf.clone());
        assert_eq!(response, expected_response);
    }

    #[actix_web::test]
    async fn test_get_not_found() {
        let app = create_test_service().await;
        let req = TestRequest::get().uri("/pathfinding/666").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest::rstest]
    async fn test_delete_pf(#[future] pathfinding: TestFixture<Pathfinding>) {
        let pf = &pathfinding.await.model;
        let app = create_test_service().await;
        let req = TestRequest::delete().uri(&format!("/pathfinding/{}", pf.id));
        let response = call_service(&app, req.to_request()).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let req = TestRequest::delete().uri(&format!("/pathfinding/{}", pf.id));
        let response = call_service(&app, req.to_request()).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_delete_not_found() {
        let app = create_test_service().await;
        let req = TestRequest::delete().uri("/pathfinding/666").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest::rstest]
    async fn test_post_ok(#[future] fast_rolling_stock: TestFixture<RollingStockModel>) {
        // Avoid `Drop`ping the fixture
        let rs = &fast_rolling_stock.await.model;
        let small_infra = small_infra(db_pool()).await;
        let infra = &small_infra.model;
        let rs_id = rs.id.unwrap();
        let infra_id = infra.id.unwrap();
        let mut payload: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/small_infra/pathfinding_post_payload.json"
        ))
        .unwrap();
        *payload.get_mut("infra").unwrap() = json!(infra_id);
        *payload.get_mut("rolling_stocks").unwrap() = json!([rs_id]);

        let mut core = MockingClient::new();
        core.stub("/pathfinding/routes")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body(include_str!(
                "../../tests/small_infra/pathfinding_core_response.json"
            ))
            .finish();
        let app = create_test_service_with_core_client(core).await;
        let req = TestRequest::post()
            .uri("/pathfinding")
            .set_json(payload)
            .to_request();
        let response = call_service(&app, req).await;
        let response: Response = assert_status_and_read!(response, StatusCode::OK);
        assert!(Pathfinding::retrieve(db_pool(), response.id).await.is_ok());
    }

    #[rstest::rstest]
    async fn test_infra_not_found() {
        let payload: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/small_infra/pathfinding_post_payload.json"
        ))
        .unwrap();
        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri("/pathfinding")
            .set_json(payload)
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_editoast_error_type!(response, PathfindingError::InfraNotFound { infra_id: 0 });
    }

    #[rstest::rstest]
    async fn test_rolling_stock_not_found(#[future] small_infra: TestFixture<Infra>) {
        let infra = &small_infra.await.model;
        let mut payload: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/small_infra/pathfinding_post_payload.json"
        ))
        .unwrap();
        *payload.get_mut("infra").unwrap() = json!(infra.id.unwrap());
        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri("/pathfinding")
            .set_json(payload)
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_editoast_error_type!(
            response,
            PathfindingError::RollingStockNotFound {
                rolling_stock_id: 0
            }
        );
    }

    #[rstest::rstest]
    async fn test_track_section_not_found(#[future] empty_infra: TestFixture<Infra>) {
        let infra = &empty_infra.await.model;
        let mut payload: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/small_infra/pathfinding_post_payload.json"
        ))
        .unwrap();
        *payload.get_mut("infra").unwrap() = json!(infra.id.unwrap());
        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri("/pathfinding")
            .set_json(payload)
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_editoast_error_type!(
            response,
            PathfindingError::TrackSectionsNotFound {
                track_sections: Default::default()
            }
        );
    }
}
