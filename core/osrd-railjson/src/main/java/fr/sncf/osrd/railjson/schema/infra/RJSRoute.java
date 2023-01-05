package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import java.util.List;

public class RJSRoute implements Identified {
    public String id;

    /** List of the track ranges on the route */
    public List<RJSDirectionalTrackRange> path;

    @Json(name = "release_detectors")
    public List<String> releaseDetectors;

    @Json(name = "entry_point")
    public RJSWaypointRef<RJSTrainDetector> entryPoint;

    @Json(name = "exit_point")
    public RJSWaypointRef<RJSTrainDetector> exitPoint;

    /** Routes are described as a list of TVD Sections, Switches in specific positions, and an entry point */
    public RJSRoute(
            String id,
            List<RJSDirectionalTrackRange> path,
            List<String> releaseDetectors
    ) {
        this.id = id;
        this.path = path;
        this.releaseDetectors = releaseDetectors;
    }

    @Override
    public String getID() {
        return id;
    }

    public enum State {
        FREE,
        REQUESTED,
        RESERVED,
        OCCUPIED,
        CONFLICT
    }
}
