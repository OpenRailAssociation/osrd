package fr.sncf.osrd.infra.routegraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.Signal;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.TVDSectionPath;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.DirNEdge;
import java.util.*;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class Route extends DirNEdge {
    public final String id;
    /** List of tvdSectionPath forming the route */
    public final List<TVDSectionPath> tvdSectionsPaths;

    public final List<SortedArraySet<TVDSection>> releaseGroups;

    /** Map between each switch on the route and its required position for this route */
    public final HashMap<Switch, String> switchesGroup;

    /** Signal placed before the route and reflecting its state*/
    public final Signal entrySignal;

    /** Set of signals to be updated on route change */
    public ArrayList<Signal> signalSubscribers;

    Route(
            String id,
            RouteGraph graph,
            double length,
            List<SortedArraySet<TVDSection>> releaseGroups,
            List<TVDSectionPath> tvdSectionsPaths,
            HashMap<Switch, String> switchesGroup,
            Signal entrySignal
    ) {
        super(
                graph.nextEdgeIndex(),
                tvdSectionsPaths.get(0).startWaypoint.index,
                tvdSectionsPaths.get(tvdSectionsPaths.size() - 1).endWaypoint.index,
                length
        );
        this.id = id;
        this.releaseGroups = releaseGroups;
        this.switchesGroup = switchesGroup;
        graph.registerEdge(this);
        this.tvdSectionsPaths = tvdSectionsPaths;
        this.signalSubscribers = new ArrayList<>();
        this.entrySignal = entrySignal;
    }

    public boolean isControlled() {
        return switchesGroup != null && !switchesGroup.isEmpty();
    }

    private ArrayList<TrackSectionRange> getTrackSectionRanges() {
        var res = new ArrayList<TrackSectionRange>();
        for (TVDSectionPath sectionPath : tvdSectionsPaths)
            Collections.addAll(res, sectionPath.trackSections);
        return res;
    }

    /** Return a HashSet with all routes which share a TVDSection */
    public HashSet<Route> getConflictedRoutes() {
        var conflictedRoutes = new HashSet<Route>();
        for (var tvdSectionPath : tvdSectionsPaths)
            conflictedRoutes.addAll(tvdSectionPath.tvdSection.routeSubscribers);

        return conflictedRoutes;
    }

    /** Build track section path. Need to concatenate all track section of all TvdSectionPath.
     * Avoid to have in the path TrackSectionPositions that reference the same TrackSection. */
    public static ArrayList<TrackSectionRange> routesToTrackSectionRange(
            List<Route> routePath,
            TrackSectionLocation beginLocation,
            TrackSectionLocation endLocation
    ) {
        // Flatten the list of track section range
        var flatTrackSections = new ArrayDeque<TrackSectionRange>();
        for (var route : routePath)
            flatTrackSections.addAll(route.getTrackSectionRanges());

        // Drop first track sections until the begin location
        if (beginLocation != null) {
            while (true) {
                if (flatTrackSections.isEmpty())
                    throw new RuntimeException("Begin position not contained in the route path");
                var firstTrack = flatTrackSections.removeFirst();
                if (firstTrack.containsLocation(beginLocation)) {
                    var newTrackSection = new TrackSectionRange(firstTrack.edge, firstTrack.direction,
                            beginLocation.offset, firstTrack.getEndPosition());
                    flatTrackSections.addFirst(newTrackSection);
                    break;
                }
            }
        }

        // Drop lasts track sections until the end location
        if (endLocation != null) {
            while (true) {
                if (flatTrackSections.isEmpty())
                    throw new RuntimeException("End position not contained in the route path");
                var lastTrack = flatTrackSections.removeLast();
                if (lastTrack.containsLocation(endLocation)) {
                    var newTrackSection = new TrackSectionRange(lastTrack.edge, lastTrack.direction,
                            lastTrack.getBeginPosition(), endLocation.offset);
                    flatTrackSections.addLast(newTrackSection);
                    break;
                }
            }
        }

        // Merge duplicated edges
        var trackSectionPath = new ArrayList<TrackSectionRange>();
        TrackSectionRange lastTrack = flatTrackSections.removeFirst();
        while (!flatTrackSections.isEmpty()) {
            var currentTrack = flatTrackSections.removeFirst();
            if (lastTrack.edge != currentTrack.edge) {
                trackSectionPath.add(lastTrack);
                lastTrack = currentTrack;
                continue;
            }
            lastTrack = TrackSectionRange.merge(lastTrack, currentTrack);
        }
        trackSectionPath.add(lastTrack);
        return trackSectionPath;
    }

    @Override
    public String toString() {
        return String.format("Route {id=%s}", id);
    }
}
