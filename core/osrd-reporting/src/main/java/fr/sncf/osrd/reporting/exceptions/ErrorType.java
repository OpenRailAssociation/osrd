package fr.sncf.osrd.reporting.exceptions;

public enum ErrorType {
    ImpossibleSimulationError(
            "impossible_simulation",
            "The requested train stopped before reaching its destination (not enough traction)",
            ErrorCause.USER
    ),

    AllowanceConvergenceDiscontinuity(
            "allowance_convergence",
            "Failed to converge when computing allowances because of a discontinuity in the search space",
            ErrorCause.INTERNAL
    ),

    AllowanceConvergenceTooMuchTime(
            "allowance_convergence",
            "We could not go slow enough in this setting to match the given allowance time",
            ErrorCause.USER
    ),

    AllowanceConvergenceNotEnoughTime(
            "allowance_convergence",
            "We could not go fast enough in this setting to match the given allowance time",
            ErrorCause.INTERNAL
    ),

    NotImplemented(
            "not_implemented",
            "Not implemented",
            ErrorCause.INTERNAL
    ),
    DiagnosticError(
            "diagnostic",
            "A running diagnostic contains errors",
            ErrorCause.USER
    ),
    StrictWarningError(
            "strict_warning",
            "Warning was reported with strict mode enabled",
            ErrorCause.USER
    ),
    AssertionError(
            "assert_error",
            "assert check failed",
            ErrorCause.INTERNAL
    ),
    InfraSoftLoadingError(
            "infra_loading:soft_error",
            "soft error while loading new infra",
            ErrorCause.USER
    ),
    InfraHardLoadingError(
            "infra_loading:hard_error",
            "hard error while loading new infra",
            ErrorCause.USER
    ),
    InfraLoadingCacheException(
            "infra_loading:cache_exception",
            "cached exception",
            ErrorCause.USER
    ),
    InfraLoadingInvalidStatusException(
            "infra_loading:invalid_status",
            "Status doesn’t exist",
            ErrorCause.USER
    ),
    InfraInvalidStatusWhileWaitingStable(
            "infra_loading:invalid_status_waiting_stable",
            "invalid status after waitUntilStable",
            ErrorCause.USER
    ),
    InfraNotLoadedException(
            "infra:not_loaded",
            "Infra not loaded",
            ErrorCause.USER
    ),
    InfraInvalidVersionException(
            "infra:invalid_version",
            "Invalid infra version",
            ErrorCause.USER
    ),
    PathfindingGenericError(
            "no_path_found",
            "No path could be found",
            ErrorCause.USER
    ),
    PathfindingGaugeError(
            "no_path_found:gauge",
            "No path could be found after loading Gauge constraints",
            ErrorCause.USER
    ),
    PathfindingElectrificationError(
            "no_path_found:electrification",
            "No path could be found after loading Electrification constraints",
            ErrorCause.USER
    ),
    InvalidInfraDiscontinuousRoute(
            "invalid_infra:discontinuous_route",
            "Route track path isn't contiguous",
            ErrorCause.USER
    ),
    InvalidInfraMissingDetectorsRoute(
            "invalid_infra:missing_detectors",
            "Missing detectors on route (expected at least 2)",
            ErrorCause.USER
    ),
    InvalidInfraEndpointAlreadyLinked(
            "invalid_infra:endpoint_already_linked",
            "Error in track link: at least one endpoint is already linked",
            ErrorCause.USER
    ),
    InvalidInfraTrackSlopeWithInvalidRange(
            "invalid_infra:track_slope_invalid_range",
            "Track has a slope with an invalid range",
            ErrorCause.USER
    ),
    InvalidInfraTrackCurveWithInvalidRange(
            "invalid_infra:track_curve_invalid_range",
            "Track has a curve with an invalid range",
            ErrorCause.USER
    ),
    InvalidInfraWrongSwitchPorts(
            "invalid_infra:wrong_switch_ports",
            "Switch doesn't have the right ports for this type",
            ErrorCause.USER
    ),
    SignalizationError(
            "signalization",
            "Infinite loop in signal dependency updates",
            ErrorCause.USER
    ),
    InvalidRollingStockMajorVersionMismatch(
            "invalid_rolling_stock:major_version_mismatch",
            "Invalid rolling stock: major version mismatch",
            ErrorCause.USER
    ),
    InvalidRollingStockDefaultModeNotFound(
            "invalid_rolling_stock:default_mode_not_found",
            "Invalid rolling stock: didn't find default mode",
            ErrorCause.USER
    ),
    InvalidRollingStockEffortCurve(
            "invalid_rolling_stock:effort_curve",
            "Invalid rolling stock effort curve, speeds and max_efforts should be same length",
            ErrorCause.USER
    ),
    InvalidRollingStockField(
            "invalid_rolling_stock_field",
            "Invalid rolling stock field",
            ErrorCause.USER
    ),
    MissingRollingStockField(
            "missing_rolling_stock_field",
            "missing rolling stock field",
            ErrorCause.USER
    ),

    InvalidScheduleTrackDoesNotExist(
            "invalid_schedule",
            "Track %s referenced in path step does not exist",
            ErrorCause.USER
    ),
    InvalidScheduleTrackLocationNotIncludedInPath(
            "invalid_schedule",
            "TrackLocation isn't included in the path",
            ErrorCause.USER
    ),
    InvalidScheduleStartLocationNotIncluded(
            "invalid_schedule",
            "Start location isn't included in the route graph",
            ErrorCause.USER
    ),
    InvalidScheduleEndLocationNotIncluded(
            "invalid_schedule",
            "End location isn't included in the route graph",
            ErrorCause.USER
    ),
    InvalidScheduleRouteNotFound(
            "invalid_schedule",
            "Can't find route",
            ErrorCause.USER
    ),
    InvalidScheduleInvalidInitialSpeed(
            "invalid_schedule",
            "invalid initial speed",
            ErrorCause.USER
    ),
    InvalidScheduleOverlappingAllowanceRanges(
            "invalid_schedule",
            "overlapping allowance ranges",
            ErrorCause.USER
    ),
    InvalidScheduleMissingMinute(
            "invalid_schedule",
            "missing minutes in time per distance allowance",
            ErrorCause.USER
    ),
    InvalidScheduleMissingSeconds(
            "invalid_schedule",
            "missing seconds in time allowance",
            ErrorCause.USER
    ),
    InvalidScheduleMissingPercentage(
            "invalid_schedule",
            "missing percentage in percentage allowance",
            ErrorCause.USER
    ),
    InvalidScheduleNoTrainStop(
            "invalid_schedule",
            "The train schedule must have at least one train stop",
            ErrorCause.USER
    ),
    InvalidScheduleMissingTrainStopLocation(
            "invalid_schedule",
            "Train stop must specify exactly one of position or location",
            ErrorCause.USER
    ),
    InvalidScheduleOutsideTrainStopPosition(
            "invalid_schedule",
            "Stop position is outside of the path",
            ErrorCause.USER
    ),
    InvalidScheduleInvalidTrackSectionOffset(
            "invalid_schedule",
            "invalid track section offset",
            ErrorCause.USER
    ),
    InvalidSchedulePoint(
        "invalid_schedule",
        "invalid scheduled point: position greater that path length",
        ErrorCause.USER
    ),
    InvalidTrackRangeInvalidTrackSectionOffset(
            "invalid_track_range",
            "Offset %s is not contained in the track ranges view",
            ErrorCause.USER
    ),

    InvalidRouteNoOffset(
            "invalid_route",
            "Couldn't find offset on route",
            ErrorCause.USER
    ),

    InvalidPathError(
            "invalid_path",
            "Detector offsets must be strictly increasing",
            ErrorCause.USER
    ),
    UnknownRollingStock(
            "unknown_stock",
            "unknown rolling stock",
            ErrorCause.USER
    ),
    UnknownTrackSection(
            "unknown_track_section",
            "unknown track section",
            ErrorCause.USER
    ),
    UnknownAspect(
            "unknown_aspect",
            "unknown aspect: %s",
            ErrorCause.USER
    ),
    UnknownAllowanceType(
            "unknown_allowance_type",
            "unknown allowance type",
            ErrorCause.USER
    ),
    UnknownAllowanceValueType(
            "unknown_allowance_value_type",
            "unknown allowance value type",
            ErrorCause.USER
    ),
    MissingAttributeError(
            "missing_attribute",
            "referencing missing attribute",
            ErrorCause.INTERNAL
    ),
    EnvelopeStopIndexOutOfBounds(
            "envelope_error",
            "Stop at index %d is out of bounds",
            ErrorCause.USER
    ),
    EnvelopePartsNotContiguous(
            "envelope_error",
            "invalid envelope, envelope parts are not contiguous",
            ErrorCause.USER
    ),
    NoCompatibleEnvelopeFound(
            "no_compatible_envelope",
            "Couldn't find an envelope that wouldn't cause a conflict",
            ErrorCause.USER
    ),
    SignalingError(
            "signaling_error",
            "Unknown signaling system: $sigSystem",
            ErrorCause.USER
    ),
    SigSchemaInvalidFieldError(
            "sig_schema_field_error",
            "invalid sig schema field",
            ErrorCause.USER
    ),
    SigSchemaUnknownFieldError(
            "sig_schema_field_error",
            "unknown sig schema field",
            ErrorCause.USER
    ),

    InvalidSTDCMDelayError(
            "invalid_stdcm",
            "STDCM lookahead isn't supported yet",
            ErrorCause.USER
    ),
    InvalidSTDCMUnspecifiedStartTime(
            "invalid_stdcm",
            "STDCM requests with unspecified start time are not supported yet",
            ErrorCause.USER
    ),
    InvalidSTDCMUnspecifiedStartAndEndTime(
            "invalid_stdcm",
            "Invalid STDCM request: both end time and start time are unspecified, at least one must be set",
            ErrorCause.USER
    ),
    BALUnprotectedZones(
            "unprotected_zones",
            "BAL signals always protect zones",
            ErrorCause.USER
    ),
    BAPRUnprotectedZones(
            "unprotected_zones",
            "BAPR signals always protect zones",
            ErrorCause.USER
    ),
    UnexpectedReservationStatus(
            "unexpected_reservation_status",
            "unexpected reservation status",
            ErrorCause.USER
    ),
    IncompatibleZoneRequirements(
            "incompatible_zone_requirements",
            "incompatible zone requirements",
            ErrorCause.USER
    ),
    ActionLockRequired(
            "action_lock_required",
            "action lock required",
            ErrorCause.USER
    ),
    BlockedSimulationException(
            "blocked_simulation_exception",
            "the discrete simulation blocked without completing",
            ErrorCause.USER
    ),
    EPSetSoftLoadingError(
            "electrical_profile_set_loading:soft_error",
            "soft error while loading new electrical profile set",
            ErrorCause.INTERNAL
    ),
    EPSetHardLoadingError(
            "electrical_profile_set_loading:hard_error",
            "hard error while loading new electrical profile set",
            ErrorCause.INTERNAL
    ),
    EPSetLoadingCacheException(
            "electrical_profile_set_loading:cache_exception",
            "Electrical profile set already had a hard loading error",
            ErrorCause.INTERNAL
    ),
    EPSetInvalidStatusAfterLoading(
            "electrical_profile_set_loading:invalid_cache_status",
            "Electrical profile set had invalid status after loading",
            ErrorCause.INTERNAL
    ),
    ;

    public final String type;
    public final String message;
    public final ErrorCause cause;

    ErrorType(String type, String message, ErrorCause cause) {
        this.type = type;
        this.message = message;
        this.cause = cause;
    }
}
