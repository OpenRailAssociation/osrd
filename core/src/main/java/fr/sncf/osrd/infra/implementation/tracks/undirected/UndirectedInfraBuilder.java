package fr.sncf.osrd.infra.implementation.tracks.undirected;

import static fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType.*;
import static java.lang.Math.abs;

import com.google.common.collect.*;
import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.*;
import fr.sncf.osrd.infra.errors.InvalidInfraError;
import fr.sncf.osrd.infra.implementation.RJSObjectParsing;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.reporting.warnings.Warning;
import fr.sncf.osrd.reporting.warnings.WarningRecorder;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import java.util.*;

@SuppressFBWarnings({"NP_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class UndirectedInfraBuilder {

    private final HashMap<String, TrackNode> beginEndpoints = new HashMap<>();
    private final HashMap<String, TrackNode> endEndpoints = new HashMap<>();
    private final IdentityHashMap<TrackSectionImpl, ArrayList<Detector>> detectorLists = new IdentityHashMap<>();
    private final ImmutableNetwork.Builder<TrackNode, TrackEdge> builder;
    private final Multimap<String, OperationalPoint> operationalPointsPerTrack = ArrayListMultimap.create();
    private final WarningRecorder warningRecorder;

    /** Constructor */
    private UndirectedInfraBuilder(WarningRecorder warningRecorder) {
        this.warningRecorder = warningRecorder;
        builder = NetworkBuilder
                .directed()
                .immutable();
    }

    /** Creates a TrackInfra from a railjson infra */
    public static TrackInfra parseInfra(RJSInfra infra, WarningRecorder warningRecorder) {
        return new UndirectedInfraBuilder(warningRecorder).parse(infra);
    }

    /** Parse the railjson to build an infra */
    private TrackInfra parse(RJSInfra infra) {
        // Loads operational points
        for (var op : infra.operationalPoints) {
            for (var part : op.parts) {
                var newOp = new OperationalPoint(part.position, op.id);
                operationalPointsPerTrack.put(part.track.id.id, newOp);
            }
        }

        // Creates switches
        var switchTypeMap = new HashMap<String, RJSSwitchType>();
        for (var rjsSwitchType : infra.switchTypes)
            switchTypeMap.put(rjsSwitchType.id, rjsSwitchType);
        var switches = new ImmutableMap.Builder<String, Switch>();
        for (var s : infra.switches) {
            switches.put(s.id, parseSwitch(s, switchTypeMap));
        }

        addRemainingLinks(infra);

        var trackSectionsByID = new HashMap<String, TrackSectionImpl>();
        for (var track : infra.trackSections) {
            var newTrack = makeTrackSection(track);
            trackSectionsByID.put(newTrack.getID(), newTrack);
            detectorLists.put(newTrack, new ArrayList<>());
        }

        for (var detector : infra.detectors) {
            makeWaypoint(trackSectionsByID, detector, false);
        }
        for (var bufferStop : infra.bufferStops) {
            makeWaypoint(trackSectionsByID, bufferStop, true);
        }

        for (var entry : detectorLists.entrySet()) {
            var track = entry.getKey();
            var detectors = entry.getValue();
            detectors.sort(Comparator.comparingDouble(Detector::getOffset));
            track.detectors = ImmutableList.copyOf(detectors);
        }

        addSpeedSections(infra.speedSections, trackSectionsByID);

        return TrackInfraImpl.from(switches.build(), builder.build());
    }

    /** Creates all the track section links that haven't already been created by switches */
    private void addRemainingLinks(RJSInfra infra) {
        int generatedID = 0;
        for (var link : infra.trackSectionLinks) {
            var srcID = link.src.track.id.id;
            var dstID = link.dst.track.id.id;
            var oldSrcNode = getNode(srcID, link.src.endpoint);
            var oldDstNode = getNode(dstID, link.dst.endpoint);
            if (oldSrcNode != null || oldDstNode != null) {
                // At least one of the node already exists:
                // either both are the same switch node, or there is an error in the infra
                if (oldSrcNode instanceof SwitchPort srcSwitchPort
                                && oldDstNode instanceof SwitchPort dstSwitchPort
                                && srcSwitchPort.getSwitch().getID().equals(dstSwitchPort.getSwitch().getID()))
                    continue;
                throw new InvalidInfraError(String.format(
                        "Error in track link %s: at least one endpoint is already linked (src=%s, dst=%s)",
                        link.id,
                        oldSrcNode,
                        oldDstNode
                ));
            }
            if (link.id == null || link.id.equals("")) {
                // Forcing a unique ID avoids node equality troubles, and makes debugging easier
                link.id = String.format("generated_%d", generatedID++);
            }
            var newNode = new TrackNodeImpl.Joint(link.id);
            addNode(srcID, link.src.endpoint, newNode);
            addNode(dstID, link.dst.endpoint, newNode);
        }
    }

    /** Adds all the speed sections to track attributes */
    private void addSpeedSections(
            List<RJSSpeedSection> speedSections,
            HashMap<String, TrackSectionImpl> trackSectionsByID
    ) {
        // Creates the maps and fills them with 0
        for (var track : trackSectionsByID.values()) {
            var trackSpeedSections = new EnumMap<Direction, RangeMap<Double, SpeedLimits>>(Direction.class);
            for (var dir : Direction.values()) {
                var newMap = TreeRangeMap.<Double, SpeedLimits>create();
                newMap.put(Range.closed(0., track.getLength()),
                        new SpeedLimits(Double.POSITIVE_INFINITY, ImmutableMap.of()));
                trackSpeedSections.put(dir, newMap);
            }
            track.speedSections = trackSpeedSections;
        }

        // Reads all the speed sections and adds the values to the tracks
        for (var speedSection : speedSections) {
            var value = SpeedLimits.from(speedSection);
            for (var trackRange : speedSection.trackRanges) {
                var track = RJSObjectParsing.getTrackSection(trackRange.track, trackSectionsByID);
                var speedSectionMaps = track.getSpeedSections();
                if (trackRange.applicableDirections.appliesToNormal()) {
                    speedSectionMaps.get(Direction.FORWARD).merge(
                            Range.closed(trackRange.begin, trackRange.end),
                            value,
                            SpeedLimits::merge
                    );
                }
                if (trackRange.applicableDirections.appliesToReverse()) {
                    speedSectionMaps.get(Direction.BACKWARD).merge(
                            Range.closed(trackRange.begin, trackRange.end),
                            value,
                            SpeedLimits::merge
                    );
                }
            }
        }
    }

    /** Creates a waypoint and add it to the corresponding track */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"}) // This case only causes issues with strict equalities
    private void makeWaypoint(HashMap<String, TrackSectionImpl> trackSectionsByID,
                            RJSRouteWaypoint waypoint, boolean isBufferStop) {
        var track = RJSObjectParsing.getTrackSection(waypoint.track, trackSectionsByID);
        var newWaypoint = new DetectorImpl(track, waypoint.position, isBufferStop, waypoint.id);
        var detectors = detectorLists.get(track);
        for (var detector : detectors)
            if (detector.getOffset() == newWaypoint.offset) {
                warningRecorder.register(new Warning(String.format(
                        "Duplicate waypoint (dropping new) : old = %s, new = %s",
                        detector, newWaypoint
                )));
                return;
            }
        detectors.add(newWaypoint);
    }

    /** Creates a track section and registers it in the graph */
    private TrackSectionImpl makeTrackSection(RJSTrackSection track) {
        var begin = getOrCreateNode(track.id, EdgeEndpoint.BEGIN);
        var end = getOrCreateNode(track.id, EdgeEndpoint.END);
        var edge = new TrackSectionImpl(
                track.length,
                track.id,
                ImmutableSet.copyOf(operationalPointsPerTrack.get(track.id)),
                track.geo,
                track.sch,
                buildLoadingGaugeLimits(track.loadingGaugeLimits)
        );
        builder.addEdge(begin, end, edge);
        edge.gradients = makeGradients(track);
        return edge;
    }

    /** Builds the ranges of blocked loading gauge types on the track */
    private ImmutableRangeMap<Double, LoadingGaugeConstraint> buildLoadingGaugeLimits(
            List<RJSLoadingGaugeLimit> limits
    ) {
        // This method has a bad complexity compared to more advanced solutions,
        // but we don't expect more than a few ranges per section.
        // TODO: use an interval tree

        if (limits == null)
            return ImmutableRangeMap.of();
        var builder = new ImmutableRangeMap.Builder<Double, LoadingGaugeConstraint>();

        // Sorts and removes duplicates
        var transitions = new TreeSet<Double>();
        for (var range : limits) {
            transitions.add(range.begin);
            transitions.add(range.end);
        }

        var transitionsList = new ArrayList<>(transitions); // Needed for index based loop
        for (int i = 1; i < transitionsList.size(); i++) {
            var begin = transitionsList.get(i - 1);
            var end = transitionsList.get(i);
            var allowedTypes = new HashSet<RJSLoadingGaugeType>();
            for (var range : limits)
                if (range.begin <= begin && range.end >= end)
                    allowedTypes.addAll(getCompatibleGaugeTypes(range.type));
            var blockedTypes = Sets.difference(
                    Sets.newHashSet(RJSLoadingGaugeType.values()),
                    allowedTypes
            );
            builder.put(Range.open(begin, end), new LoadingGaugeConstraintImpl(ImmutableSet.copyOf(blockedTypes)));
        }
        return builder.build();
    }

    /** Returns all the rolling stock gauge types compatible with the given track type */
    private Set<RJSLoadingGaugeType> getCompatibleGaugeTypes(RJSLoadingGaugeType trackType) {
        return switch (trackType) {
            case G1 -> Set.of(G1);
            case GA -> Sets.union(Set.of(GA), getCompatibleGaugeTypes(G1));
            case GB -> Sets.union(Set.of(GB, FR3_3_GB_G2), getCompatibleGaugeTypes(GA));
            case GB1 -> Sets.union(Set.of(GB1), getCompatibleGaugeTypes(GB));
            case GC -> Sets.union(Set.of(GC), getCompatibleGaugeTypes(GB1));
            case G2 -> Set.of(G1, G2, FR3_3_GB_G2);
            case FR3_3 -> Set.of(FR3_3, FR3_3_GB_G2);
            default -> {
                warningRecorder.register(new Warning("Invalid gauge type for track: " + trackType));
                yield Sets.newHashSet(RJSLoadingGaugeType.values());
            }
        };
    }

    /** Creates the two RangeMaps with gradient values */
    private EnumMap<Direction, RangeMap<Double, Double>> makeGradients(RJSTrackSection track) {
        var res = new EnumMap<Direction, RangeMap<Double, Double>>(Direction.class);
        for (var dir : Direction.values()) {
            var newMap = TreeRangeMap.<Double, Double>create();
            newMap.putCoalescing(Range.closed(0., track.length), 0.);
            res.put(dir, newMap);
        }

        // Insert railjson slopes
        if (track.slopes != null) {
            for (var rjsSlope : track.slopes) {
                rjsSlope.simplify();
                if (rjsSlope.begin < 0 || rjsSlope.end > track.length)
                    throw new InvalidInfraError(
                            String.format("Track '%s' has a slope with an invalid range", track.id));
                if (rjsSlope.gradient != 0.) {
                    for (var dir : Direction.values())
                        res.get(dir).putCoalescing(
                                Range.closed(rjsSlope.begin, rjsSlope.end),
                                rjsSlope.gradient * dir.sign
                        );
                }
            }
        }
        for (var dir : Direction.values())
            addCurvesToGradients(res.get(dir), track);
        return res;
    }

    /** Inserts curves as extra gradient values */
    private static void addCurvesToGradients(RangeMap<Double, Double> gradients, RJSTrackSection track) {
        // Insert curves: gradient + 800 / radius
        if (track.curves != null)
            for (var rjsCurve : track.curves) {
                rjsCurve.simplify();
                if (rjsCurve.begin < 0 || rjsCurve.end > track.length)
                    throw new InvalidInfraError(
                            String.format("Track '%s' has a curve with an invalid range", track.id));

                if (rjsCurve.radius == 0.)
                    continue;

                var subMap = gradients.subRangeMap(Range.open(rjsCurve.begin, rjsCurve.end));
                var entries = new HashMap<>(subMap.asMapOfRanges());
                for (var entry : entries.entrySet())
                    gradients.putCoalescing(entry.getKey(), entry.getValue() + 800. / abs(rjsCurve.radius));
            }
    }

    /** Creates a node and registers it in the graph */
    private void addNode(String trackId, EdgeEndpoint endpoint, TrackNode node) {
        var map = beginEndpoints;
        if (endpoint == EdgeEndpoint.END)
            map = endEndpoints;
        if (map.containsKey(trackId))
            warningRecorder.register(new Warning(String.format(
                    "Duplicated track link on endpoint (%s - %s) : (old=%s, new=%s). This may cause issues later on",
                    trackId, endpoint, map.get(trackId), node
            )));
        map.put(trackId, node);
        builder.addNode(node);
    }

    /** Returns the node at the given end of the track, returns null if absent */
    private TrackNode getNode(String trackId, EdgeEndpoint endpoint) {
        var map = beginEndpoints;
        if (endpoint == EdgeEndpoint.END)
            map = endEndpoints;
        return map.getOrDefault(trackId, null);
    }

    /** Returns the node at the given end of the track, create a TrackNode.End if absent */
    private TrackNode getOrCreateNode(String trackId, EdgeEndpoint endpoint) {
        var res = getNode(trackId, endpoint);
        if (res != null)
            return res;
        res = new TrackNodeImpl.End();
        addNode(trackId, endpoint, res);
        return res;
    }

    /** Parse a given RJS switch */
    private Switch parseSwitch(
            RJSSwitch rjsSwitch,
            HashMap<String, RJSSwitchType> switchTypeMap
    ) {
        var networkBuilder = NetworkBuilder.directed()
                .<SwitchPort, SwitchBranch>immutable();
        var portMap = ImmutableMap.<String, SwitchPort>builder();
        var allPorts = new HashSet<SwitchPortImpl>();
        for (var entry : rjsSwitch.ports.entrySet()) {
            var portName = entry.getKey();
            var port = entry.getValue();
            var newNode = new SwitchPortImpl(portName, rjsSwitch.id);
            portMap.put(portName, newNode);
            networkBuilder.addNode(newNode);
            addNode(port.track.id.id, port.endpoint, newNode);
            allPorts.add(newNode);
        }
        var finalPortMap = portMap.build();
        var switchType = RJSObjectParsing.getSwitchType(rjsSwitch.switchType, switchTypeMap);
        var groups = ImmutableMultimap.<String, SwitchBranch>builder();
        var allBranches = new HashSet<SwitchBranchImpl>();
        for (var entry : switchType.groups.entrySet()) {
            for (var e : entry.getValue()) {
                var src = finalPortMap.get(e.src);
                var dst = finalPortMap.get(e.dst);
                var branch = new SwitchBranchImpl(e.src, e.dst);
                groups.put(entry.getKey(), branch);
                assert src != null;
                assert dst != null;
                networkBuilder.addEdge(src, dst, branch);
                builder.addEdge(src, dst, branch);
                allBranches.add(branch);
            }
        }
        var switchTypePorts = new HashSet<>(switchType.ports);
        var switchPorts = rjsSwitch.ports.keySet();
        if (!switchTypePorts.equals(switchPorts))
            throw new InvalidInfraError(String.format(
                    "Switch %s doesn't have the right ports for type %s (expected %s, got %s)",
                    rjsSwitch.id, switchType.id, switchTypePorts, switchPorts
            ));

        var res = new SwitchImpl(rjsSwitch.id, networkBuilder.build(), groups.build(), finalPortMap);
        for (var branch : allBranches)
            branch.switchRef = res;
        for (var port : allPorts)
            port.switchRef = res;
        return res;
    }
}
