package fr.sncf.osrd.utils.graph;

public class AbstractEdge {
    public final int index;

    public final double length;

    public AbstractEdge(int index, double length) {
        this.index = index;
        this.length = length;
    }
}
