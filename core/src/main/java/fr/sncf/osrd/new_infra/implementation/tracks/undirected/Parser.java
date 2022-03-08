package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.new_infra.api.tracks.undirected.*;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import java.util.HashMap;
import java.util.HashSet;

public class Parser {

    public static TrackInfra parseInfra(RJSInfra infra) {
        return new Parser().parse(infra);
    }

    private final HashMap<String, TrackNode> beginEndpoints = new HashMap<>();
    private final HashMap<String, TrackNode> endEndpoints = new HashMap<>();
    private ImmutableNetwork.Builder<TrackNode, TrackEdge> builder;

    private TrackInfra parse(RJSInfra infra) {
        builder = NetworkBuilder
                .undirected()
                .immutable();

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
            var newNode = new InfraTrackNode.Joint();
            addNode(link.src.track.id.id, link.src.endpoint, newNode);
            addNode(link.dst.track.id.id, link.dst.endpoint, newNode);
        }

        for (var track : infra.trackSections) {
            var begin = getNode(track.id, EdgeEndpoint.BEGIN);
            var end = getNode(track.id, EdgeEndpoint.END);
            var edge = new InfraTrackSection(track.length, track.id);
            builder.addEdge(begin, end, edge);
        }

        return new InfraTrackInfra(switches.build(), builder.build());
    }

    private void addNode(String trackId, EdgeEndpoint endpoint, TrackNode node) {
        var map = beginEndpoints;
        if (endpoint == EdgeEndpoint.END)
            map = endEndpoints;
        if (map.containsKey(trackId)) {
            if (map.get(trackId) instanceof SwitchPort) // the link is already created in a switch, ignore
                return;
            throw new InvalidInfraException("Duplicated track link"); // TODO: add details
        }
        map.put(trackId, node);
        builder.addNode(node);
    }

    private TrackNode getNode(String trackId, EdgeEndpoint endpoint) {
        var map = beginEndpoints;
        if (endpoint == EdgeEndpoint.END)
            map = endEndpoints;
        if (map.containsKey(trackId))
            return map.get(trackId);
        var res = new InfraTrackNode.End();
        addNode(trackId, endpoint, res);
        return res;
    }

    /** Parse a given RJS switch */
    private Switch parseSwitch(
            RJSSwitch rjsSwitch,
            HashMap<String, RJSSwitchType> switchTypeMap
    ) throws InvalidInfraException {
        var networkBuilder = NetworkBuilder.undirected()
                .<SwitchPort, SwitchBranch>immutable();
        var portMap = ImmutableMap.<String, SwitchPort>builder();
        for (var entry : rjsSwitch.ports.entrySet()) {
            var portName = entry.getKey();
            var port = entry.getValue();
            var newNode = new InfraSwitchPort(portName);
            portMap.put(portName, newNode);
            networkBuilder.addNode(newNode);
            addNode(port.track.id.id, port.endpoint, newNode);
        }
        var finalPortMap = portMap.build();
        var switchType = rjsSwitch.switchType.getSwitchType(switchTypeMap);
        var groups = ImmutableMultimap.<String, SwitchBranch>builder();
        for (var entry : switchType.groups.entrySet()) {
            for (var e : entry.getValue()) {
                var src = finalPortMap.get(e.src);
                var dst = finalPortMap.get(e.dst);
                var branch = new InfraSwitchBranch(0);
                groups.put(entry.getKey(), branch);
                assert src != null;
                assert dst != null;
                networkBuilder.addEdge(src, dst, branch);
                builder.addEdge(src, dst, branch);
            }
        }
        var switchTypePorts = new HashSet<>(switchType.ports);
        var switchPorts = rjsSwitch.ports.keySet();
        if (!switchTypePorts.equals(switchPorts))
            throw new InvalidInfraException(String.format(
                    "Switch %s doesn't have the right ports for type %s (expected %s, got %s)",
                    rjsSwitch.id, switchType.id, switchTypePorts, switchPorts
            ));

        var res = new InfraSwitch(rjsSwitch.id, networkBuilder.build(), groups.build(), finalPortMap, "");
        return res;
    }
}
