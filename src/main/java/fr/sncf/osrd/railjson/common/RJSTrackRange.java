package fr.sncf.osrd.railjson.common;

import fr.sncf.osrd.railjson.infra.RJSTrackSection;

public final class RJSTrackRange {
    public final ID<RJSTrackSection> trackSection;
    public final double begin;
    public final double end;

    /**
     * Creates an oriented range on a track section.
     * If begin > end, this range goes backwards on the track section
     */
    public RJSTrackRange(ID<RJSTrackSection> trackSection, double begin, double end) {
        this.trackSection = trackSection;
        this.begin = begin;
        this.end = end;
    }
}
