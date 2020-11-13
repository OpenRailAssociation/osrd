package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.HashMap;

public class Infra {
    /**
     * The topology graph.
     *
     * Each TopoEdge contains a reference to a Track,
     * which stores most of the data in SortedSequences.
     */
    public final ArrayList<TopoNode> topoNodes = new ArrayList<>();
    public final ArrayList<TopoEdge> topoEdges = new ArrayList<>();

    /**
     * The block sections graph.
     *
     * A block section may span multiple topological edges, and thus be on multiple lines.
     * Each block section has a StairSequence of the edges it spans over.
     */
    public final ArrayList<SectionSignalNode> sectionSignals = new ArrayList<>();
    public final ArrayList<BlockSection> blockSections = new ArrayList<>();

    public final HashMap<String, Line> lines = new HashMap<>();

    public void register(TopoNode node) {
        node.setIndex(topoNodes.size());
        topoNodes.add(node);
    }

    public void register(TopoEdge edge) {
        edge.setIndex(topoEdges.size());
        topoEdges.add(edge);
    }

    public void register(SectionSignalNode node) {
        node.setIndex(sectionSignals.size());
        sectionSignals.add(node);
    }

    public void register(BlockSection edge) {
        edge.setIndex(blockSections.size());
        blockSections.add(edge);
    }

    public void register(Line line) throws DataIntegrityException {
        var previousValue = lines.putIfAbsent(line.name, line);
        if (previousValue != null)
            throw new DataIntegrityException(String.format("Duplicate line %s", line.name));
    }
}
