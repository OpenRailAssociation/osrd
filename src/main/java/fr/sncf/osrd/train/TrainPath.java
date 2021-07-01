package fr.sncf.osrd.train;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;
import java.util.List;

/** Describes the planned path for a train
 * For now it is considered read-only, but eventually it may be possible to modify the path */
public class TrainPath {

    /** Full train path as a list of routes */
    public final List<Route> routePath;

    /** Index of the route the train is currently on in routePath */
    public int routeIndex = 0;

    /** Full train path as a list of trackSectionRange */
    public final ArrayList<TrackSectionRange> trackSectionPath;

    /** Full train path as a list of TVD sections */
    public final ArrayList<TVDSectionPath> tvdSectionPaths;

    /** Directions of each tvd section on the route */
    public final ArrayList<EdgeDirection> tvdSectionDirections;

    /** Constructor */
    public TrainPath(List<Route> routePath,
                     TrackSectionLocation startLocation,
                     TrackSectionLocation endLocation) {
        this.routePath = routePath;
        tvdSectionPaths = new ArrayList<>();
        tvdSectionDirections = new ArrayList<>();
        initTVD(routePath);
        trackSectionPath = Route.routesToTrackSectionRange(routePath, startLocation, endLocation);
    }

    /** Copy constructor */
    public TrainPath(TrainPath other) {
        this.routePath = new ArrayList<>(other.routePath);
        this.tvdSectionPaths = new ArrayList<>(other.tvdSectionPaths);
        this.tvdSectionDirections = new ArrayList<>(other.tvdSectionDirections);
        this.trackSectionPath = new ArrayList<>(other.trackSectionPath);
        this.routeIndex = other.routeIndex;
    }

    /** Initializes a train path given a schedule */
    public TrainPath(TrainSchedule schedule) {
        routePath = new ArrayList<>();
        for (var phase : schedule.phases)
            // TODO ech: change this by the end of the phase rework
            if (phase instanceof SignalNavigatePhase)
                routePath.addAll(((SignalNavigatePhase) phase).routePath);
        for (int i = 1; i < routePath.size(); i++) {
            if (routePath.get(i).id.equals(routePath.get(i - 1).id)) {
                routePath.remove(i);
                i--;
            }
        }
        var endLocation = schedule.phases.get(schedule.phases.size() - 1).getEndLocation();
        tvdSectionPaths = new ArrayList<>();
        tvdSectionDirections = new ArrayList<>();
        initTVD(routePath);
        trackSectionPath = Route.routesToTrackSectionRange(routePath, schedule.initialLocation, endLocation);
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
    private TVDSection findBackwardTVDSection(Waypoint waypoint) {
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

    /** Occupy and free tvd sections given a detector the train is interacting with. */
    public void updateTVDSections(
            Simulation sim,
            Detector detector,
            InteractionType interactionType
    ) throws SimulationError {
        // Update route index
        var currentRoute = routePath.get(routeIndex);
        var tvdSectionPathIndex = currentRoute.tvdSectionsPaths.size() - 1;
        var lastTvdSectionPath = currentRoute.tvdSectionsPaths.get(tvdSectionPathIndex);
        var lastTvdSectionPathDir = currentRoute.tvdSectionsPathDirections.get(tvdSectionPathIndex);
        if (lastTvdSectionPath.getEndNode(lastTvdSectionPathDir) == detector.index)
            routeIndex++;

        // Occupy the next tvdSection
        if (interactionType == InteractionType.HEAD) {
            var forwardTVDSectionPath = findForwardTVDSection(detector);
            if (forwardTVDSectionPath == null)
                return;
            var nextTVDSection = sim.infraState.getTvdSectionState(forwardTVDSectionPath.index);
            nextTVDSection.occupy(sim);
            return;
        }
        // Doesn't occupy the last tvdSection
        var backwardTVDSectionPath = findBackwardTVDSection(detector);
        if (backwardTVDSectionPath == null)
            return;
        var backwardTVDSection = sim.infraState.getTvdSectionState(backwardTVDSectionPath.index);
        backwardTVDSection.unoccupy(sim);
    }
}
