use chrono::DateTime;
use chrono::FixedOffset;
use chrono::TimeZone;
use common::units;
use serde::Deserialize;

use schemas::train_schedule::Comfort;
use schemas::train_schedule::MarginValue;
use schemas::train_schedule::OperationalPointPartReference;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;

use crate::views::timetable::stdcm::request::ConsistConfiguration;
use crate::views::timetable::stdcm::request::ConsistSchedule;
use crate::views::timetable::stdcm::request::PathfindingItem;
use crate::views::timetable::stdcm::request::Request;
use crate::views::timetable::stdcm::request::StepTimingData;

use crate::views::timetable::stdcm::tsi::taftsi::Identifiers;
use crate::views::timetable::stdcm::tsi::taftsi::JourneyLocationTypeCode;
use crate::views::timetable::stdcm::tsi::taftsi::MessageHeader;
use crate::views::timetable::stdcm::tsi::taftsi::MessageType;
use crate::views::timetable::stdcm::tsi::taftsi::PathInformation;
use crate::views::timetable::stdcm::tsi::taftsi::PlannedJourneyLocation;
use crate::views::timetable::stdcm::tsi::taftsi::ProcessType;
use crate::views::timetable::stdcm::tsi::taftsi::Timing;
use crate::views::timetable::stdcm::tsi::taftsi::TimingQualifierCode;
use crate::views::timetable::stdcm::tsi::taftsi::TypeOfInformation;
use crate::views::timetable::stdcm::tsi::taftsi::TypeOfRequest;
use crate::views::timetable::stdcm::tsi::taftsi::tenth_of_minute_to_ms;

use crate::views::timetable::stdcm::tsi::TsiError;

#[derive(Debug, Deserialize)]
#[serde(rename = "PathRequestMessage")]
#[serde(remote = "Self")]
pub struct PathRequestMessage {
    #[serde(rename = "MessageHeader")]
    pub message_header: MessageHeader,
    #[serde(rename = "Identifiers")]
    pub identifiers: Identifiers,
    #[serde(rename = "LeadRU")]
    pub lead_ru: String,
    #[serde(rename = "CoordinatingIM")]
    pub coordinating_im: String,
    #[serde(rename = "TypeOfRequest")]
    pub type_of_request: TypeOfRequest,
    #[serde(rename = "ProcessType")]
    pub process_type: ProcessType,
    #[serde(rename = "TypeOfInformation")]
    pub type_of_information: TypeOfInformation,
    #[serde(rename = "PathInformation")]
    pub path_information: PathInformation,
}

impl<'de> Deserialize<'de> for PathRequestMessage {
    fn deserialize<D>(deserializer: D) -> Result<PathRequestMessage, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let prm = PathRequestMessage::deserialize(deserializer)?;

        // Validation
        if prm.message_header.message_reference.message_type != MessageType::PathRequestMessage {
            return Err(serde::de::Error::custom(
                "Invalid message type: expected PathRequestMessage (2006)",
            ));
        }

        if !matches!(
            prm.type_of_information,
            TypeOfInformation::RequestReady | TypeOfInformation::PathStudyRequest
        ) {
            return Err(serde::de::Error::custom(
                "Invalid TypeOfInformation: expected 4 (RequestReady) or 5 (PathStudyRequest)",
            ));
        }

        let locations = &prm.path_information.planned_journey_locations;

        if locations.len() < 2 {
            return Err(serde::de::Error::custom(
                "PRM must contain at least 2 journey locations",
            ));
        }

        locations
            .iter()
            .find_map(|loc| loc.planned_train_data.as_ref())
            .ok_or_else(|| serde::de::Error::custom("PRM contains no PlannedTrainTechnicalData"))?;

        let has_origin = locations
            .iter()
            .any(|loc| loc.journey_location_type_code == JourneyLocationTypeCode::Origin);

        let has_destination = locations
            .iter()
            .any(|loc| loc.journey_location_type_code == JourneyLocationTypeCode::Destination);

        let has_handover = locations
            .iter()
            .any(|loc| loc.journey_location_type_code == JourneyLocationTypeCode::Handover);

        // Forward planning
        // Must have either Origin+Handover (1st IM) or Handover+Destination (2nd IM)
        // TODO: Implement backward planning
        if has_origin && has_handover {
            // 1st IM — ok
        } else if has_destination && has_handover {
            // 2nd IM — ok
        } else {
            return Err(serde::de::Error::custom(
                "PRM must have either Origin+Handover or Handover+Destination",
            ));
        }

        let (expected_qualifier, expected_timing) = if has_origin {
            (JourneyLocationTypeCode::Origin, TimingQualifierCode::ELD) // 1st IM: ELD on origin 
        } else {
            (JourneyLocationTypeCode::Handover, TimingQualifierCode::ALD) // 2nd IM: ALD on handover
        };

        let departure_location = locations
            .iter()
            .find(|loc| loc.journey_location_type_code == expected_qualifier)
            .ok_or_else(|| serde::de::Error::custom("No departure location found"))?;

        // Departure time is mandatory on the departure location
        departure_location
            .timing_at_location
            .timing
            .as_ref()
            .filter(|t| t.qualifier == expected_timing)
            .ok_or_else(|| {
                serde::de::Error::custom(
                    "Departure location has no valid timing qualifier (ELD or ALD)",
                )
            })?;

        // Validate departure time is not ambiguous (DST transition)
        let timing = departure_location
            .timing_at_location
            .timing
            .as_ref()
            .unwrap(); // guaranteed by previous validation

        let reference_date = prm.path_information.planned_calendar.validity_period.start;
        let dt = reference_date.date_naive().and_time(timing.time)
            + chrono::Duration::days(timing.offset as i64);

        reference_date
            .timezone()
            .from_local_datetime(&dt)
            .single()
            .ok_or_else(|| {
                serde::de::Error::custom("Ambiguous departure datetime (DST transition)")
            })?;

        // ResponsibleApplicant and ResponsibleRU are mandatory on the departure location
        departure_location
            .responsible_applicant
            .as_ref()
            .ok_or_else(|| {
                serde::de::Error::custom("Missing ResponsibleApplicant in PRM departure location")
            })?;

        departure_location.responsible_ru.as_ref().ok_or_else(|| {
            serde::de::Error::custom("Missing ResponsibleRU in PRM departure location")
        })?;

        Ok(prm)
    }
}

pub fn parse_xml(xml: &[u8]) -> Result<PathRequestMessage, TsiError> {
    let xml = std::str::from_utf8(xml).map_err(|_| TsiError::InvalidEncoding)?;
    quick_xml::de::from_str::<PathRequestMessage>(&xml).map_err(TsiError::XmlParse)
}

pub fn into_stdcm_request(
    prm: &PathRequestMessage,
    rolling_stock_id: i64,
) -> Result<Request, TsiError> {
    let reference_date = prm.path_information.planned_calendar.validity_period.start;

    let technical_data = prm
        .path_information
        .planned_journey_locations
        .iter()
        .find_map(|loc| loc.planned_train_data.as_ref().map(|d| &d.technical_data))
        .unwrap(); // at least one location has planned_train_data guaranteed by Deserialize validation

    let steps = prm
        .path_information
        .planned_journey_locations
        .iter()
        .map(|loc| build_step(loc, reference_date))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Request {
        start_time: None,
        steps,
        electrical_profile_set_id: None,
        work_schedule_group_id: None,
        temporary_speed_limit_group_id: None,
        comfort: Comfort::Standard,
        maximum_departure_delay: None,
        maximum_run_time: None,
        time_gap_before: 0,
        time_gap_after: 0,
        margin: Some(MarginValue::MinPer100Km(4.5)),
        allowed_track_sections: Default::default(),
        consist_schedule: ConsistSchedule {
            boundaries: vec![],
            values: vec![ConsistConfiguration {
                rolling_stock_id,
                towed_rolling_stock_id: None,
                total_mass: Some(units::kilogram::new(technical_data.train_weight * 1_000.0)),
                total_length: Some(units::meter::new(technical_data.train_length)),
                max_speed: Some(units::meter_per_second::new(
                    technical_data.train_max_speed / 3.6,
                )),
                speed_limit_tag: None,
                loading_gauge_type: None,
            }],
        },
    })
}

fn build_step(
    journey_location: &PlannedJourneyLocation,
    reference_date: DateTime<FixedOffset>,
) -> Result<PathfindingItem, TsiError> {
    // TODO: use PLC instead of OSRD internal ID when available in railjson
    let location = PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
        operational_point: OperationalPointReference::Id {
            operational_point: journey_location.location_primary_code.clone(),
        },
        local_track_name: None,
    });

    let timing_data = journey_location
        .timing_at_location
        .timing
        .as_ref()
        .filter(|t| {
            matches!(
                t.qualifier,
                TimingQualifierCode::ELD | TimingQualifierCode::ALD
            )
        })
        .map(|timing| build_timing_data(timing, reference_date))
        .transpose()?;

    // DwellTime of 0 means no stop
    let duration = {
        let ms = tenth_of_minute_to_ms(journey_location.timing_at_location.dwell_time);
        if ms > 0 { Some(ms) } else { None }
    };

    Ok(PathfindingItem {
        duration,
        location,
        timing_data,
    })
}

fn build_timing_data(
    timing: &Timing,
    reference_date: DateTime<FixedOffset>,
) -> Result<StepTimingData, TsiError> {
    let dt = reference_date.date_naive().and_time(timing.time)
        + chrono::Duration::days(timing.offset as i64);

    let arrival_time = reference_date
        .timezone()
        .from_local_datetime(&dt)
        .single()
        .unwrap() // guaranteed by Deserialize validation
        .to_utc();

    Ok(StepTimingData {
        arrival_time,
        arrival_time_tolerance_before: 0,
        arrival_time_tolerance_after: 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    use chrono::DateTime;
    use chrono::NaiveTime;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use crate::views::timetable::stdcm::tsi::taftsi::JourneyLocationTypeCode;
    use crate::views::timetable::stdcm::tsi::taftsi::TimingQualifierCode;
    use crate::views::timetable::stdcm::tsi::taftsi::TypeOfInformation;

    const PRM_2ND_IM: &[u8] = include_bytes!("../../tests/prm_2de_im.xml");

    #[test]
    fn parses_mock_prm() {
        let prm = parse_xml(PRM_2ND_IM).expect("mock PRM must parse");

        assert_eq!(prm.lead_ru, "0002");
        assert_eq!(prm.coordinating_im, "0001");
        assert_eq!(prm.type_of_information, TypeOfInformation::RequestReady);

        let locations = &prm.path_information.planned_journey_locations;
        // Only `PathInformation` locations are read; the `TrainInformation` block is intentionally ignored.
        assert_eq!(locations.len(), 2);
        assert_eq!(
            locations[0].journey_location_type_code,
            JourneyLocationTypeCode::Handover
        );
        assert_eq!(
            locations[1].journey_location_type_code,
            JourneyLocationTypeCode::Destination
        );
    }

    #[test]
    fn timing_qualifier_parsed_despite_namespaced_attribute() {
        let prm = parse_xml(PRM_2ND_IM).unwrap();
        let departure = &prm.path_information.planned_journey_locations[0];

        let timing = departure
            .timing_at_location
            .timing
            .as_ref()
            .expect("the handover carries an ALD timing");

        assert_eq!(timing.qualifier, TimingQualifierCode::ALD);
        assert_eq!(timing.time, "21:30:00".parse::<NaiveTime>().unwrap());
        assert_eq!(timing.offset, 0);
    }

    /// PlannedTrainTechnicalData contains traction/braking details (TractionDetails,
    /// RouteClass, BrakeType…) that editoast derives from the rolling_stock_id query parameter,
    /// so we skip them and only read the consist's weight/length/max speed.
    /// Assert we still read the right values despite interleaved elements.
    #[test]
    fn reads_technical_data_through_interleaved_elements() {
        let prm = parse_xml(PRM_2ND_IM).unwrap();

        let technical_data = prm
            .path_information
            .planned_journey_locations
            .iter()
            .find_map(|loc| loc.planned_train_data.as_ref())
            .map(|data| &data.technical_data)
            .expect("at least one location carries technical data");

        assert_eq!(technical_data.train_weight, 90.0);
        assert_eq!(technical_data.train_length, 17.0);
        assert_eq!(technical_data.train_max_speed, 140.0);
    }

    /// Business errors surface as TsiError::XmlParse.
    /// One fixture per invalid PRM.
    #[rstest]
    #[case::wrong_message_type(
    include_bytes!("../../tests/prm_wrong_message_type.xml"), "Invalid message type")]
    #[case::wrong_type_of_information(
    include_bytes!("../../tests/prm_wrong_type_of_information.xml"), "TypeOfInformation")]
    #[case::single_location(
    include_bytes!("../../tests/prm_single_location.xml"), "at least 2 journey locations")]
    #[case::no_technical_data(
    include_bytes!("../../tests/prm_no_technical_data.xml"), "no PlannedTrainTechnicalData")]
    #[case::no_handover(
    include_bytes!("../../tests/prm_no_handover.xml"), "Origin+Handover or Handover+Destination")]
    #[case::wrong_departure_qualifier(
    include_bytes!("../../tests/prm_wrong_departure_qualifier.xml"), "valid timing qualifier")]
    #[case::missing_responsible_applicant(
    include_bytes!("../../tests/prm_missing_responsible_applicant.xml"), "ResponsibleApplicant")]
    #[case::missing_responsible_ru(
    include_bytes!("../../tests/prm_missing_responsible_ru.xml"), "ResponsibleRU")]
    fn rejects_invalid_prm(#[case] xml: &[u8], #[case] expected: &str) {
        let err = match parse_xml(xml) {
            Err(TsiError::XmlParse(e)) => e.to_string(),
            other => panic!("expected an XmlParse error, got {other:?}"),
        };
        assert!(err.contains(expected), "unexpected error: {err}");
    }

    /// End-to-end conversion: units and timings from PRM -> STDCM request.
    #[test]
    fn into_stdcm_request_maps_units_and_timings() {
        let prm = parse_xml(PRM_2ND_IM).unwrap();
        let request = into_stdcm_request(&prm, 42).unwrap();

        assert_eq!(request.steps.len(), 2);

        let consist = &request.consist_schedule.values[0];
        assert_eq!(consist.rolling_stock_id, 42);
        assert_eq!(consist.total_mass, Some(units::kilogram::new(90_000.0))); // 90 t
        assert_eq!(consist.total_length, Some(units::meter::new(17.0))); // 17 m
        assert_eq!(
            consist.max_speed,
            Some(units::meter_per_second::new(140.0 / 3.6))
        ); // 140 km/h

        // Departure (handover): ALD 21:30:00 +02:00 -> 19:30:00 UTC ; DwellTime 2
        // (1/10 min) -> 12_000 ms.
        let departure = &request.steps[0];
        let timing = departure
            .timing_data
            .as_ref()
            .expect("departure step carries timing data");
        let expected = DateTime::parse_from_rfc3339("2026-06-10T19:30:00+00:00")
            .unwrap()
            .to_utc();
        assert_eq!(timing.arrival_time, expected);
        assert_eq!(departure.duration, Some(12_000));

        // Destination: no `Timing` element (only DwellTime 1) -> no timing data ;
        // dwell 1 -> 6_000 ms.
        let destination = &request.steps[1];
        assert!(destination.timing_data.is_none());
        assert_eq!(destination.duration, Some(6_000));
    }
}
