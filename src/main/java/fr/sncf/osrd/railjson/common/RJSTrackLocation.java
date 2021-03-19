package fr.sncf.osrd.railjson.common;

import fr.sncf.osrd.railjson.infra.RJSTrackSection;

public final class RJSTrackLocation {
    public final ID<RJSTrackSection> trackSection;
    public final double offset;

    /** A location on a track section */
    public RJSTrackLocation(ID<RJSTrackSection> trackSection, double offset) {
        this.trackSection = trackSection;
        this.offset = offset;
    }
}
