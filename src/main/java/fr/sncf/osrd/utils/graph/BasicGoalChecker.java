package fr.sncf.osrd.utils.graph;

import fr.sncf.osrd.utils.graph.path.BasicPathChainEnd;
import fr.sncf.osrd.utils.graph.path.BasicPathChainStart;
import fr.sncf.osrd.utils.graph.path.PathChainNode;

public class BasicGoalChecker<EdgeT extends Edge> implements BiGraphDijkstra.GoalChecker<
        EdgeT,
        BasicPathChainStart<EdgeT>,
        BasicPathChainEnd<EdgeT>
        > {

    public final CostFunction<EdgeT> costFunction;
    public final EdgeT goalEdge;
    public final double goalPosition;

    /** Creates a pathfinding goal checker for single point goals with basic path chain nodes */
    public BasicGoalChecker(CostFunction<EdgeT> costFunction, EdgeT goalEdge, double goalPosition) {
        this.costFunction = costFunction;
        this.goalEdge = goalEdge;
        this.goalPosition = goalPosition;
    }

    @Override
    public BasicPathChainEnd<EdgeT> findGoalOnPathEdge(
            PathChainNode<EdgeT, BasicPathChainStart<EdgeT>, BasicPathChainEnd<EdgeT>> pathNode
    ) {
        if (!pathNode.isEdgePositionAhead(goalEdge, goalPosition))
            return null;

        var addedCost = costFunction.evaluate(goalEdge, pathNode.position, goalPosition);
        return new BasicPathChainEnd<>(addedCost, goalEdge, pathNode.direction, goalPosition, pathNode);
    }
}
