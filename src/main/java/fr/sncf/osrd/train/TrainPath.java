package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;
import java.util.List;

/** Describes the planned path for a train
 * For now it is considered read-only, but eventually it may be possible to modify the path */
public class TrainPath {

    /** Full train path as a list of routes */
    public final List<Route> routePath;

    /** Full train path as a list of trackSectionRange */
    public final ArrayList<TrackSectionRange> trackSectionPath;

    /** Full train path as a list of TVD sections */
    public final ArrayList<TVDSectionPath> tvdSectionPaths;

    /** Directions of each tvd section on the route */
    public final ArrayList<EdgeDirection> tvdSectionDirections;

    /** Path length in meters */
    public final double length;

    /** Constructor */
    public TrainPath(List<Route> routePath,
                     TrackSectionLocation startLocation,
                     TrackSectionLocation endLocation) throws InvalidSchedule {
        this.routePath = routePath;
        tvdSectionPaths = new ArrayList<>();
        tvdSectionDirections = new ArrayList<>();
        initTVD(routePath);
        try {
            trackSectionPath = Route.routesToTrackSectionRange(routePath, startLocation, endLocation);
        } catch (RuntimeException e) {
            throw new InvalidSchedule(e.getMessage());
        }
        length = convertTrackLocation(endLocation);
        validate();
    }

    /** Copy constructor */
    public TrainPath(TrainPath other) {
        this.routePath = new ArrayList<>(other.routePath);
        this.tvdSectionPaths = new ArrayList<>(other.tvdSectionPaths);
        this.tvdSectionDirections = new ArrayList<>(other.tvdSectionDirections);
        this.trackSectionPath = new ArrayList<>(other.trackSectionPath);
        this.length = other.length;
    }

    /** Initializes the lists of tvd sections and directions */
    private void initTVD(List<Route> routePath) {
        for (var route : routePath) {
            for (int i = 0; i < route.tvdSectionsPaths.size(); i++) {
                tvdSectionPaths.add(route.tvdSectionsPaths.get(i));
                tvdSectionDirections.add(route.tvdSectionsPathDirections.get(i));
            }
        }
    }

    private void validate() throws InvalidSchedule {
        for (int i = 1; i < routePath.size(); i++) {
            if (routePath.get(i).id.equals(routePath.get(i - 1).id))
                throw new InvalidSchedule("Train path contains duplicate routes");
        }
        for (int i = 1; i < trackSectionPath.size(); i++) {
            var previous = trackSectionPath.get(i - 1);
            var next = trackSectionPath.get(i);
            
            if (previous.getEndLocation().equals(next.getBeginLocation()))
                continue;
            
            var endNeighbors =
                    (previous.direction == EdgeDirection.START_TO_STOP) ?
                            previous.edge.endNeighbors : previous.edge.startNeighbors;
            var startNeighbors =
                    (next.direction == EdgeDirection.START_TO_STOP) ?
                            next.edge.startNeighbors : next.edge.endNeighbors;
            if (endNeighbors.contains(next.edge) && startNeighbors.contains(previous.edge))
                continue;
            
            String err = "Invalid path: the beginning of a track section isn't the start of the next "
                    + "(previous=%s, next=%s)";

            throw new InvalidSchedule(String.format(err, previous, next));
        }
    }

    /** Finds the tvd section after the given waypoint */
    public TVDSection findForwardTVDSection(Waypoint waypoint) {
        // TODO: Find a faster and smarter way to do it
        for (var j = 0; j < tvdSectionPaths.size(); j++) {
            var tvdSectionPath = tvdSectionPaths.get(j);
            var tvdSectionPathDirection = tvdSectionDirections.get(j);
            if (tvdSectionPath.getStartNode(tvdSectionPathDirection) == waypoint.index)
                return tvdSectionPath.tvdSection;
        }
        // No tvd section could be found forward this waypoint
        return null;
    }

    /** Finds the tvd section before the given waypoint */
    public TVDSection findBackwardTVDSection(Waypoint waypoint) {
        // TODO: Find a faster and smarter way to do it
        for (var j = 0; j < tvdSectionPaths.size(); j++) {
            var tvdSectionPath = tvdSectionPaths.get(j);
            var tvdSectionPathDirection = tvdSectionDirections.get(j);
            if (tvdSectionPath.getEndNode(tvdSectionPathDirection) == waypoint.index)
                return tvdSectionPath.tvdSection;
        }

        // There is no previous tvd section on this train path
        return null;
    }

    /** Converts a TrackSectionLocation into a position on the track (double) */
    public double convertTrackLocation(TrackSectionLocation location) {
        double sumPreviousSections = 0;
        for (var edge : trackSectionPath) {
            if (edge.containsLocation(location)) {
                if (edge.direction == EdgeDirection.START_TO_STOP) {
                    return sumPreviousSections + location.offset - edge.getBeginPosition();
                } else {
                    return sumPreviousSections + edge.getBeginPosition() - location.offset;
                }
            }
            sumPreviousSections += Math.abs(edge.getBeginPosition() - edge.getEndPosition());
        }
        throw new RuntimeException("Can't find location in path");
    }

    public TrackSectionLocation getStartLocation() {
        return trackSectionPath.get(0).getBeginLocation();
    }

    public TrackSectionLocation getEndLocation() {
        return trackSectionPath.get(trackSectionPath.size() - 1).getEndLocation();
    }

    /** Find location on track given a distance from the start.
     * If the path position is higher than the fullPath length the function return null. */
    public TrackSectionLocation findLocation(double pathPosition) {
        for (var track : trackSectionPath) {
            if (pathPosition > track.length()) {
                pathPosition -= track.length();
                continue;
            }

            var location = track.getBeginPosition();
            if (track.direction == EdgeDirection.START_TO_STOP)
                location += pathPosition;
            else
                location -= pathPosition;
            return new TrackSectionLocation(track.edge, location);
        }

        // We might reach this point with an epsilon left when looking for the end because of float inaccuracies
        if (pathPosition < 1e-3)
            return getEndLocation();

        return null;
    }
}
