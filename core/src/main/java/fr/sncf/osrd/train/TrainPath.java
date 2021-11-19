package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.infra.TVDSectionPath;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/** Describes the planned path for a train
 * For now it is considered read-only, but eventually it may be possible to modify the path */
public class TrainPath {

    /** Full train path as a list of routes */
    public final List<Route> routePath;

    /** Full train path as a list of trackSectionRange */
    public final ArrayList<TrackSectionRange> trackSectionPath;

    /** Full train path as a list of TVD sections */
    public final ArrayList<TVDSectionPath> tvdSectionPaths;

    /** Path length in meters */
    public final double length;

    /** Constructor */
    public TrainPath(List<Route> routePath,
                     TrackSectionLocation startLocation,
                     TrackSectionLocation endLocation) throws InvalidSchedule {
        this.routePath = routePath;
        tvdSectionPaths = new ArrayList<>();
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
        this.trackSectionPath = new ArrayList<>(other.trackSectionPath);
        this.length = other.length;
    }

    /** Initializes the lists of tvd sections and directions */
    private void initTVD(List<Route> routePath) {
        for (var route : routePath)
            for (int i = 0; i < route.tvdSectionsPaths.size(); i++)
                tvdSectionPaths.add(route.tvdSectionsPaths.get(i));
    }

    private void validate() throws InvalidSchedule {
        for (int i = 1; i < routePath.size(); i++)
            if (routePath.get(i).id.equals(routePath.get(i - 1).id))
                throw new InvalidSchedule("Train path contains duplicate routes");

        for (int i = 1; i < trackSectionPath.size(); i++) {
            var previous = trackSectionPath.get(i - 1);
            var next = trackSectionPath.get(i);

            if (previous.getEndLocation().equals(next.getBeginLocation()))
                continue;
            var endNeighbors = (previous.direction == EdgeDirection.START_TO_STOP)
                    ? previous.edge.endNeighbors : previous.edge.startNeighbors;
            var startNeighbors = (next.direction == EdgeDirection.START_TO_STOP)
                    ? next.edge.startNeighbors : next.edge.endNeighbors;
            if (endNeighbors.contains(next.edge) && startNeighbors.contains(previous.edge))
                continue;

            String err = "Invalid path: the beginning of a track section isn't the start of the next "
                    + "(previous=%s, next=%s)";

            throw new InvalidSchedule(String.format(err, previous, next));
        }

        for (int i = 1; i < routePath.size(); i++) {
            var prevRoute = routePath.get(i - 1);
            var nextRoute = routePath.get(i);
            var prevRouteTVDs = prevRoute.tvdSectionsPaths.stream()
                    .map(path -> path.tvdSection.id)
                    .collect(Collectors.toSet());
            var nextRouteTVDs = nextRoute.tvdSectionsPaths.stream()
                    .map(path -> path.tvdSection.id)
                    .collect(Collectors.toSet());
            prevRouteTVDs.retainAll(nextRouteTVDs);
            for (var conflict : prevRouteTVDs) {
                throw new InvalidSchedule(String.format(
                        "Trains goes over the same TVD section twice in consecutive routes, "
                                + "this is not supported yet (routes: %s and %s, tvd: %s)",
                        prevRoute.id, nextRoute.id, conflict
                ));
            }
        }
    }

    /** Finds the tvd section after the given waypoint */
    public TVDSection findForwardTVDSection(Waypoint waypoint) {
        // TODO: Find a faster and smarter way to do it
        for (var j = 0; j < tvdSectionPaths.size(); j++) {
            var tvdSectionPath = tvdSectionPaths.get(j);
            if (tvdSectionPath.startWaypoint == waypoint)
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
            if (tvdSectionPath.endWaypoint == waypoint)
                return tvdSectionPath.tvdSection;
        }

        // There is no previous tvd section on this train path
        return null;
    }

    /** Converts a TrackSectionLocation into a position on a given track range path */
    public static double convertTrackLocation(TrackSectionLocation location, List<TrackSectionRange> trackSectionPath) {
        double sumPreviousSections = 0;
        for (var edge : trackSectionPath) {
            if (edge.edge.id.equals(location.edge.id))
                return sumPreviousSections + Math.abs(location.offset - edge.getBeginPosition());
            sumPreviousSections += Math.abs(edge.getEndPosition() - edge.getBeginPosition());
        }
        throw new RuntimeException("Can't find location in path");
    }

    /** Converts a TrackSectionLocation into a position on the track (double) */
    public double convertTrackLocation(TrackSectionLocation location) {
        return convertTrackLocation(location, trackSectionPath);
    }

    /** Return whether a location is part of the path */
    public boolean containsTrackLocation(TrackSectionLocation location) {
        for (var edge : trackSectionPath) {
            if (edge.containsLocation(location))
                return true;
        }
        return false;
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
        return findLocation(pathPosition, trackSectionPath);
    }

    /** Find location on track given a distance from the start.
     * If the path position is higher than the fullPath length the function return null. */
    public static TrackSectionLocation findLocation(double pathPosition, List<TrackSectionRange> trackSectionPath) {
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
            return trackSectionPath.get(trackSectionPath.size() - 1).getEndLocation();

        return null;
    }
}
