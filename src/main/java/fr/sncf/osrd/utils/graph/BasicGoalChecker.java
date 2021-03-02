package fr.sncf.osrd.utils.graph;

import fr.sncf.osrd.utils.graph.path.BasicPathEnd;
import fr.sncf.osrd.utils.graph.path.BasicPathStart;
import fr.sncf.osrd.utils.graph.path.PathNode;

public class BasicGoalChecker<EdgeT extends Edge> implements BiGraphDijkstra.GoalChecker<
        EdgeT,
        BasicPathStart<EdgeT>,
        BasicPathEnd<EdgeT>
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
    public BasicPathEnd<EdgeT> findGoalOnPathEdge(
            PathNode<EdgeT, BasicPathStart<EdgeT>, BasicPathEnd<EdgeT>> pathNode
    ) {
        if (!pathNode.isEdgePositionAhead(goalEdge, goalPosition))
            return null;

        var addedCost = costFunction.evaluate(goalEdge, pathNode.position, goalPosition);
        return new BasicPathEnd<>(addedCost, goalEdge, pathNode.direction, goalPosition, pathNode);
    }
}
