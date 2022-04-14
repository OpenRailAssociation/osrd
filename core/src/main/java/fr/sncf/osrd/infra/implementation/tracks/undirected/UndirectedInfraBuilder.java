package fr.sncf.osrd.infra.implementation.tracks.undirected;

import static java.lang.Math.abs;

import com.google.common.collect.*;
import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.*;
import fr.sncf.osrd.infra.implementation.InvalidInfraError;
import fr.sncf.osrd.infra.implementation.RJSObjectParsing;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.utils.DoubleRangeMap;
import java.util.*;

@SuppressFBWarnings({"NP_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class UndirectedInfraBuilder {

    private final HashMap<String, TrackNode> beginEndpoints = new HashMap<>();
    private final HashMap<String, TrackNode> endEndpoints = new HashMap<>();
    private final HashMap<TrackSectionImpl, ArrayList<Detector>> detectorLists = new HashMap<>();
    private final ImmutableNetwork.Builder<TrackNode, TrackEdge> builder;
    private final Multimap<String, OperationalPoint> operationalPointsPerTrack = ArrayListMultimap.create();

    /** Constructor */
    private UndirectedInfraBuilder() {
        builder = NetworkBuilder
                .directed()
                .immutable();
    }

    /** Creates a TrackInfra from a railjson infra */
    public static TrackInfra parseInfra(RJSInfra infra) {
        return new UndirectedInfraBuilder().parse(infra);
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

        // Create remaining links
        for (var link : infra.trackSectionLinks) {
            var newNode = new TrackNodeImpl.Joint();
            addNode(link.src.track.id.id, link.src.endpoint, newNode);
            addNode(link.dst.track.id.id, link.dst.endpoint, newNode);
        }

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

    /** Adds all the speed sections to track attributes */
    private void addSpeedSections(
            List<RJSSpeedSection> speedSections,
            HashMap<String, TrackSectionImpl> trackSectionsByID
    ) {
        // Creates the maps and fills them with 0
        for (var track : trackSectionsByID.values()) {
            var trackSpeedSections = new EnumMap<Direction, DoubleRangeMap>(Direction.class);
            for (var dir : Direction.values()) {
                var newMap = new DoubleRangeMap();
                newMap.addRange(0., track.getLength(), 0.);
                trackSpeedSections.put(dir, newMap);
            }
            track.speedSections = trackSpeedSections;
        }

        // Reads all the speed sections and adds the values to the tracks
        for (var speedSection : speedSections) {
            var value = speedSection.speed;
            for (var trackRange : speedSection.trackRanges) {
                var track = RJSObjectParsing.getTrackSection(trackRange.track, trackSectionsByID);
                var speedSectionMaps = track.getSpeedSections();
                if (trackRange.applicableDirections.appliesToNormal()) {
                    speedSectionMaps.get(Direction.FORWARD).addRange(trackRange.begin, trackRange.end, value);
                }
                if (trackRange.applicableDirections.appliesToReverse()) {
                    speedSectionMaps.get(Direction.BACKWARD).addRange(trackRange.begin, trackRange.end, value);
                }
            }
        }
    }

    /** Creates a waypoint and add it to the corresponding track */
    private void makeWaypoint(HashMap<String, TrackSectionImpl> trackSectionsByID,
                            RJSRouteWaypoint waypoint, boolean isBufferStop) {
        var track = RJSObjectParsing.getTrackSection(waypoint.track, trackSectionsByID);
        var newWaypoint = new DetectorImpl(track, waypoint.position, isBufferStop, waypoint.id);
        detectorLists.get(track).add(newWaypoint);
    }

    /** Creates a track section and registers it in the graph */
    private TrackSectionImpl makeTrackSection(RJSTrackSection track) {
        var begin = getNode(track.id, EdgeEndpoint.BEGIN);
        var end = getNode(track.id, EdgeEndpoint.END);
        var edge = new TrackSectionImpl(
                track.length,
                track.id,
                ImmutableSet.copyOf(operationalPointsPerTrack.get(track.id)),
                track.geo,
                track.sch
        );
        builder.addEdge(begin, end, edge);
        edge.gradients = makeGradients(track);
        return edge;
    }

    /** Creates the two DoubleRangeMaps with gradient values */
    private EnumMap<Direction, DoubleRangeMap> makeGradients(RJSTrackSection track) {
        var res = new EnumMap<Direction, DoubleRangeMap>(Direction.class);
        for (var dir : Direction.values()) {
            var newMap = new DoubleRangeMap();
            newMap.addRange(0., track.length, 0.);
            res.put(dir, newMap);
        }

        // Insert railjson slopes
        if (track.slopes != null)
            for (var rjsSlope : track.slopes)
                if (rjsSlope.gradient != 0.)
                    for (var dir : Direction.values())
                        res.get(dir).addRange(rjsSlope.begin, rjsSlope.end, rjsSlope.gradient * dir.sign);
        for (var dir : Direction.values())
            addCurvesToGradients(res.get(dir), track);
        return res;
    }

    /** Inserts curves as extra gradient values */
    private static void addCurvesToGradients(DoubleRangeMap gradients, RJSTrackSection trackSection) {
        // Insert curves: gradient + 800 / radius
        if (trackSection.curves != null)
            for (var rjsCurve : trackSection.curves) {
                if (rjsCurve.radius == 0.)
                    continue;

                var floorEndEntry = gradients.floorEntry(rjsCurve.end);
                gradients.put(rjsCurve.end, floorEndEntry.getValue());

                var floorBeginEntry = gradients.floorEntry(rjsCurve.begin);
                if (floorBeginEntry.getKey() < rjsCurve.begin)
                    gradients.put(rjsCurve.begin, floorBeginEntry.getValue() + 800. / abs(rjsCurve.radius));

                for (var slopeEntry : gradients.subMap(rjsCurve.begin, rjsCurve.end).entrySet())
                    gradients.put(slopeEntry.getKey(), slopeEntry.getValue() + 800. / abs(rjsCurve.radius));
            }
    }

    /** Creates a node and registers it in the graph */
    private void addNode(String trackId, EdgeEndpoint endpoint, TrackNode node) {
        var map = beginEndpoints;
        if (endpoint == EdgeEndpoint.END)
            map = endEndpoints;
        if (map.containsKey(trackId)) {
            if (map.get(trackId) instanceof SwitchPort) // the link is already created in a switch, ignore
                return;
            throw new InvalidInfraError("Duplicated track link"); // TODO: add details
        }
        map.put(trackId, node);
        builder.addNode(node);
    }

    /** Returns the node at the given end of the track */
    private TrackNode getNode(String trackId, EdgeEndpoint endpoint) {
        var map = beginEndpoints;
        if (endpoint == EdgeEndpoint.END)
            map = endEndpoints;
        if (map.containsKey(trackId))
            return map.get(trackId);
        var res = new TrackNodeImpl.End();
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
            var newNode = new SwitchPortImpl(portName);
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
                var branch = new SwitchBranchImpl();
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
