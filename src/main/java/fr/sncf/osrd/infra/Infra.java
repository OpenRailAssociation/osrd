package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.HashMap;

public class Infra {
    public final ArrayList<TopoNode> topoNodes = new ArrayList<>();
    public final ArrayList<TopoEdge> topoEdges = new ArrayList<>();
    public final HashMap<String, Line> lines = new HashMap<>();

    public void register(TopoEdge edge) {
        edge.setIndex(topoEdges.size());
        topoEdges.add(edge);
    }

    public void register(TopoNode node) {
        node.setIndex(topoNodes.size());
        topoNodes.add(node);
    }

    public void register(Line line) {
        var previousValue = lines.putIfAbsent(line.name, line);
        if (previousValue != null)
            throw new RuntimeException(String.format("Duplicate line %s", line.name));
    }
}
