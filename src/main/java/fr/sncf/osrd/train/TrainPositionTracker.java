package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.topological.TopoEdge;

import java.util.ArrayDeque;

public class TrainPositionTracker {
    /** The planned path the train shall follow. */
    private final TrainPath path;

    /** The index of the edge the head of the train currently is at. */
    private int currentPathIndex = 0;

    /** The length of the train, in meters. */
    private final double trainLength;

    /** The list of edges the train currently spans over. */
    private final ArrayDeque<TopoEdge> currentEdges = new ArrayDeque<>();

    /* This code only track the position of the head, as the tail's can be computed
     from the list of edges the train currently spans over, and the position of
     the head on the head edge. */
    private double headEdgePosition;

    public TrainPositionTracker(TrainPath path, double trainLength) {
        this.path = path;
        this.trainLength = trainLength;
    }

    private TopoEdge headEdge() {
        return currentEdges.getFirst();
    }

    private TopoEdge nextPathEdge() {
        ++currentPathIndex;
        return path.edges.get(currentPathIndex).edge;
    }

    private boolean hasNextPathEdge() {
        return currentPathIndex < path.edges.size() - 1;
    }

    /**
     * Updates the position of the train on the network
     * @param speed The current speed of the train, in meters per second
     * @param deltaTime The elapsed time, in seconds
     */
    public void updatePosition(double speed, double deltaTime) {
        headEdgePosition += speed * deltaTime;

        // add edges to the current edges queue as the train moves forward
        while (hasNextPathEdge()) {
            var headEdgeLength = headEdge().length;
            // stop adding edges when the head position lies inside the current head edge
            if (headEdgeLength < headEdgePosition)
                break;

            // add the next edge on the path to the current edges queue
            currentEdges.addFirst(nextPathEdge());

            // as the head edge changed, so does the position
            headEdgePosition -= headEdgeLength;
        }

        // remove edges off the tail as the train leaves those
        //
        //   removable           train
        //                   ===========>
        // +------------+-----------+---------+
        //                   ^          ^
        //                  tail        head
        // \__________________________________/
        //          total edges span
        // \____________/\____________________/
        //  tail edge len    next edges span
        //               \_____________/\_____/
        //          new available space     `head edge headroom

        var headEdgeHeadroom = headEdge().length - headEdgePosition;
        assert headEdgeHeadroom > 0.;
        while (currentEdges.size() > 1) {
            var tailEdgeLength = currentEdges.getLast().length;
            var totalEdgesSpan = currentEdges.stream().mapToDouble(edge -> edge.length).sum();
            var nextEdgesSpan = totalEdgesSpan - tailEdgeLength;
            var newAvailableSpace = nextEdgesSpan - headEdgeHeadroom;
            if (newAvailableSpace < trainLength)
                break;

            currentEdges.removeLast();
        }
    }
}
