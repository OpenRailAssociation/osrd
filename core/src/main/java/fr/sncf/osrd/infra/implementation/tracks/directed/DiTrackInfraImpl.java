package fr.sncf.osrd.infra.implementation.tracks.directed;

import com.google.common.collect.ImmutableListMultimap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackNode;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.infra.implementation.tracks.undirected.TrackInfraImpl;

public class DiTrackInfraImpl extends TrackInfraImpl implements DiTrackInfra {

    private final ImmutableNetwork<DiTrackNode, DiTrackEdge> graph;
    private final ImmutableMultimap<TrackEdge, DiTrackEdge> trackEdgesToDiTrackEdges;

    protected DiTrackInfraImpl(TrackInfra trackInfra, ImmutableNetwork<DiTrackNode, DiTrackEdge> graph) {
        super(
                trackInfra.getSwitches(),
                trackInfra.getTrackGraph(),
                makeTrackSections(trackInfra.getTrackGraph()),
                trackInfra.getDetectorMap()
        );
        this.graph = graph;
        var builder = ImmutableListMultimap.<TrackEdge, DiTrackEdge>builder();
        for (var edge : graph.edges())
            builder.put(edge.getEdge(), edge);
        trackEdgesToDiTrackEdges = builder.build();
    }

    @Override
    public ImmutableNetwork<DiTrackNode, DiTrackEdge> getDiTrackGraph() {
        return graph;
    }

    @Override
    public DiTrackEdge getEdge(String id, Direction direction) {
        return getEdge(getTrackSection(id), direction);
    }

    @Override
    public DiTrackEdge getEdge(TrackEdge edge, Direction direction) {
        for (var diEdge : trackEdgesToDiTrackEdges.get(edge))
            if (diEdge.getDirection() == direction)
                return diEdge;
        return null;
    }
}
