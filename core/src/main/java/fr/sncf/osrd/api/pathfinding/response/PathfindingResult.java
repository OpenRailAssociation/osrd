package fr.sncf.osrd.api.pathfinding.response;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;

import com.google.common.collect.HashMultimap;
import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.infra.implementation.RJSObjectParsing;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.reporting.warnings.Warning;
import fr.sncf.osrd.reporting.warnings.WarningRecorderImpl;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.geom.Point;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.*;

public class PathfindingResult {
    public static final JsonAdapter<PathfindingResult> adapterResult = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(new LineString.Adapter())
            .add(new Point.Adapter())
            .build()
            .adapter(PathfindingResult.class)
            .failOnUnknown();
    @Json(name = "route_paths")
    public final List<RoutePathResult> routePaths = new ArrayList<>();
    @Json(name = "path_waypoints")
    public final List<PathWaypointResult> pathWaypoints = new ArrayList<>();

    public LineString geographic = null;
    public LineString schematic = null;

    public List<Warning> warnings = null;
}

