use chrono::DateTime;
use chrono::Duration;
use chrono::FixedOffset;
use chrono::Datelike;
use chrono::Utc;
use quick_xml::se::to_string;
use serde::Serialize;
use uuid::Uuid;

use core_client::pathfinding::PathfindingResultSuccess;

use crate::views::timetable::simulation::SimulationResponseSuccess;
use crate::views::timetable::stdcm::StdcmResponse;

use crate::views::timetable::stdcm::tsi::prm::PathRequestMessage;

use crate::views::timetable::stdcm::tsi::taftsi::JourneyLocationTypeCode;
use crate::views::timetable::stdcm::tsi::taftsi::MessageType;
use crate::views::timetable::stdcm::tsi::taftsi::ObjectType;
use crate::views::timetable::stdcm::tsi::taftsi::PlannedJourneyLocation;
use crate::views::timetable::stdcm::tsi::taftsi::PlannedTrainTechnicalData;
use crate::views::timetable::stdcm::tsi::taftsi::ProcessType;
use crate::views::timetable::stdcm::tsi::taftsi::TrainType;
use crate::views::timetable::stdcm::tsi::taftsi::TypeOfInformation;
use crate::views::timetable::stdcm::tsi::taftsi::TypeOfRequest;
use crate::views::timetable::stdcm::tsi::taftsi::ms_to_tenth_of_minute;
use crate::views::timetable::stdcm::tsi::taftsi::tenth_of_minute_to_ms;

use crate::views::timetable::stdcm::tsi::TsiError;

const XMLNS: &str = "http://www.era.europa.eu/schemes/TAFTSI/3.1";
const CONTACT_NAME: &str = "osrd-tsi";
const CONTACT_EMAIL: &str = "osrd-tsi";
const CONTACT_HOURS: &str = "Mon-Fri 08:00-17:00";

// Core variant, has to be 2 characters long and follow the [0-9A-Z]{2} pattern.
// "00" is reserved for group elements.
// TODO: Should we generate it ?
const CORE_VARIANT: &str = "A1";

// Specific structures used to declare namespaces in the PathDetailsMessage
#[derive(Debug, Serialize)]
#[serde(rename = "tsi:PathDetailsMessage")]
struct PathDetailsMessage {
    #[serde(rename = "@xmlns:tsi")]
    xmlns: &'static str,
    #[serde(rename = "tsi:MessageHeader")]
    message_header: PdmMessageHeader,
    #[serde(rename = "tsi:AdministrativeContactInformation")]
    administrative_contact: AdministrativeContact,
    #[serde(rename = "tsi:Identifiers")]
    identifiers: PdmIdentifiers,
    #[serde(rename = "tsi:MessageStatus")]
    message_status: u8,
    #[serde(rename = "tsi:CoordinatingIM")]
    coordinating_im: String,
    #[serde(rename = "tsi:LeadRU")]
    lead_ru: String,
    #[serde(rename = "tsi:TypeOfRequest")]
    type_of_request: TypeOfRequest,
    #[serde(rename = "tsi:ProcessType")]
    process_type: ProcessType,
    #[serde(rename = "tsi:TypeOfInformation")]
    type_of_information: TypeOfInformation,
    #[serde(rename = "tsi:PathInformation")]
    path_information: PdmPathInformation,
}

#[derive(Debug, Serialize)]
struct PdmMessageHeader {
    #[serde(rename = "tsi:MessageReference")]
    message_reference: PdmMessageReference,
    #[serde(rename = "tsi:MessageRoutingID")]
    routing_id: String,
    #[serde(rename = "tsi:SenderReference")]
    sender_reference: String,
    #[serde(rename = "tsi:Sender")]
    sender: String,
    #[serde(rename = "tsi:MessageDateTimeCreated")]
    created: String,
    #[serde(rename = "tsi:Recipient")]
    recipient: String,
}

#[derive(Debug, Serialize)]
struct PdmMessageReference {
    #[serde(rename = "tsi:MessageType")]
    message_type: MessageType,
    #[serde(rename = "tsi:MessageTypeVersion")]
    version: String,
    #[serde(rename = "tsi:MessageIdentifier")]
    identifier: String,
    #[serde(rename = "tsi:MessageDateTime")]
    datetime: String,
}

#[derive(Debug, Serialize)]
struct AdministrativeContact {
    #[serde(rename = "tsi:Name")]
    name: &'static str,
    #[serde(rename = "tsi:eMail")]
    email: &'static str,
    #[serde(rename = "tsi:FreeTextField")]
    free_text: &'static str,
}

#[derive(Debug, Serialize)]
struct PdmIdentifiers {
    #[serde(rename = "tsi:PlannedTransportIdentifiers")]
    identifiers: Vec<PdmPlannedTransportIdentifier>,
}

#[derive(Debug, Serialize)]
struct PdmPlannedTransportIdentifier {
    #[serde(rename = "tsi:ObjectType")]
    object_type: ObjectType,
    #[serde(rename = "tsi:Company")]
    company: String,
    #[serde(rename = "tsi:Core")]
    core: String,
    #[serde(rename = "tsi:Variant")]
    variant: String,
    #[serde(rename = "tsi:TimetableYear")]
    timetable_year: u16,
}

#[derive(Debug, Serialize)]
struct PdmPathInformation {
    #[serde(rename = "tsi:PlannedJourneyLocation")]
    locations: Vec<PdmJourneyLocation>,
    #[serde(rename = "tsi:PlannedCalendar")]
    calendar: PdmCalendar,
}

#[derive(Debug, Serialize)]
struct PdmJourneyLocation {
    #[serde(rename = "tsi:CountryCodeISO")]
    country_code: String,
    #[serde(rename = "tsi:LocationPrimaryCode")]
    location_primary_code: String,
    #[serde(rename = "tsi:PrimaryLocationName")]
    #[serde(skip_serializing_if = "Option::is_none")]
    primary_location_name: Option<String>,
    #[serde(rename = "tsi:TimingAtLocation")]
    timing: PdmTimingAtLocation,
    #[serde(rename = "tsi:ResponsibleApplicant")]
    #[serde(skip_serializing_if = "Option::is_none")]
    responsible_applicant: Option<String>,
    #[serde(rename = "tsi:ResponsibleRU")]
    #[serde(skip_serializing_if = "Option::is_none")]
    responsible_ru: Option<String>,
    #[serde(rename = "tsi:ResponsibleIM")]
    responsible_im: String,
    #[serde(rename = "tsi:PlannedTrainData")]
    #[serde(skip_serializing_if = "Option::is_none")]
    planned_train_data: Option<PdmPlannedTrainData>,
    #[serde(rename = "tsi:OperationalTrainNumber")]
    #[serde(skip_serializing_if = "Option::is_none")]
    operational_train_number: Option<String>,
    #[serde(rename = "tsi:JourneyLocationTypeCode")]
    journey_location_type_code: String,
}

#[derive(Debug, Serialize)]
struct PdmTimingAtLocation {
    #[serde(rename = "tsi:Timing")]
    timings: Vec<PdmTiming>,
    #[serde(rename = "tsi:DwellTime")]
    #[serde(skip_serializing_if = "Option::is_none")]
    dwell_time: Option<f64>,
}

#[derive(Debug, Serialize)]
struct PdmTiming {
    #[serde(rename = "@tsi:TimingQualifierCode")]
    qualifier: &'static str,
    #[serde(rename = "tsi:Time")]
    time: String,
    #[serde(rename = "tsi:Offset")]
    offset: i64,
}

#[derive(Debug, Serialize)]
struct PdmPlannedTrainData {
    #[serde(rename = "tsi:TrainType")]
    train_type: u8,
    #[serde(rename = "tsi:PlannedTrainTechnicalData")]
    technical_data: PdmTechnicalData,
}

#[derive(Debug, Serialize)]
struct PdmTechnicalData {
    #[serde(rename = "tsi:TrainWeight")]
    train_weight: u32,
    #[serde(rename = "tsi:TrainLength")]
    train_length: u32,
    #[serde(rename = "tsi:TrainMaxSpeed")]
    train_max_speed: u32,
}

#[derive(Debug, Serialize)]
struct PdmCalendar {
    #[serde(rename = "tsi:ValidityPeriod")]
    validity_period: PdmValidityPeriod,
}

#[derive(Debug, Serialize)]
struct PdmValidityPeriod {
    #[serde(rename = "tsi:StartDateTime")]
    start: String,
    #[serde(rename = "tsi:EndDateTime")]
    end: String,
}


pub(super) fn render(
    response: &StdcmResponse,
    prm: &PathRequestMessage,
) -> Result<String, TsiError> {
    match response {
        StdcmResponse::Success {
            simulation,
            pathfinding_result,
            departure_time,
            ..
        } => render_success(simulation, pathfinding_result, *departure_time, prm),
        StdcmResponse::PathNotFound => Err(TsiError::PathNotFound),
        StdcmResponse::PreprocessingSimulationError { .. }
        | StdcmResponse::InternalError { .. } => Err(TsiError::SimulationError),
    }
}

fn render_success(
    simulation: &SimulationResponseSuccess,
    pathfinding_result: &PathfindingResultSuccess,
    departure_time: DateTime<Utc>,
    prm: &PathRequestMessage,
) -> Result<String, TsiError> {
    let message_id = Uuid::new_v4().to_string();
    
    // Retrieve timezone from the PathRequestMessage
    let tz_offset = *prm.path_information.planned_calendar.validity_period.start.offset();
    // Convert departure_time to local time
    let departure_time = departure_time.with_timezone(&tz_offset);
    let now = Utc::now().with_timezone(&tz_offset);

    // In forward planning, if we are the first IM to construct, we have the origin point in the PRM.
    let is_first_im = prm.path_information.planned_journey_locations
        .iter()
        .any(|loc| loc.journey_location_type_code == JourneyLocationTypeCode::Origin);

    // TODO: implement backward planning

    // TODO: replace with path_item_times when fixed
    // let path_item_times = &simulation.final_output.report_train.path_item_times;
    let path_item_times = reconstruct_path_item_times(
        &pathfinding_result.path_item_positions,
        &simulation.final_output.report_train.positions,
        &simulation.final_output.report_train.times,
    );

    let locations = prm.path_information.planned_journey_locations
        .iter()
        .enumerate()
        .map(|(i, loc)| build_pdm_locations(loc, i, departure_time, &path_item_times, is_first_im))
        .collect::<Result<Vec<_>, _>>()?;

    let msg = PathDetailsMessage {
        xmlns: XMLNS,
        message_header: PdmMessageHeader {
            message_reference: PdmMessageReference {
                message_type: MessageType::PathDetailsMessage,
                version: prm.message_header.message_reference.message_type_version.clone(),
                identifier: message_id.clone(),
                datetime: now.to_rfc3339(),
            },
            routing_id: prm.message_header.message_routing_id.clone(),
            sender_reference: message_id.clone(),
            sender: prm.message_header.recipient.clone(),
            created: now.to_rfc3339(),
            recipient: prm.message_header.sender.clone(), 
        },
        administrative_contact: AdministrativeContact {
            name: CONTACT_NAME,
            email: CONTACT_EMAIL,
            free_text: CONTACT_HOURS,
        },
        identifiers: build_identifiers(prm)?,
        message_status: 1,
        coordinating_im: prm.coordinating_im.clone(),
        lead_ru: prm.lead_ru.clone(),
        type_of_request: prm.type_of_request.clone(),
        process_type: prm.process_type.clone(),
        type_of_information: TypeOfInformation::FinalOffer,
        path_information: PdmPathInformation {
            locations,
            calendar: PdmCalendar {
                validity_period: PdmValidityPeriod {
                    start: prm.path_information.planned_calendar.validity_period.start.to_rfc3339(),
                    end: prm.path_information.planned_calendar.validity_period.end.to_rfc3339(),
                },
            },
        },
    };

    let xml = to_string(&msg)
        .map_err(|e| TsiError::XmlSerialize(e.to_string()))?;

    Ok(format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n{}",
        xml
    ))
}


// This function generates the identifiers required for the PDM. 
fn build_identifiers(prm: &PathRequestMessage) -> Result<PdmIdentifiers, TsiError> {
    // 1. Copy the identifiers from the PRM:
    let mut identifiers: Vec<PdmPlannedTransportIdentifier> = prm
        .identifiers
        .planned_transport_identifiers
        .iter()
        .map(|id| PdmPlannedTransportIdentifier {
                    object_type: id.object_type.clone(),
            company: id.company.clone(),
            core: id.core.clone(),
            variant: id.variant.clone(),
            timetable_year: id.timetable_year,
        })
        .collect();

    // 2. Add the PA (Path) generated by the infrastructure manager.
    // ID core, has to be exatly 12 characters long and follow the [\-\*0-9A-Z]{12} pattern.
    // TODO: Should we generate it ?
    let id_core = Uuid::new_v4()
        .to_string()
        .replace('-', "")
        .to_uppercase()
        [..12]
        .to_string();

    // TODO: take into account the date of the Annual Service change
    let timetable_year = prm
    .identifiers
    .planned_transport_identifiers
    .first()
    .map(|id| id.timetable_year)
    .unwrap_or_else(|| {
        prm.path_information
            .planned_calendar
            .validity_period
            .start
            .year() as u16
    });

    identifiers.push(PdmPlannedTransportIdentifier {
        object_type: ObjectType::Path,
        company: prm.message_header.recipient.clone(),
        core: id_core,
        variant: CORE_VARIANT.to_string(),
        timetable_year,
    });

    Ok(PdmIdentifiers { identifiers })
}

// This function generates journey locations required for the PDM.
// Locations are extracted from the PRM, Timings comes from the STDCM simulation output.
fn build_pdm_locations(
    prm_loc: &PlannedJourneyLocation,
    index: usize,
    departure_time: DateTime<FixedOffset>,
    path_item_times: &[u64],
    is_first_im: bool,
) -> Result<PdmJourneyLocation, TsiError> {
    // Forward planning:
    // 1st IM: Origin → ALD, Handover → ALA
    // 2nd IM: Handover → ALD, Destination → ALA
    let is_departure_location = if is_first_im {
        prm_loc.journey_location_type_code == JourneyLocationTypeCode::Origin
    } else {
        prm_loc.journey_location_type_code == JourneyLocationTypeCode::Handover
    };

    let is_arrival_location = if is_first_im {
        prm_loc.journey_location_type_code == JourneyLocationTypeCode::Handover
    } else {
        prm_loc.journey_location_type_code == JourneyLocationTypeCode::Destination
    };

    // Location arrival time = departure_time + path_item_times
    let arrival_time = departure_time
        + Duration::milliseconds(
            path_item_times.get(index).copied().unwrap_or(0) as i64,
        );

    // Location departure time = arrival_time + dwell_time
    let dwell_ms = tenth_of_minute_to_ms(prm_loc.timing_at_location.dwell_time);
    let departure_from_stop = arrival_time + Duration::milliseconds(dwell_ms as i64);

    let timings = if is_departure_location {
        vec![PdmTiming {
            qualifier: "ALD",
            time: departure_time.format("%H:%M:%S").to_string(),
            offset: 0,
        }]
    } else if is_arrival_location {
        vec![PdmTiming {
            qualifier: "ALA",
            time: arrival_time.format("%H:%M:%S").to_string(),
            offset: day_offset(departure_time, arrival_time),
        }]
    } else {
        // Intermediate : ALA + ALD
        vec![
            PdmTiming {
                qualifier: "ALA",
                time: arrival_time.format("%H:%M:%S").to_string(),
                offset: day_offset(departure_time, arrival_time),
            },
            PdmTiming {
                qualifier: "ALD",
                time: departure_from_stop.format("%H:%M:%S").to_string(),
                offset: day_offset(departure_time, departure_from_stop),
            },
        ]
    };

    // In the PDM, only intermediate locations have a dwell time.
    let pdm_dwell_time = if !is_departure_location && !is_arrival_location && dwell_ms > 0 {
        Some(ms_to_tenth_of_minute(dwell_ms))
    } else {
        None
    };

    // PlannedTrainData is the same than in the PRM.
    let planned_train_data = prm_loc.planned_train_data.as_ref().map(|d| {
        PdmPlannedTrainData {
            train_type: match d.train_type {
                TrainType::Passenger => 1,
                TrainType::Freight => 2,
                TrainType::Locomotive | TrainType::Other => 3,
            },
            technical_data: build_technical_data(&d.technical_data),
        }
    });

    Ok(PdmJourneyLocation {
        country_code: prm_loc.country_code_iso.clone(),
        location_primary_code: prm_loc.location_primary_code.to_string(),
        primary_location_name: prm_loc.primary_location_name.clone(),
        timing: PdmTimingAtLocation {
            timings,
            dwell_time: pdm_dwell_time,
        },
        responsible_applicant: if is_departure_location {
            prm_loc.responsible_applicant.clone()
        } else {
            None
        },
        responsible_ru: if is_departure_location {
            prm_loc.responsible_ru.clone()
        } else {
            None
        },
        responsible_im: prm_loc.responsible_im.clone(),
        planned_train_data,
        operational_train_number: if is_departure_location {
            prm_loc.operational_train_number.clone()
        } else {
            None
        },
        journey_location_type_code: match prm_loc.journey_location_type_code {
            JourneyLocationTypeCode::Origin => "01",
            JourneyLocationTypeCode::Intermediate => "02",
            JourneyLocationTypeCode::Destination => "03",
            JourneyLocationTypeCode::Handover => "04",
            JourneyLocationTypeCode::Other => "02",
        }
        .to_string(),
    })
}

fn day_offset(departure_time: DateTime<FixedOffset>, time: DateTime<FixedOffset>) -> i64 {
    (time.date_naive() - departure_time.date_naive()).num_days()
}


fn build_technical_data(data: &PlannedTrainTechnicalData) -> PdmTechnicalData {
    PdmTechnicalData {
        train_weight: data.train_weight as u32,
        train_length: data.train_length as u32,
        train_max_speed: data.train_max_speed as u32,
    }
}

/// Workaround: reconstruct path_item_times from path_item_positions and simulation positions/times.
/// TODO: remove this function when path_item_times is fixed in the core simulation output.
fn reconstruct_path_item_times(
    path_item_positions: &[u64],
    positions: &[u64],
    times: &[u64],
) -> Vec<u64> {
    path_item_positions
        .iter()
        .map(|&target_pos| {
            positions
                .iter()
                .position(|&p| p == target_pos)
                .map(|j| times[j])
                .unwrap_or(0)
        })
        .collect()
}
