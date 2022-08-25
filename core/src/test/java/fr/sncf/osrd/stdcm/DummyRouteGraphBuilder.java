package fr.sncf.osrd.stdcm;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.collect.ImmutableSet;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.infra.api.signaling.SignalState;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackNode;
import fr.sncf.osrd.infra.api.tracks.undirected.*;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3Signal;
import fr.sncf.osrd.infra.implementation.tracks.directed.DiTrackEdgeImpl;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra.implementation.tracks.undirected.DetectorImpl;
import fr.sncf.osrd.infra.implementation.tracks.undirected.TrackSectionImpl;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import java.util.HashMap;
import java.util.Map;

/** Builder class to create dummy infra with minimal effort.
 * The generated infras are missing most of the implementation, but they can be used for STDCM computations */
public class DummyRouteGraphBuilder {
    private final ImmutableMap.Builder<String, DummyRoute> builder = new ImmutableMap.Builder<>();
    private final Map<String, Signal<? extends SignalState>> signals = new HashMap<>();
    private final Map<String, DiDetector> detectors = new HashMap<>();

    /** Builds the infra */
    public SignalingInfra build() {
        return new DummySignalingInfra(builder.build());
    }

    /** Creates a route going from nodes `entry` to `exit` of length 100, named $entry->$exit */
    public SignalingRoute addRoute(String entry, String exit) {
        return addRoute(entry, exit, 100);
    }

    /** Creates a route going from nodes `entry` to `exit` of length `length`, named $entry->$exit */
    public SignalingRoute addRoute(String entry, String exit, double length) {
        if (!signals.containsKey(entry))
            signals.put(entry, new BAL3Signal(entry, 400));
        if (!signals.containsKey(exit))
            signals.put(exit, new BAL3Signal(exit, 400));
        if (!detectors.containsKey(entry))
            detectors.put(entry, new DiDetector(
                    new DetectorImpl(null, 0, false, entry), Direction.FORWARD)
            );
        if (!detectors.containsKey(exit))
            detectors.put(exit, new DiDetector(
                    new DetectorImpl(null, 0, false, exit), Direction.FORWARD)
            );
        var routeID = String.format("%s->%s", entry, exit);
        var newRoute = new DummyRoute(
                routeID,
                length,
                signals.get(entry),
                signals.get(exit),
                ImmutableList.of(detectors.get(entry), detectors.get(exit))
        );
        builder.put(routeID, newRoute);
        return newRoute;
    }

    /** Dummy route: every abstract method is implemented but only the ones needed for stdcm give actual results */
    public static class DummyRoute implements SignalingRoute, ReservationRoute {

        private final String id;
        private final double length;
        private final Signal<? extends SignalState> entrySignal;
        private final Signal<? extends SignalState> exitSignal;
        private final ImmutableList<DiDetector> detectors;

        DummyRoute(
                String id,
                double length,
                Signal<? extends SignalState> entrySignal,
                Signal<? extends SignalState> exitSignal,
                ImmutableList<DiDetector> detectors
        ) {
            this.id = id;
            this.length = length;
            this.entrySignal = entrySignal;
            this.exitSignal = exitSignal;
            this.detectors = detectors;
        }

        @Override
        public String getID() {
            return id;
        }

        @Override
        public ImmutableList<DiDetector> getDetectorPath() {
            return detectors;
        }

        @Override
        public ImmutableList<Detector> getReleasePoints() {
            return null;
        }

        @Override
        public ImmutableSet<ReservationRoute> getConflictingRoutes() {
            return null;
        }

        @Override
        public ImmutableList<TrackRangeView> getTrackRanges() {
            var track = new TrackSectionImpl(100, "track_id");
            return ImmutableList.of(new TrackRangeView(0, 100,
                    new DiTrackEdgeImpl(track, Direction.FORWARD)
            ));
        }

        @Override
        public double getLength() {
            return length;
        }

        @Override
        public boolean isControlled() {
            return false;
        }

        @Override
        public ReservationRoute getInfraRoute() {
            return this;
        }

        @Override
        public Signal<? extends SignalState> getEntrySignal() {
            return entrySignal;
        }

        @Override
        public Signal<? extends SignalState> getExitSignal() {
            return exitSignal;
        }

        @Override
        public String getSignalingType() {
            return null;
        }
    }

    /** Dummy infra: every abstract method is implemented but only the ones needed for stdcm give actual results */
    public static class DummySignalingInfra implements SignalingInfra {

        private final ImmutableMap<String, DummyRoute> routes;

        public DummySignalingInfra(ImmutableMap<String, DummyRoute> routes) {
            this.routes = routes;
        }

        @Override
        public ImmutableNetwork<TrackNode, TrackEdge> getTrackGraph() {
            return null;
        }

        @Override
        public ImmutableMap<String, Switch> getSwitches() {
            return null;
        }

        @Override
        public TrackSection getTrackSection(String id) {
            return null;
        }

        @Override
        public ImmutableMap<String, Detector> getDetectorMap() {
            return null;
        }

        @Override
        public ImmutableMap<DiDetector, DetectionSection> getSectionMap() {
            return null;
        }

        @Override
        public ImmutableNetwork<DiDetector, ReservationRoute> getInfraRouteGraph() {
            return null;
        }

        @Override
        public ImmutableMap<String, ReservationRoute> getReservationRouteMap() {
            var res = ImmutableMap.<String, ReservationRoute>builder();
            for (var entry : routes.entrySet())
                res.put(entry.getKey(), entry.getValue());
            return res.build();
        }

        @Override
        public ImmutableMultimap<DiTrackEdge, RouteEntry> getRoutesOnEdges() {
            return null;
        }

        @Override
        public ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> getSignalMap() {
            return null;
        }

        @Override
        public ImmutableMultimap<ReservationRoute, SignalingRoute> getRouteMap() {
            return null;
        }

        @Override
        public ImmutableNetwork<DiDetector, SignalingRoute> getSignalingRouteGraph() {
            return null;
        }

        @Override
        public SignalingRoute findSignalingRoute(String id, String signalingType) {
            return routes.get(id);
        }

        @Override
        public ImmutableNetwork<DiTrackNode, DiTrackEdge> getDiTrackGraph() {
            return null;
        }

        @Override
        public DiTrackEdge getEdge(String id, Direction direction) {
            return null;
        }

        @Override
        public DiTrackEdge getEdge(TrackEdge edge, Direction direction) {
            return null;
        }
    }
}
