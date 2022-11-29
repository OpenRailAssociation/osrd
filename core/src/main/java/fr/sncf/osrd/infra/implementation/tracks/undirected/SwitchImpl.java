package fr.sncf.osrd.infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchBranch;
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchPort;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class SwitchImpl implements Switch {
    private final String id;
    private final ImmutableNetwork<SwitchPort, SwitchBranch> graph;
    private final ImmutableMultimap<String, SwitchBranch> groups;

    private final double groupChangeDelay;

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("id", id)
                .add("graph", graph)
                .add("groups", groups)
                .add("ports", ports)
                .toString();
    }

    private final ImmutableMap<String, SwitchPort> ports;

    /** Constructor */
    public SwitchImpl(
            String id,
            ImmutableNetwork<SwitchPort, SwitchBranch> graph,
            ImmutableMultimap<String, SwitchBranch> groups,
            double groupChangeDelay,
            ImmutableMap<String, SwitchPort> ports
    ) {
        this.id = id;
        this.graph = graph;
        this.groups = groups;
        this.groupChangeDelay = groupChangeDelay;
        this.ports = ports;
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
    public String findBranchGroup(SwitchBranch branch) {
        for (var group : groups.asMap().entrySet()) {
            for (var groupBranch : group.getValue()) {
                if (groupBranch == branch)
                    return group.getKey();
            }
        }
        return null;
    }

    @Override
    public double getGroupChangeDelay() {
        return groupChangeDelay;
    }
}
