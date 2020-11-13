package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.HashMap;

/**
 * A data structure meant to store the immutable part of a railroad infrastructure.
 * It's meant to be built as follows:
 *  - The topological nodes as registered first
 *  - The topological edges are registered with the node, and with the infrastructure
 *  - Section signals are registered
 *  - block sections are registered
 *  - external track attributes are computed
 *  - line and tracks are created and registered
 */
public class Infra {
    /**
     * The topology graph.
     * Each TopoEdge contains a reference to a Track,
     * which stores most of the data in SortedSequences.
     */
    public final ArrayList<TopoNode> topoNodes = new ArrayList<>();
    public final ArrayList<TopoEdge> topoEdges = new ArrayList<>();

    /**
     * The block sections graph.
     * A block section may span multiple topological edges, and thus be on multiple lines.
     * Each block section has a StairSequence of the edges it spans over.
     */
    public final ArrayList<SectionSignalNode> sectionSignals = new ArrayList<>();
    public final ArrayList<BlockSection> blockSections = new ArrayList<>();

    public final HashMap<String, Line> lines = new HashMap<>();

    void register(TopoNode node) {
        node.setIndex(topoNodes.size());
        topoNodes.add(node);
    }

    void register(TopoEdge edge) {
        edge.setIndex(topoEdges.size());
        topoEdges.add(edge);
    }

    void register(SectionSignalNode node) {
        node.setIndex(sectionSignals.size());
        sectionSignals.add(node);
    }

    void register(BlockSection edge) {
        edge.setIndex(blockSections.size());
        blockSections.add(edge);
    }

    /**
     * Registers a new line into the infrastructure, throwing an exception
     * if another line with the same name is already registered.
     */
    public void register(Line line) throws DataIntegrityException {
        var previousValue = lines.putIfAbsent(line.name, line);
        if (previousValue != null)
            throw new DataIntegrityException(String.format("Duplicate line %s", line.name));
    }
}
