package fr.sncf.osrd.new_infra.api.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.utils.attrs.ImmutableAttrMap;

public interface TrackInfra {
    /** Returns an undirected graph of all tracks */
    ImmutableNetwork<TrackNode, TrackEdge> getTrackGraph();

    /** Returns a map from switch to switch ID */
    ImmutableMap<String, Switch> getSwitches();

    /** Returns all attributes associated with a given edge */
    ImmutableAttrMap<Object> getAttrs(TrackEdge edge);

    /** Returns all attributes associated with a given node */
    ImmutableAttrMap<Object> getAttrs(TrackNode node);
}
