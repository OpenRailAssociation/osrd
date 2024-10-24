package fr.sncf.osrd.reporting.exceptions;

public enum ErrorType {
    ImpossibleSimulationError(
            "impossible_simulation",
            "The requested train stopped before reaching its destination (not enough traction)",
            ErrorCause.USER),

    AllowanceConvergenceDiscontinuity(
            "allowance_convergence",
            "Failed to converge when computing allowances because of a discontinuity in the search space",
            ErrorCause.INTERNAL),

    AllowanceConvergenceTooMuchTime(
            "allowance_convergence",
            "We could not go slow enough in this setting to match the given allowance time",
            ErrorCause.USER),

    AllowanceConvergenceNotEnoughTime(
            "allowance_convergence",
            "We could not go fast enough in this setting to match the given allowance time",
            ErrorCause.INTERNAL),

    NotImplemented("not_implemented", "Not implemented", ErrorCause.INTERNAL),
    DiagnosticError("diagnostic", "A running diagnostic contains errors", ErrorCause.USER),
    StrictWarningError("strict_warning", "Warning was reported with strict mode enabled", ErrorCause.USER),
    AssertionError("assert_error", "assert check failed", ErrorCause.INTERNAL),
    UnknownError("unknown_error", "An unknown exception was thrown", ErrorCause.INTERNAL),
    InfraSoftLoadingError("infra_loading:soft_error", "soft error while loading new infra", ErrorCause.USER, false),
    InfraHardLoadingError("infra_loading:hard_error", "hard error while loading new infra", ErrorCause.USER),
    InfraHardError("infra:hard_error", "hard error while parsing infra", ErrorCause.USER),
    InfraLoadingCacheException("infra_loading:cache_exception", "cached exception", ErrorCause.INTERNAL),
    InfraLoadingInvalidStatusException(
            "infra_loading:invalid_status", "infra not loaded correctly", ErrorCause.INTERNAL),
    InfraInvalidStatusWhileWaitingStable(
            "infra_loading:invalid_status_waiting_stable", "invalid status after waitUntilStable", ErrorCause.INTERNAL),
    InfraInvalidVersionException("infra:invalid_version", "Invalid infra version", ErrorCause.USER),
    PathfindingGenericError("no_path_found", "No path could be found", ErrorCause.USER),
    PathfindingGaugeError("no_path_found:gauge", "No path could be found with compatible Gauge", ErrorCause.USER),
    PathfindingElectrificationError(
            "no_path_found:electrification", "No path could be found with compatible electrification", ErrorCause.USER),
    PathfindingSignalisationSystemError(
            "no_path_found:signalisation_system",
            "No path could be found with a compatible signaling system",
            ErrorCause.USER),
    PathfindingTimeoutError(
            "no_path_found:timeout", "Pathfinding timed out: no path could be found", ErrorCause.INTERNAL),
    PathfindingRelaxedPathTimeoutError(
            "no_path_found:relaxed_path_timeout",
            "Relaxed pathfinding timed out: no path could be found, then relaxed path search timed out",
            ErrorCause.INTERNAL),
    InvalidInfraDiscontinuousRoute(
            "invalid_infra:discontinuous_route", "Route track path isn't contiguous", ErrorCause.USER),
    InvalidInfraMissingDetectorsRoute(
            "invalid_infra:missing_detectors", "Missing detectors on route (expected at least 2)", ErrorCause.USER),
    InvalidInfraTrackSlopeWithInvalidRange(
            "invalid_infra:track_slope_invalid_range", "Track has a slope with an invalid range", ErrorCause.USER),
    InvalidInfraTrackCurveWithInvalidRange(
            "invalid_infra:track_curve_invalid_range", "Track has a curve with an invalid range", ErrorCause.USER),
    InvalidInfraWrongSwitchPorts(
            "invalid_infra:wrong_switch_ports", "Switch doesn't have the right ports for this type", ErrorCause.USER),
    SignalizationError("signalization", "Infinite loop in signal dependency updates", ErrorCause.USER),
    InvalidRollingStockMajorVersionMismatch(
            "invalid_rolling_stock:major_version_mismatch",
            "Invalid rolling stock: major version mismatch",
            ErrorCause.USER),
    InvalidRollingStockDefaultModeNotFound(
            "invalid_rolling_stock:default_mode_not_found",
            "Invalid rolling stock: didn't find default mode",
            ErrorCause.USER),
    InvalidRollingStockEffortCurve(
            "invalid_rolling_stock:effort_curve",
            "Invalid rolling stock effort curve, speeds and max_efforts should be same length",
            ErrorCause.USER),
    InvalidRollingStockField("invalid_rolling_stock_field", "Invalid rolling stock field", ErrorCause.USER),
    MissingRollingStockField("missing_rolling_stock_field", "missing rolling stock field", ErrorCause.USER),

    InvalidScheduleTrackDoesNotExist(
            "invalid_schedule", "Track %s referenced in path step does not exist", ErrorCause.USER),
    InvalidScheduleTrackLocationNotIncludedInPath(
            "invalid_schedule", "TrackLocation isn't included in the path", ErrorCause.USER),
    InvalidScheduleStartLocationNotIncluded(
            "invalid_schedule", "Start location isn't included in the route graph", ErrorCause.USER),
    InvalidScheduleEndLocationNotIncluded(
            "invalid_schedule", "End location isn't included in the route graph", ErrorCause.USER),
    InvalidScheduleRouteNotFound("invalid_schedule", "Can't find route", ErrorCause.USER),
    InvalidScheduleInvalidInitialSpeed("invalid_schedule", "invalid initial speed", ErrorCause.USER),
    InvalidScheduleOverlappingAllowanceRanges("invalid_schedule", "overlapping allowance ranges", ErrorCause.USER),
    InvalidScheduleMissingMinute("invalid_schedule", "missing minutes in time per distance allowance", ErrorCause.USER),
    InvalidScheduleMissingSeconds("invalid_schedule", "missing seconds in time allowance", ErrorCause.USER),
    InvalidScheduleMissingPercentage("invalid_schedule", "missing percentage in percentage allowance", ErrorCause.USER),
    InvalidScheduleNoTrainStop(
            "invalid_schedule", "The train schedule must have at least one train stop", ErrorCause.USER),
    InvalidScheduleMissingTrainStopLocation(
            "invalid_schedule", "Train stop must specify exactly one of position or location", ErrorCause.USER),
    InvalidScheduleOutsideTrainStopPosition(
            "invalid_schedule", "Stop position is outside of the path", ErrorCause.USER),
    InvalidScheduleInvalidTrackSectionOffset("invalid_schedule", "invalid track section offset", ErrorCause.USER),
    InvalidSchedulePoint(
            "invalid_schedule", "invalid scheduled point: position greater that path length", ErrorCause.USER),
    InvalidTrackRangeInvalidTrackSectionOffset(
            "invalid_track_range", "Offset %s is not contained in the track ranges view", ErrorCause.USER),
    InvalidWaypointLocation(
            "invalid_waypoint_location", "Waypoint track offset is not included in [0; track length]", ErrorCause.USER),
    UnknownRollingStock("unknown_stock", "unknown rolling stock", ErrorCause.USER),
    UnknownTrackSection("unknown_track_section", "unknown track section", ErrorCause.USER),
    UnknownAspect("unknown_aspect", "unknown aspect: %s", ErrorCause.USER),
    UnknownAllowanceType("unknown_allowance_type", "unknown allowance type", ErrorCause.USER),
    UnknownAllowanceValueType("unknown_allowance_value_type", "unknown allowance value type", ErrorCause.USER),
    UnknownRoute("unknown_route", "unknown route", ErrorCause.USER),
    DuplicateRoute("duplicate_route", "Two routes have the same name", ErrorCause.USER),
    MissingAttributeError("missing_attribute", "referencing missing attribute", ErrorCause.INTERNAL),
    MissingSignalOnRouteTransition(
            "missing_signal_on_route_transition",
            "The path uses a route that ends on a detector without signal",
            ErrorCause.USER),
    EnvelopeStopIndexOutOfBounds("envelope_error", "Stop at index %d is out of bounds", ErrorCause.USER),
    EnvelopePartsNotContiguous(
            "envelope_error", "invalid envelope, envelope parts are not contiguous", ErrorCause.INTERNAL),
    SignalingError("signaling_error", "Unknown signaling system: $sigSystem", ErrorCause.USER),
    SigSchemaInvalidFieldError("sig_schema_field_error", "invalid sig schema field", ErrorCause.USER),
    SigSchemaUnknownFieldError("sig_schema_field_error", "unknown sig schema field", ErrorCause.USER),
    InvalidSTDCMUnspecifiedStartTime(
            "invalid_stdcm", "STDCM requests with unspecified start time are not supported yet", ErrorCause.INTERNAL),
    InvalidSTDCMInputs("invalid_stdcm_inputs", "Invalid inputs for stdcm request", ErrorCause.USER),
    DelimitingSignalEmptyBlock(
            "delimiting_signal_empty_block", "Delimiting signals must protect a non-empty block", ErrorCause.USER),
    BALUnprotectedZones("unprotected_zones", "BAL signals always protect zones", ErrorCause.USER),
    BAPRUnprotectedZones("unprotected_zones", "BAPR signals always protect zones", ErrorCause.USER),
    UnexpectedReservationStatus("unexpected_reservation_status", "unexpected reservation status", ErrorCause.USER),
    IncompatibleZoneRequirements("incompatible_zone_requirements", "incompatible zone requirements", ErrorCause.USER),
    ActionLockRequired("action_lock_required", "action lock required", ErrorCause.USER),
    BlockedSimulationException(
            "blocked_simulation_exception", "the discrete simulation blocked without completing", ErrorCause.USER),
    EPSetSoftLoadingError(
            "electrical_profile_set_loading:soft_error",
            "soft error while loading new electrical profile set",
            ErrorCause.INTERNAL),
    EPSetHardLoadingError(
            "electrical_profile_set_loading:hard_error",
            "hard error while loading new electrical profile set",
            ErrorCause.INTERNAL),
    EPSetLoadingCacheException(
            "electrical_profile_set_loading:cache_exception",
            "Electrical profile set already had a hard loading error",
            ErrorCause.INTERNAL),
    EPSetInvalidStatusAfterLoading(
            "electrical_profile_set_loading:invalid_cache_status",
            "Electrical profile set had invalid status after loading",
            ErrorCause.INTERNAL),
    PathWithRepeatedTracks(
            "path_with_repeated_tracks", "the path goes over the same track multiple times", ErrorCause.INTERNAL),
    PathHasInvalidItemPositions(
            "path_has_invalid_item_positions", "the path has invalid item positions", ErrorCause.INTERNAL),
    ScheduleMetadataExtractionFailed(
            "schedule_metadata_extraction_failed", "schedule metadata extraction failed", ErrorCause.INTERNAL),
    AllowanceRangeOutOfBounds("allowance_range", "Allowance ranges are out of bounds", ErrorCause.USER),
    AllowanceOutOfBounds("allowance", "Allowance is out of bounds", ErrorCause.USER),
    InvalidSpeedLimitValue("speed_limit_value", "Speed limit must be greater than 0", ErrorCause.USER),
    InconsistentSpeedSection(
            "speed_section",
            "Speed section definition is nonsensical and cannot be used for simulation",
            ErrorCause.USER),
    MissingLastSTDCMStop("missing_last_stdcm_stop", "Last step of stdcm request needs to be a stop", ErrorCause.USER),
    InvalidSTDCMStepWithTimingData(
            "invalid_stdcm_step_with_timing_data",
            "An STDCM step with planned timing data must be a stop",
            ErrorCause.USER),
    MissingRouteFromChunkPath(
            "missing_route_from_chunk_path",
            "couldn't find a route matching the given chunk list",
            ErrorCause.INTERNAL),
    ;

    public final String type;
    public final String message;
    public final ErrorCause cause;
    public final boolean isCacheable;

    ErrorType(String type, String message, ErrorCause cause) {
        this(type, message, cause, true);
    }

    ErrorType(String type, String message, ErrorCause cause, boolean isCacheable) {
        this.type = "core:" + type;
        this.message = message;
        this.cause = cause;
        this.isCacheable = isCacheable;
    }
}
