package fr.sncf.osrd.infra.detectorgraph;

import java.util.Objects;

/**
 * Used to identified a TVDSectionPath.
 * The attributes startNode will always be smaller than endNode.
 */
public final class TVDSectionPathID {
    public final int startNode;
    public final int endNode;

    private TVDSectionPathID(int startNode, int endNode) {
        this.startNode = startNode;
        this.endNode = endNode;
    }

    /**
     * Instantiate a new TVDSectionPathID making sure of attribute order
     */
    public static TVDSectionPathID build(int nodeA, int nodeB) {
        if (nodeA < nodeB)
            return new TVDSectionPathID(nodeA, nodeB);
        return new TVDSectionPathID(nodeB, nodeA);
    }

    @Override
    public int hashCode() {
        return Objects.hash(startNode, endNode);
    }

    @Override
    public boolean equals(Object obj) {
        if (!(obj instanceof TVDSectionPathID))
            return false;
        var other = (TVDSectionPathID) obj;
        return this.startNode == other.startNode && this.endNode == other.endNode;
    }
}
