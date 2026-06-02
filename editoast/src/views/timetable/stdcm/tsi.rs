//! # TAF/TAP TSI (Technical Specification for Interoperability relating to Telematics Applications for Freight/Passenger Services) short-term path request Endpoint.
//!
//! This module implements the `/timetable/{id}/stdcm/sti` endpoint which provides interoperability with the TAF/TAP TSI standard, in particular for the Path Coordination System (PCS), an international path request coordination system.
//! It reads last-minute path requests in PRM (PathRequestMessage) format and responds in PDM (PathDetailsMessage) format.
//!
//! ## Pipeline
//!
//! 1. Receive a PRM XML input
//! 2. Parse and validate it against the TAF TSI schema
//! 3. Convert it to a STDCM request
//! 4. Compute a STDCM
//! 5. Convert and send back STDCM result as a PDM XML response
//!
//! ## References
//!
//! - RNE TAF/TAP TSI: <https://rne.eu/it/taf-tap-tsi/>
//! - TAF TSI schema: <https://github.com/EU-Agency-for-Railways/TSI_TAF>
//! - PCS: <https://docs.rne.eu/pcs/>
//! - RNE PCS CB Technical Specifications: <https://docs.rne.eu/pcs/pcs-capacity-broker-cb-basics/#API>

mod taftsi;
mod prm;
mod pdm;

use axum::body::Bytes;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Extension;
use axum::http::header;
use http_body_util::BodyExt as _;
use serde::Deserialize;
use utoipa::IntoParams;

use crate::AppState;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::timetable::stdcm::{
    StdcmProgression, StdcmQueryParams, StdcmResponse, stdcm
};
use editoast_derive::EditoastError;

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "stdcm:tsi")]
pub enum TsiError {
    #[error("Invalid UTF-8 encoding in PRM")]
    InvalidEncoding,
    #[error("XML parsing error: {0}")]
    XmlParse(#[from] quick_xml::DeError),
    #[error("Failed to collect STDCM response body")]
    ResponseCollectionFailed,
    #[error("No completed event in STDCM response")]
    NoCompletedEvent,
    #[error("No path found by STDCM")]
    PathNotFound,
    #[error("STDCM simulation or internal error")]
    SimulationError,
    #[error("XML serialization error: {0}")]
    XmlSerialize(String),
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct TsiQueryParams {
    /// Infra id
    pub infra: i64,
    /// Rolling stock id
    pub rolling_stock_id: i64,
}

/// This function receives a TAF-TSI PRM (PathRequestMessage) XML file,
/// converts it to a STDCM request, computes the train path and returns
/// the result as a TAF-TSI PDM (PathDetailsMessage) XML file.
#[tracing::instrument(
    target = "editoast::timetable",
    name = "stdcm_tsi",
    skip_all,
    err,
    fields(
        timetable_id = id,
        infra_id = query.infra,
    )
)]
#[editoast_derive::route(authz::Role::Stdcm)]
#[utoipa::path(
    post, path = "",
    tag = "stdcm",
    params(
        ("id" = i64, Path, description = "timetable_id"),
        TsiQueryParams,
    ),
    responses(
        (status = 200, description = "The PDM XML response"),
    )
)]
pub(in crate::views) async fn stdcm_tsi(
    state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(id): Path<i64>,
    Query(query): Query<TsiQueryParams>,
    body: Bytes,
) -> Result<impl IntoResponse> {
    let prm = prm::parse_xml(&body)?; // Parsing & validation
    let stdcm_request = prm::into_stdcm_request(&prm, query.rolling_stock_id)?;
    // TODO: For testing purposes, remove before merge
    tracing::debug!("STDCM request: {}", serde_json::to_string(&stdcm_request).unwrap_or_default());

    let stdcm_query = StdcmQueryParams { infra: query.infra };
    let response = stdcm(
        state,
        Extension(auth),
        Path(id),
        Query(stdcm_query),
        Json(stdcm_request),
    )
    .await?;

    let stdcm_response = collect_last_response(response).await?;
    // TODO: For testing purposes, remove before merge
    tracing::debug!("STDCM response: {:?}", stdcm_response);

    let pdm_xml = pdm::render(&stdcm_response, &prm)?;
    // TODO: For testing purposes, remove before merge
    tracing::debug!("PDM XML:\n{}", pdm_xml);

    Ok((
        [(header::CONTENT_TYPE, "application/xml; charset=utf-8")],
        pdm_xml,
    ).into_response())
}

async fn collect_last_response(
    response: axum::response::Response,
) -> Result<StdcmResponse, TsiError> {
    let bytes = response
        .into_body()
        .collect()
        .await
        .map_err(|_| TsiError::ResponseCollectionFailed)?
        .to_bytes();
    // TODO: For testing purposes, remove before merge
    tracing::debug!("STDCM raw body: {:?}", std::str::from_utf8(&bytes));

    bytes
    .split(|&b| b == b'\n')
    .filter(|line| !line.is_empty())
    .find_map(|line| {
        if let Ok(StdcmProgression::Completed(r)) =
            serde_json::from_slice::<StdcmProgression>(line)
        {
            return Some(r);
        }
        serde_json::from_slice::<StdcmResponse>(line).ok()
    })
    .ok_or(TsiError::NoCompletedEvent)
}
