package fr.sncf.osrd.new_infra.api.tracks.directed;

import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.utils.attrs.ImmutableAttrMap;

public interface DiTrackInfra extends TrackInfra {
    /** Returns the directed track graph */
    ImmutableNetwork<DiTrackNode, DiTrackEdge> getDiTrackGraph();

    /** Returns all attributes associated with a given edge */
    ImmutableAttrMap<Object> getAttrs(DiTrackEdge edge);

    /** Returns all attributes associated with a given node */
    ImmutableAttrMap<Object> getAttrs(DiTrackNode node);
}
