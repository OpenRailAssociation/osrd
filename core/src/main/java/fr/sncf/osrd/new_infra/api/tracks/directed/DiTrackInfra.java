package fr.sncf.osrd.new_infra.api.tracks.directed;

import com.google.common.graph.ImmutableNetwork;
import com.google.common.reflect.ImmutableTypeToInstanceMap;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;

public interface DiTrackInfra extends TrackInfra {
    /** Returns the directed track graph */
    ImmutableNetwork<DiTrackNode, DiTrackEdge> getDiTrackGraph();

    /** Returns all attributes associated with a given edge */
    ImmutableTypeToInstanceMap<Object> getAttrs(DiTrackEdge edge);

    /** Returns all attributes associated with a given node */
    ImmutableTypeToInstanceMap<Object> getAttrs(DiTrackNode node);
}
