package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.UnknownTrackSection;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;

public class RJSTrackLocationParser {
    /** Parse RJS track location */
    public static TrackLocation parse(TrackInfra infra, RJSTrackLocation location)
            throws InvalidSchedule {
        var trackSectionID = location.trackSection.id;
        var trackSection = infra.getTrackSection(trackSectionID);
        if (trackSection == null)
            throw new UnknownTrackSection("unknown section", trackSectionID);
        var offset = location.offset;
        if (offset < 0 || offset > trackSection.getLength())
            throw new InvalidSchedule("invalid track section offset");
        return new TrackLocation(trackSection, offset);
    }
}
