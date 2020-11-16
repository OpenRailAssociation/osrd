package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.TopoEdge;

import java.util.ArrayDeque;

public class TrainPositionTracker {
    private final TrainPath path;
    private final double trainLength;

    private final ArrayDeque<TopoEdge> currentEdges = new ArrayDeque<>();
    private int currentPathIndex = 0;

    // we only track the head's position, as the tail's position can be computed from the current edges and head
    // position
    private double headEdgePosition;

    public TrainPositionTracker(TrainPath path, double trainLength) {
        this.path = path;
        this.trainLength = trainLength;
    }

    public void updatePosition(double speed, double deltaTime) {
        headEdgePosition += speed * deltaTime;
        while (currentEdges.getFirst().length >= headEdgePosition) {
            headEdgePosition -= currentEdges.getFirst().length;
            ++currentPathIndex;
            currentEdges.addFirst(path.edges.get(currentPathIndex));
        }
        while (currentEdges.stream().mapToDouble(edge -> edge.length).sum() - headEdgePosition >= trainLength) {
            currentEdges.removeLast();
        }
    }
}
