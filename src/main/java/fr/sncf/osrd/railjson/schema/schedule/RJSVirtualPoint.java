package fr.sncf.osrd.railjson.schema.schedule;

import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;

public class RJSVirtualPoint {
    public final String name;
    public final RJSTrackLocation location;

    public RJSVirtualPoint(String name, RJSTrackLocation location) {
        this.name = name;
        this.location = location;
    }
}
