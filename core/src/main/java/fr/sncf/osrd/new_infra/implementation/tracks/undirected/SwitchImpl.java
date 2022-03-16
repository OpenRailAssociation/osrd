package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.new_infra.api.tracks.undirected.SwitchBranch;
import fr.sncf.osrd.new_infra.api.tracks.undirected.SwitchPort;

public class SwitchImpl implements Switch {
    private final String id;
    private final ImmutableNetwork<SwitchPort, SwitchBranch> graph;
    private final ImmutableMultimap<String, SwitchBranch> groups;
    private final ImmutableMap<String, SwitchPort> ports;
    private final String defaultGroup;

    /** Constructor */
    public SwitchImpl(
            String id,
            ImmutableNetwork<SwitchPort, SwitchBranch> graph,
            ImmutableMultimap<String, SwitchBranch> groups,
            ImmutableMap<String, SwitchPort> ports,
            String defaultGroup
    ) {
        this.id = id;
        this.graph = graph;
        this.groups = groups;
        this.ports = ports;
        this.defaultGroup = defaultGroup;
    }

    @Override
    public String getID() {
        return id;
    }

    @Override
    public ImmutableNetwork<SwitchPort, SwitchBranch> getGraph() {
        return graph;
    }

    @Override
    public SwitchPort getPort(String portId) {
        return ports.get(portId);
    }

    @Override
    public ImmutableMultimap<String, SwitchBranch> getGroups() {
        return groups;
    }

    @Override
    public String getDefaultGroup() {
        return defaultGroup;
    }
}
