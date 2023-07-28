package fr.sncf.osrd.railjson.parser;

import static fr.sncf.osrd.sim_infra.api.PathPropertiesKt.makeTrackLocation;
import static fr.sncf.osrd.sim_infra.api.TrackInfraKt.getTrackSectionFromNameOrThrow;

import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.sim_infra.api.TrackInfra;
import fr.sncf.osrd.sim_infra.api.TrackLocation;
import fr.sncf.osrd.utils.units.Distance;

public class RJSTrackLocationParser {
    /** Parse RJS track location */
    public static TrackLocation parse(TrackInfra infra, RJSTrackLocation location)
            throws OSRDError {
        var trackSectionID = location.trackSection.id;
        var trackSection = getTrackSectionFromNameOrThrow(trackSectionID, infra);
        var offset = Distance.fromMeters(location.offset);
        if (offset < 0 || offset > infra.getTrackSectionLength(trackSection))
            throw new OSRDError(ErrorType.InvalidScheduleInvalidTrackSectionOffset);
        return makeTrackLocation(trackSection, offset);
    }
}
