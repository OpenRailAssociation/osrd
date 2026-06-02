use chrono::DateTime;
use chrono::FixedOffset;
use chrono::NaiveTime;
use schemas::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;

const TENTH_MINUTE_MS: f64 = 6_000.0;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ObjectType {
    #[serde(rename = "TR")]
    TrainReference,
    #[serde(rename = "RO")]
    Route,
    #[serde(rename = "PA")]
    Path,
    #[serde(rename = "PR")]
    PathRequest,
    #[serde(rename = "CR")]
    CaseReference,
    #[serde(other)]
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TypeOfInformation {
    /// Harmonization completed, request ready
    #[serde(rename = "4")]
    RequestReady,
    /// Path study request
    #[serde(rename = "5")]
    PathStudyRequest,
    /// Final offer
    #[serde(rename = "16")]
    FinalOffer,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TypeOfRequest {
    #[serde(rename = "1")]
    Study,
    #[serde(rename = "2")]
    Request,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ProcessType {
    /// Short-term path request and allocation process (ad-hoc)
    #[serde(rename = "2")]
    ShortTermPathRequest,
}

#[derive(Debug, Deserialize, Clone)]
pub struct PlannedTransportIdentifier {
    #[serde(rename = "ObjectType")]
    pub object_type: ObjectType,
    #[serde(rename = "Company")]
    pub company: String,
    #[serde(rename = "Core")]
    pub core: String,
    #[serde(rename = "Variant")]
    pub variant: String,
    #[serde(rename = "TimetableYear")]
    pub timetable_year: u16,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Identifiers {
    #[serde(rename = "PlannedTransportIdentifiers", default)]
    pub planned_transport_identifiers: Vec<PlannedTransportIdentifier>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MessageHeader {
    #[serde(rename = "MessageReference")]
    pub message_reference: MessageReference,
    #[serde(rename = "MessageRoutingID")]
    pub message_routing_id: String,
    #[serde(rename = "Sender")]
    pub sender: String,
    #[serde(rename = "Recipient")]
    pub recipient: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MessageReference {
    #[serde(rename = "MessageType")]
    pub message_type: MessageType,
    #[serde(rename = "MessageTypeVersion")]
    pub message_type_version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum MessageType {
    #[serde(rename = "2003")]
    PathDetailsMessage,
    #[serde(rename = "2006")]
    PathRequestMessage,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ValidityPeriod {
    #[serde(rename = "StartDateTime")]
    pub start: DateTime<FixedOffset>,
    #[serde(rename = "EndDateTime")]
    pub end: DateTime<FixedOffset>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct PlannedCalendar {
    #[serde(rename = "ValidityPeriod")]
    pub validity_period: ValidityPeriod,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub enum JourneyLocationTypeCode {
    #[serde(rename = "01")]
    Origin,
    #[serde(rename = "02")]
    Intermediate,
    #[serde(rename = "03")]
    Destination,
    #[serde(rename = "04")]
    Handover,
    #[serde(other)]
    Other,
}

/// TAF-TSI timing qualifier codes.
/// ERT, ART and LRT are explicitly not used per spec.
#[allow(clippy::upper_case_acronyms)]
#[derive(Debug, Deserialize, Clone, PartialEq)]
pub enum TimingQualifierCode {
    /// Earliest Location Departure — PRM forward planning (1st IM)
    ELD,
    /// Actual Location Departure — PRM forward planning (2nd IM) / PDM
    ALD,
    /// Latest Location Arrival — PRM backward planning (1st IM)
    LLA,
    /// Actual Location Arrival — PDM / PRM backward planning (2nd IM)
    ALA,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Timing {
    #[serde(rename = "@TimingQualifierCode")]
    pub qualifier: TimingQualifierCode,
    /// Resolution: 1/10th of a minute.
    #[serde(rename = "Time")]
    pub time: NaiveTime,
    /// Day offset relative to first location, 0 = same day.
    #[serde(rename = "Offset")]
    pub offset: u8,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TimingAtLocation {
    #[serde(rename = "Timing")]
    pub timing: Option<Timing>,
    /// DwellTime unit: 1/10th of a minute.
    #[serde(rename = "DwellTime")]
    #[serde(default)]
    pub dwell_time: f64,
}

pub fn tenth_of_minute_to_ms(dt: f64) -> u64 { (dt * TENTH_MINUTE_MS).round() as u64 }
pub fn ms_to_tenth_of_minute(ms: u64) -> f64 { ms as f64 / TENTH_MINUTE_MS }

#[derive(Debug, Deserialize, Clone)]
pub struct PlannedTrainTechnicalData {
    /// Full train weight in t.
    #[serde(rename = "TrainWeight")]
    pub train_weight: f64,
    /// Full train length in m.
    #[serde(rename = "TrainLength")]
    pub train_length: f64,
    /// Maximum speed in km/h.
    #[serde(rename = "TrainMaxSpeed")]
    pub train_max_speed: f64,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Default)]
pub enum TrainType {
    #[serde(rename = "1")]
    Passenger,
    #[serde(rename = "2")]
    Freight,
    #[serde(rename = "3")]
    #[default]
    Locomotive,
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize, Clone)]
pub struct PlannedTrainData {
    #[serde(rename = "TrainType")]
    #[serde(default)]
    pub train_type: TrainType,
    #[serde(rename = "PlannedTrainTechnicalData")]
    pub technical_data: PlannedTrainTechnicalData,
}

/// Shared journey location structure used in both PRM and PDM.
#[derive(Debug, Deserialize, Clone)]
pub struct PlannedJourneyLocation {
    #[serde(rename = "CountryCodeISO")]
    pub country_code_iso: String,
    #[serde(rename = "LocationPrimaryCode")]
    pub location_primary_code: Identifier,
    #[serde(rename = "JourneyLocationTypeCode")]
    pub journey_location_type_code: JourneyLocationTypeCode,
    #[serde(rename = "TimingAtLocation")]
    pub timing_at_location: TimingAtLocation,
    #[serde(rename = "ResponsibleIM")]
    pub responsible_im: String,
    #[serde(rename = "PrimaryLocationName")]
    #[serde(default)]
    pub primary_location_name: Option<String>,
    #[serde(rename = "ResponsibleApplicant")]
    #[serde(default)]
    pub responsible_applicant: Option<String>,
    #[serde(rename = "ResponsibleRU")]
    #[serde(default)]
    pub responsible_ru: Option<String>,
    #[serde(rename = "OperationalTrainNumber")]
    #[serde(default)]
    pub operational_train_number: Option<String>,
    #[serde(rename = "PlannedTrainData")]
    #[serde(default)]
    pub planned_train_data: Option<PlannedTrainData>,
}


#[derive(Debug, Deserialize, Clone)]
pub struct PathInformation {
    #[serde(rename = "PlannedJourneyLocation", default)]
    pub planned_journey_locations: Vec<PlannedJourneyLocation>,
    #[serde(rename = "PlannedCalendar")]
    pub planned_calendar: PlannedCalendar,
}
