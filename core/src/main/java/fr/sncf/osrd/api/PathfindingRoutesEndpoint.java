package fr.sncf.osrd.api;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.new_infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.geom.Point;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.new_graph.Pathfinding;
import org.takes.Request;
import org.takes.Response;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.util.*;

public class PathfindingRoutesEndpoint extends PathfindingEndpoint {
    public static final JsonAdapter<PathfindingResult> adapterResult = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(new LineString.Adapter())
            .add(new Point.Adapter())
            .build()
            .adapter(PathfindingResult.class)
            .failOnUnknown();


    public PathfindingRoutesEndpoint(NewInfraManager infraHandler) {
        super(infraHandler);
    }

    @Override
    public Response act(Request req) {
        try {
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            var reqWaypoints = request.waypoints;

            // load infra
            var infra = infraManager.load(request.infra, request.expectedVersion);

            // parse the waypoints
            var waypoints = new ArrayList<Set<Pathfinding.EdgeLocation<SignalingRoute>>>();
            for (var step : reqWaypoints) {
                var allStarts = new HashSet<Pathfinding.EdgeLocation<SignalingRoute>>();
                for (var waypoint : step)
                    allStarts.addAll(findRoutes(infra, waypoint));
                waypoints.add(allStarts);
            }

            // Compute the paths from the entry waypoint to the exit waypoint
            var pathToGoal = new ArrayList<Pathfinding.EdgeRange<SignalingRoute>>();
            for (int i = 1; i < waypoints.size(); i++) {
                var destinationWaypoints = waypoints.get(i);

                // TODO: find a way to actually handle several intermediate steps
                Set<Pathfinding.EdgeLocation<SignalingRoute>> startWaypoints = new HashSet<>(waypoints.get(i - 1));

                var path = Pathfinding.findPath(
                        infra.getSignalingRouteGraph(),
                        startWaypoints,
                        destinationWaypoints,
                        route -> route.getInfraRoute().getLength()
                );

                if (path == null) {
                    var error = String.format(
                            "No path could be found between steps %d and %d",
                            i - 1, i
                    );
                    return new RsWithStatus(new RsText(error), 400);
                }

                pathToGoal.addAll(path);
            }

            var res = PathfindingResult.make(pathToGoal, infra);

            return new RsJson(new RsWithBody(adapterResult.toJson(res)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    /** Returns all the EdgeLocations matching the given waypoint */
    private static Set<Pathfinding.EdgeLocation<SignalingRoute>> findRoutes(
            SignalingInfra infra,
            PathfindingWaypoint waypoint
    ) {
        var res = new HashSet<Pathfinding.EdgeLocation<SignalingRoute>>();
        var edge = infra.getEdge(waypoint.trackSection, Direction.fromEdgeDir(waypoint.direction));
        if (edge == null)
            throw new InvalidSchedule(
                    String.format("Track %s referenced in path step does not exist", waypoint.trackSection)
            );
        for (var entry : infra.getRoutesOnEdges().get(edge)) {
            var signalingRoutes = infra.getRouteMap().get(entry.route());
            for (var signalingRoute : signalingRoutes) {
                var waypointOffsetFromStart = waypoint.offset;
                if (waypoint.direction.equals(EdgeDirection.STOP_TO_START))
                    waypointOffsetFromStart = edge.getEdge().getLength() - waypoint.offset;
                var offset = waypointOffsetFromStart - entry.startOffset();
                if (offset >= 0 && offset <= signalingRoute.getInfraRoute().getLength())
                    res.add(new Pathfinding.EdgeLocation<>(signalingRoute, offset));
            }
        }
        return res;
    }
}
