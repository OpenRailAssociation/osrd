package fr.sncf.osrd.new_infra.api.tracks.directed;

import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;

public interface DiTrackInfra extends TrackInfra {
    /** Returns the directed track graph */
    ImmutableNetwork<DiTrackNode, DiTrackEdge> getDiTrackGraph();

    /** Returns the DiTrackEdge matching the TrackSection with the given ID, throws if it can't be found.
     * Returns the edge going the same way as the TrackInfra if dir == Forward, otherwise the opposite. */
    DiTrackEdge getEdge(String id, Direction direction);

    /** Returns the DiTrackEdge matching the given edge, throws if it can't be found.
     * Returns the edge going the same way if dir == Forward, otherwise the opposite. */
    DiTrackEdge getEdge(TrackEdge edge, Direction direction);
}
