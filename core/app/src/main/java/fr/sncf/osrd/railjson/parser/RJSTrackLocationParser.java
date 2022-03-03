package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.UnknownTrackSection;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.utils.TrackSectionLocation;

public class RJSTrackLocationParser {
    /** Parse RJS track location */
    public static TrackSectionLocation parse(Infra infra, RJSTrackLocation location) throws InvalidSchedule {
        var trackSectionID = location.trackSection.id;
        var trackSection = infra.trackGraph.trackSectionMap.get(trackSectionID);
        if (trackSection == null)
            throw new UnknownTrackSection("unknown section", trackSectionID);
        var offset = location.offset;
        if (offset < 0 || offset > trackSection.length)
            throw new InvalidSchedule("invalid track section offset");
        return new TrackSectionLocation(trackSection, offset);
    }
}
