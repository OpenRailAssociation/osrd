package fr.sncf.osrd.api;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.geom.Point;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.takes.Request;
import org.takes.Response;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

public class PathfindingRoutesEndpoint extends PathfindingEndpoint {
    public static final JsonAdapter<PathfindingResult> adapterResult = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(new LineString.Adapter())
            .add(new Point.Adapter())
            .build()
            .adapter(PathfindingResult.class)
            .failOnUnknown();


    public PathfindingRoutesEndpoint(InfraManager infraHandler) {
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
            var waypoints = new ArrayList<Collection<Pathfinding.EdgeLocation<SignalingRoute>>>();
            for (var step : reqWaypoints) {
                var allStarts = new HashSet<Pathfinding.EdgeLocation<SignalingRoute>>();
                for (var waypoint : step)
                    allStarts.addAll(findRoutes(infra, waypoint));
                waypoints.add(allStarts);
            }

            // Compute the paths from the entry waypoint to the exit waypoint
            var path = Pathfinding.findPath(
                    infra.getSignalingRouteGraph(),
                    waypoints,
                    route -> route.getInfraRoute().getLength()
            );

            if (path == null)
                return new RsWithStatus(new RsText("No path could be found"), 400);

            var res = PathfindingResult.make(path, infra);

            validate(infra, res);

            return new RsJson(new RsWithBody(adapterResult.toJson(res)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    /** Checks that the results make sense */
    private void validate(SignalingInfra infra, PathfindingResult res) {
        var start = res.pathWaypoints.get(0);
        var end = res.pathWaypoints.get(res.pathWaypoints.size() - 1);
        var startLocation = new TrackLocation(infra.getTrackSection(start.track.id.id), start.position);
        var endLocation = new TrackLocation(infra.getTrackSection(end.track.id.id), end.position);
        var routes = new ArrayList<SignalingRoute>();
        for (var route : res.routePaths) {
            var infraRoute = infra.getReservationRouteMap().get(route.route.id.id);
            assert infraRoute != null;
            var signalingRoute = infra.getRouteMap().get(infraRoute).asList().get(0);
            if (routes.isEmpty() || routes.get(routes.size() - 1) != signalingRoute)
                routes.add(signalingRoute);
        }
        var path = TrainPathBuilder.from(routes, startLocation, endLocation);
        for (int i = 1; i < path.trackRangePath().size(); i++) {
            var prev = path.trackRangePath().get(i - 1).element().track.getEdge();
            var next = path.trackRangePath().get(i).element().track.getEdge();
            assert prev == next || infra.getTrackGraph().adjacentEdges(prev).contains(next) : "path isn't continuous";
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
