package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class RJSRoute implements Identified {
    public String id;

    @Json(name = "entry_point")
    public RJSWaypointRef<RJSTrainDetector> entryPoint;

    @Json(name = "entry_point_direction")
    public EdgeDirection entryPointDirection;

    @Json(name = "exit_point")
    public RJSWaypointRef<RJSTrainDetector> exitPoint;

    @Json(name = "release_detectors")
    public List<String> releaseDetectors;

    @Json(name = "switches_directions")
    public Map<String, String> switchesDirections;


    /** Routes are described as a list of TVD Sections, Switches in specific positions, and an entry point */
    public RJSRoute(
            String id,
            RJSWaypointRef<RJSTrainDetector> entryPoint,
            EdgeDirection entryPointDirection,
            RJSWaypointRef<RJSTrainDetector> exitPoint
    ) {
        this.id = id;
        this.entryPoint = entryPoint;
        this.exitPoint = exitPoint;
        this.entryPointDirection = entryPointDirection;
        this.releaseDetectors = new ArrayList<>();
        this.switchesDirections = new HashMap<>();
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
