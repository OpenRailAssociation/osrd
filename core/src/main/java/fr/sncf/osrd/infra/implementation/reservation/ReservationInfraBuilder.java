package fr.sncf.osrd.infra.implementation.reservation;

import static fr.sncf.osrd.infra.api.Direction.FORWARD;

import com.google.common.collect.*;
import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchBranch;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra.errors.DiscontinuousRoute;
import fr.sncf.osrd.infra.errors.MissingDetectorsRoute;
import fr.sncf.osrd.infra.implementation.tracks.directed.DirectedInfraBuilder;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.reporting.warnings.Warning;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorder;
import java.util.*;
import java.util.stream.Collectors;

public class ReservationInfraBuilder {

    private final DiTrackInfra diTrackInfra;
    private final RJSInfra rjsInfra;
    private final DiagnosticRecorder diagnosticRecorder;

    /** Constructor */
    private ReservationInfraBuilder(RJSInfra rjsInfra, DiTrackInfra infra, DiagnosticRecorder diagnosticRecorder) {
        this.rjsInfra = rjsInfra;
        this.diTrackInfra = infra;
        this.diagnosticRecorder = diagnosticRecorder;
    }

    /** Builds a ReservationInfra from railjson data and a DiTrackInfra */
    public static ReservationInfra fromDiTrackInfra(
            RJSInfra rjsInfra,
            DiTrackInfra diTrackInfra,
            DiagnosticRecorder diagnosticRecorder
    ) {
        return new ReservationInfraBuilder(rjsInfra, diTrackInfra, diagnosticRecorder).build();
    }

    /** Builds a ReservationInfra from a railjson infra */
    public static ReservationInfra fromRJS(RJSInfra rjsInfra, DiagnosticRecorder diagnosticRecorder) {
        var diInfra = DirectedInfraBuilder.fromRJS(rjsInfra, diagnosticRecorder);
        return fromDiTrackInfra(rjsInfra, diInfra, diagnosticRecorder);
    }

    /** Builds everything */
    private ReservationInfra build() {
        var reservationSections = DetectionSectionBuilder.build(
                diTrackInfra
        );
        var routeGraph = makeRouteGraph(reservationSections);
        return new ReservationInfraImpl(
                diTrackInfra,
                makeSectionMap(reservationSections),
                routeGraph,
                makeReservationRouteMap(routeGraph),
                makeRouteOnEdgeMap(routeGraph.edges()),
                ImmutableList.copyOf(reservationSections));
    }

    /** Builds a multimap of routes present on each edge */
    private static ImmutableMultimap<DiTrackEdge, ReservationInfra.RouteEntry>
            makeRouteOnEdgeMap(Collection<ReservationRoute> routes) {
        var res = ImmutableMultimap.<DiTrackEdge, ReservationInfra.RouteEntry>builder();
        for (var route : routes) {
            double offset = 0.;
            for (var range : route.getTrackRanges()) {
                double rangeOffset; // Offset from the start of the track to the start of the range
                if (range.track.getDirection().equals(FORWARD))
                    rangeOffset = range.begin;
                else
                    rangeOffset = range.track.getEdge().getLength() - range.end;
                assert rangeOffset == 0 || offset == 0
                        : "A track range must be either the first on the route, or start at the edge of a track";
                var rangeOffsetFromRouteStart = rangeOffset - offset;
                var routeEntry = new ReservationInfra.RouteEntry(route, rangeOffsetFromRouteStart);
                res.put(range.track, routeEntry);
                offset += range.getLength();
            }
        }
        return res.build();
    }

    /** Builds an ID to route mapping */
    private ImmutableMap<String, ReservationRoute> makeReservationRouteMap(
            ImmutableNetwork<DiDetector, ReservationRoute> routeGraph
    ) {
        var res = ImmutableMap.<String, ReservationRoute>builder();
        for (var route : routeGraph.edges())
            res.put(route.getID(), route);
        return res.build();
    }

    /** Instantiates the routes and links them together in the graph */
    private ImmutableNetwork<DiDetector, ReservationRoute> makeRouteGraph(
            ArrayList<DetectionSection> reservationSections
    ) {
        var networkBuilder = NetworkBuilder
                .directed()
                .<DiDetector, ReservationRoute>immutable();
        var routesPerSection = new IdentityHashMap<DetectionSection, ImmutableSet.Builder<ReservationRoute>>();
        for (var section : reservationSections)
            routesPerSection.put(section, new ImmutableSet.Builder<>());
        var routes = new ArrayList<ReservationRouteImpl>();
        for (var rjsRoute : rjsInfra.routes) {
            var trackRanges = makeTrackRanges(rjsRoute);
            var length = trackRanges.stream().mapToDouble(TrackRangeView::getLength).sum();
            var detectors = detectorsOnRoute(trackRanges);
            var sections = sectionsOnRoute(detectors);
            var route = new ReservationRouteImpl(detectors, releasePoints(rjsRoute),
                    rjsRoute.id, trackRanges, isRouteControlled(rjsRoute), length, sections);
            validateRoute(route, rjsRoute);
            routes.add(route);
            for (var section : sections)
                routesPerSection.get(section).add(route);
        }

        // Sets the routes passing through each section
        for (var entry : routesPerSection.entrySet())
            if (entry.getKey() instanceof DetectionSectionImpl section)
                section.setRoutes(entry.getValue().build());

        diagnosticRecorder.verify();

        for (var route : routes) {
            networkBuilder.addEdge(
                    route.getDetectorPath().get(0),
                    route.getDetectorPath().get(route.getDetectorPath().size() - 1),
                    route
            );
        }
        return networkBuilder.build();
    }

    /** Checks that the route makes sense, reports any relevant warning or error otherwise */
    private void validateRoute(ReservationRouteImpl route, RJSRoute rjsRoute) {
        if (route.getDetectorPath().size() < 2)
            diagnosticRecorder.register(new MissingDetectorsRoute(rjsRoute.id, route.getDetectorPath().size()));

        var detectorIDs = route.getDetectorPath().stream()
                        .map(x -> x.detector().getID())
                .collect(Collectors.toSet());
        for (var releasePoint : route.getReleasePoints()) {
            if (!detectorIDs.contains(releasePoint.getID()))
                diagnosticRecorder.register(new Warning(String.format(
                    "Release detector for route %s is not part of the route",
                    rjsRoute.id
                )));
        }
        var lastDetector = route.getDetectorPath().get(route.getDetectorPath().size() - 1);
        if (rjsRoute.entryPoint != null) {
            var entryDetector = route.getDetectorPath().get(0).detector();
            if (!entryDetector.getID().equals(rjsRoute.entryPoint.id.id))
                diagnosticRecorder.register(new Warning(String.format(
                        "Entry point for route %s don't match the first detector on the route "
                                + "(expected = %s, detector list = %s)",
                        rjsRoute.id,
                        rjsRoute.entryPoint.id.id,
                        detectorIDs
                )));
            var entryPointLocation = new TrackLocation(entryDetector.getTrackSection(), entryDetector.getOffset());
            var routeStartLocation = route.getTrackRanges().get(0).offsetLocation(0);
            if (!entryPointLocation.equalsWithTolerance(routeStartLocation, 1e-8)) {
                diagnosticRecorder.register(new Warning(String.format(
                        "Entry point for route %s isn't located on the route start "
                                + "(detector location = %s, route start = %s)",
                        rjsRoute.id,
                        entryPointLocation,
                        routeStartLocation
                )));
            }
        }
        if (rjsRoute.exitPoint != null) {
            var exitDetector = lastDetector.detector();
            if (!lastDetector.detector().getID().equals(rjsRoute.exitPoint.id.id))
                diagnosticRecorder.register(new Warning(String.format(
                        "Exit point for route %s don't match the last detector on the route "
                                + "(expected = %s, detector list = %s)",
                        rjsRoute.id,
                        rjsRoute.exitPoint.id.id,
                        detectorIDs
                )));
            var exitPointLocation = new TrackLocation(exitDetector.getTrackSection(), exitDetector.getOffset());
            var lastRouteRange = route.getTrackRanges().get(route.getTrackRanges().size() - 1);
            var routeEndLocation = lastRouteRange.offsetLocation(lastRouteRange.getLength());
            if (!exitPointLocation.equalsWithTolerance(routeEndLocation, 1e-8)) {
                diagnosticRecorder.register(new Warning(String.format(
                        "Exit point for route %s isn't located on the route start "
                                + "(detector location = %s, route end = %s)",
                        rjsRoute.id,
                        exitPointLocation,
                        routeEndLocation
                )));
            }
        }
    }

    /** Returns true if the route is controlled (requires explicit reservation to be used) */
    private boolean isRouteControlled(RJSRoute rjsRoute) {
        return !rjsRoute.switchesDirections.isEmpty();
    }

    private ImmutableList<TrackRangeView> makeTrackRanges(RJSRoute rjsRoute) {
        var res = new ArrayList<TrackRangeView>();

        var direction = Direction.fromEdgeDir(rjsRoute.entryPointDirection);
        var entryDetector = diTrackInfra.getDetectorMap().get(rjsRoute.entryPoint.id.id);
        assert entryDetector != null : String.format("Couldn't find '%s' detector", rjsRoute.entryPoint.id.id);
        var exitDetector = diTrackInfra.getDetectorMap().get(rjsRoute.exitPoint.id.id);
        assert exitDetector != null : String.format("Couldn't find '%s' detector", rjsRoute.exitPoint.id.id);
        var edge = diTrackInfra.getEdge(entryDetector.getTrackSection(), direction);
        var position = entryDetector.getOffset();
        var exitEdge = exitDetector.getTrackSection();
        var g = diTrackInfra.getDiTrackGraph();

        while (edge.getEdge() != exitEdge) {
            // Add track range
            double endPosition = edge.getDirection() == FORWARD ? edge.getEdge().getLength() : 0.;
            res.add(new TrackRangeView(position, endPosition, edge));

            // Find next track
            var endpointPair = g.incidentNodes(edge);
            var neighbors = g.outEdges(endpointPair.target());

            if (neighbors.isEmpty())
                throw new DiscontinuousRoute(rjsRoute.id);

            var firstNeighbor = neighbors.iterator().next();
            if (!(firstNeighbor.getEdge() instanceof SwitchBranch)) {
                assert neighbors.size() == 1;
                // Simple track link
                edge = firstNeighbor;
            } else {
                // Switch link
                var aSwitch = ((SwitchBranch) firstNeighbor.getEdge()).getSwitch();
                var switchGroup = rjsRoute.switchesDirections.get(aSwitch.getID());
                var switchBranches = aSwitch.getGroups().get(switchGroup);
                var newEdge = edge;
                for (var neighbor : neighbors) {
                    if (switchBranches.contains((SwitchBranch) neighbor.getEdge())) {
                        edge = neighbor;
                        break;
                    }
                }
                // We didn't find a next edge
                if (newEdge == edge)
                    throw new DiscontinuousRoute(rjsRoute.id);
            }
            position = edge.getDirection() == FORWARD ? 0 : edge.getEdge().getLength();
        }
        res.add(new TrackRangeView(position, exitDetector.getOffset(), edge));
        return ImmutableList.copyOf(res);
    }

    /** Lists the release points on a given route (in order) */
    private ImmutableList<Detector> releasePoints(RJSRoute rjsRoute) {
        var builder = ImmutableList.<Detector>builder();
        for (var rjsDetector : rjsRoute.releaseDetectors) {
            var detector = diTrackInfra.getDetectorMap().get(rjsDetector);
            assert detector != null;
            builder.add(detector);
        }
        return builder.build();
    }

    /** Creates a set of detection section present in the route */
    private ImmutableList<DetectionSection> sectionsOnRoute(ImmutableList<DiDetector> detectors) {
        var res = ImmutableList.<DetectionSection>builder();

        for (int i = 0; i < detectors.size() - 1; i++) {
            var d = detectors.get(i);
            res.add(d.detector().getNextDetectionSection(d.direction()));
        }
        return res.build();
    }

    /** Creates the list of DiDetectors present on the route */
    private ImmutableList<DiDetector> detectorsOnRoute(List<TrackRangeView> ranges) {
        var res = ImmutableList.<DiDetector>builder();
        for (var range : ranges)
            for (var detector : range.getDetectors())
                res.add(detector.element().getDiDetector(range.track.getDirection()));
        return res.build();
    }

    /** Creates a mapping from a directed detector to its next detection section */
    private ImmutableMap<DiDetector, DetectionSection> makeSectionMap(ArrayList<DetectionSection> sections) {
        var builder = ImmutableMap.<DiDetector, DetectionSection>builder();
        for (var section : sections) {
            for (var diDetector : section.getDetectors()) {
                builder.put(diDetector, section);
            }
        }
        return builder.buildOrThrow();
    }
}
