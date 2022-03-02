package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteLocation;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.path.BasicPathNode;
import fr.sncf.osrd.utils.graph.path.FullPathArray;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;



public class PathfindingResult {
    @Json(name = "route_paths")
    public final List<RoutePathResult> routePaths;
    @Json(name = "path_waypoints")
    public final List<PathWaypointResult> pathWaypoints;

    // make them private final
    public LineString geographic;
    public LineString schematic;

    private PathfindingResult(ArrayList<RoutePathResult> routePaths, ArrayList<PathWaypointResult> pathWaypoints, LineString geographic, LineString schematic) {
        this.routePaths = routePaths;
        this.pathWaypoints = pathWaypoints;
        this.geographic = geographic;
        this.schematic = schematic;
    }

    public static PathfindingResult PathfindingResultMake(ArrayDeque<FullPathArray<Route, BasicPathNode<Route>>> finalPathsToGoal, Infra infra) throws InvalidInfraException {

        // how about res ? global variable, reference, ...
        for (var path : finalPathsToGoal) {
            var routeBeginLoc = pathNodeToRouteLocation(path.pathNodes.get(0));
            var beginLoc = routeBeginLoc.getTrackSectionLocation();
            var routeEndLoc = pathNodeToRouteLocation(path.pathNodes.get(path.pathNodes.size() - 1));
            var endLoc = routeEndLoc.getTrackSectionLocation();

            var routes = new ArrayList<Route>();
            for (var node : path.pathNodes) {
                if (routes.isEmpty() || routes.get(routes.size() - 1) != node.edge)
                    routes.add(node.edge);
            }

            for (int j = 0; j < routes.size(); j++) {
                TrackSectionLocation begin = null;
                TrackSectionLocation end = null;
                if (j == 0)
                    begin = beginLoc;
                if (j == routes.size() - 1)
                    end = endLoc;
                var route = routes.get(j);
                var trackSections = Route.routesToTrackSectionRange(
                        Collections.singletonList(route), begin, end);
                if (j == 0) {
                    // Add the given origin location to the steps output
                    var firstTrack = trackSections.get(0);
                    var newStep = new PathfindingResult.PathWaypointResult(firstTrack.edge,
                            firstTrack.getBeginPosition());
                    // TODO
                    //res.addStep(newStep);
                }
                // TODO
                //res.add(route, trackSections);
                if (j == routes.size() - 1) {
                    // Add the given destination location to the steps output
                    var lastTrack = trackSections.get(trackSections.size() - 1);
                    var newStep = new PathfindingResult.PathWaypointResult(lastTrack.edge,
                            lastTrack.getEndPosition());
                    // TODO
                    //res.addStep(newStep);
                }
            }
        }

        ArrayList<RoutePathResult>routePath = null;
        var geometry = addGeometry(infra, routePath);
        return new PathfindingResult(null, null, geometry.get(0), geometry.get(1));
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private static RouteLocation pathNodeToRouteLocation(BasicPathNode<Route> node) {
        return new RouteLocation(node.edge, node.position);
    }

    void add(Route route, List<TrackSectionRange> trackSections) {
        var routeResult = new RoutePathResult();
        routeResult.route = new RJSObjectRef<>(route.id, "Route");
        routeResult.trackSections = new ArrayList<>();
        for (var trackSection : trackSections) {
            if (trackSection.direction == EdgeDirection.START_TO_STOP)
                assert trackSection.getBeginPosition() <= trackSection.getEndPosition();
            else
                assert trackSection.getBeginPosition() >= trackSection.getEndPosition();
            var trackSectionResult = new PathfindingEndpoint.DirectionalTrackRangeResult(trackSection.edge.id,
                    trackSection.getBeginPosition(),
                    trackSection.getEndPosition());
            routeResult.trackSections.add(trackSectionResult);
            var opIterator = trackSection.edge.operationalPoints.iterate(
                    trackSection.direction,
                    trackSection.getBeginPosition(),
                    trackSection.getEndPosition(),
                    null);
            while (opIterator.hasNext())
                addStep(new PathWaypointResult(opIterator.next(), trackSection.edge));
        }

        if (!routePaths.isEmpty() && routePaths.get(routePaths.size() - 1).route.id.equals(routeResult.route.id)) {
            routePaths.get(routePaths.size() - 1).addTrackSections(routeResult.trackSections);
        } else {
            routePaths.add(routeResult);
        }
    }

    void addStep(PathWaypointResult newStep) {
        if (pathWaypoints.isEmpty()) {
            pathWaypoints.add(newStep);
            return;
        }
        var lastStep = pathWaypoints.get(pathWaypoints.size() - 1);
        if (lastStep.isDuplicate(newStep)) {
            lastStep.merge(newStep);
            return;
        }
        pathWaypoints.add(newStep);
    }

    public static class RoutePathResult {
        public RJSObjectRef<RJSRoute> route;
        @Json(name = "track_sections")
        public List<PathfindingEndpoint.DirectionalTrackRangeResult> trackSections = new ArrayList<>();

        /** This function adds trackSectionRanges by concatenating them to the existing ones */
        public void addTrackSections(List<PathfindingEndpoint.DirectionalTrackRangeResult> newTracks) {
            if (trackSections.isEmpty()) {
                trackSections = newTracks;
                return;
            }

            var lastTrack = trackSections.get(trackSections.size() - 1);
            var firstNewTrack = newTracks.get(0);

            // If no intersection we simply add all new tracks
            if (!lastTrack.trackSection.id.equals(firstNewTrack.trackSection.id)) {
                trackSections.addAll(newTracks);
                return;
            }

            // If same track we must merge the last track with the first new one
            trackSections.remove(trackSections.size() - 1);
            trackSections.add(new PathfindingEndpoint.DirectionalTrackRangeResult(
                    lastTrack.trackSection.id.id,
                    lastTrack.begin,
                    firstNewTrack.end)
            );

            // Add the rest of them
            for (int i = 1; i < newTracks.size(); i++)
                trackSections.add(newTracks.get(i));
        }
    }

    public static class PathWaypointResult {
        public String id;
        public boolean suggestion;
        public RJSObjectRef<RJSTrackSection> track;
        public double position;

        /** Suggested operational points */
        PathWaypointResult(PointValue<OperationalPoint> op, TrackSection trackSection) {
            this.id = op.value.id;
            this.suggestion = true;
            this.track = new RJSObjectRef<>(trackSection.id, "TrackSection");
            this.position = op.position;
        }

        /** Given step */
        PathWaypointResult(TrackSection trackSection, double position) {
            this.suggestion = false;
            this.track = new RJSObjectRef<>(trackSection.id, "TrackSection");
            this.position = position;
        }

        /** Check if two step result are at the same location */
        public boolean isDuplicate(PathWaypointResult other) {
            if (!track.equals(other.track))
                return false;
            return Math.abs(position - other.position) < 0.001;
        }

        /** Merge a suggested with a give step */
        public void merge(PathWaypointResult other) {
            suggestion &= other.suggestion;
            if (!other.suggestion)
                return;
            position = other.position;
            id = other.id;
        }
    }

    public static ArrayList<LineString> addGeometry(Infra infra, ArrayList<RoutePathResult> routePaths)
            throws InvalidInfraException {
        var geo_list = new ArrayList<LineString>();
        var sch_list = new ArrayList<LineString>();

        PathfindingEndpoint.DirectionalTrackRangeResult previousTrack = null;
        double previousBegin = 0;
        double previousEnd = 0;

        for (var routePath : routePaths) {
            for (var trackSection : routePath.trackSections) {

                if (previousTrack == null) {
                    previousTrack = trackSection;
                    previousBegin = trackSection.begin;
                    previousEnd = trackSection.end;
                    continue;
                }

                if (previousTrack.trackSection.id.id.compareTo(trackSection.trackSection.id.id) != 0) {
                    if (Double.compare(previousBegin, previousEnd) != 0) {
                        var track = previousTrack.trackSection.getTrack(infra.trackGraph.trackSectionMap);
                        geo_list.add(track.geo.slice(previousBegin / track.length, previousEnd / track.length));
                        sch_list.add(track.sch.slice(previousBegin / track.length, previousEnd / track.length));
                    }
                    previousTrack = trackSection;
                    previousBegin = trackSection.begin;
                    previousEnd = trackSection.end;
                } else
                    previousEnd += trackSection.end;

            }
        }
        var res = new ArrayList<LineString>();
        res.add(LineString.concatenate(geo_list));
        res.add(LineString.concatenate(sch_list));
        return res;
    }
}

