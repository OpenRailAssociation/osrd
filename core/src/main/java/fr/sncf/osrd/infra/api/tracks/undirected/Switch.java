package fr.sncf.osrd.infra.api.tracks.undirected;

import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;

public interface Switch {
    /** Returns the unique switch identifier */
    String getID();

    /** Returns the graph of connections between ports and branches */
    ImmutableNetwork<SwitchPort, SwitchBranch> getGraph();

    /** Looks up ports by ID */
    SwitchPort getPort(String portId);

    /** Switch branches which are not part of the active group are not available */
    ImmutableMultimap<String, SwitchBranch> getGroups();
}
