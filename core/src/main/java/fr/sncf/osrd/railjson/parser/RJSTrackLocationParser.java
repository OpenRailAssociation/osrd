package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;

public class RJSTrackLocationParser {
    /** Parse RJS track location */
    public static TrackLocation parse(TrackInfra infra, RJSTrackLocation location)
            throws OSRDError {
        var trackSectionID = location.trackSection.id;
        var trackSection = infra.getTrackSection(trackSectionID);
        if (trackSection == null)
            throw OSRDError.newUnknownTrackSectionError(trackSectionID);
        var offset = location.offset;
        if (offset < 0 || offset > trackSection.getLength())
            throw new OSRDError(ErrorType.InvalidScheduleInvalidTrackSectionOffset);
        return new TrackLocation(trackSection, offset);
    }
}
