package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertLinesMatch;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.train.PathAttrIterator;
import fr.sncf.osrd.train.TrainPath;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.stream.Collectors;

class PointAttrIter {
    @Test
    @SuppressWarnings("VariableDeclarationUsageDistance")
    public void simplePointAttrIter() throws InvalidInfraException {
        // build a test infrastructure
        var infra = new Infra();

        var nodeA = infra.makeNoOpNode("A");
        var nodeB = infra.makeNoOpNode("B");
        var nodeC = infra.makeNoOpNode("C");

        final var firstEdge = infra.makeTopoEdge(
                nodeA.getIndex(),
                nodeB.getIndex(),
                "e1", 42
        );

        final var secondEdge = infra.makeTopoEdge(
                nodeB.getIndex(),
                nodeC.getIndex(),
                "e2", 42
        );

        // these two points are on both edges
        var common2a = new OperationalPoint("2a", "2a");
        var common2b = new OperationalPoint("2b", "2b");

        // add attributes on the first edge
        {
            var builder = firstEdge.operationalPoints.builder();
            builder.add(0, new OperationalPoint("skipped", "skipped"));
            builder.add(10, new OperationalPoint("1", "1"));
            builder.add(42.0, common2a);
            builder.add(42.0, common2b);
            builder.build();
        }

        // add attributes on the second edge
        {
            var builder = secondEdge.operationalPoints.builder();
            builder.add(42.0 - 42.0, common2a);
            builder.add(42.0 - 42.0, common2b);
            builder.add(60.0 - 42.0, new OperationalPoint("3", "3"));
            builder.build();
        }
        infra.prepare();

        var trainPath = new TrainPath();
        trainPath.addEdge(firstEdge, EdgeDirection.START_TO_STOP, 0, Double.POSITIVE_INFINITY);
        trainPath.addEdge(secondEdge, EdgeDirection.START_TO_STOP, Double.NEGATIVE_INFINITY, secondEdge.length);

        var fullResult = PathAttrIterator.streamPoints(
                trainPath,
                0,
                5.,
                84.,
                TopoEdge::getOperationalPoints)
                .collect(Collectors.toList());

        var result = fullResult.stream()
                .map(e -> e.value.name)
                .collect(Collectors.toList());

        var expected = new ArrayList<String>();
        expected.add("1");
        expected.add("2a");
        expected.add("2b");
        expected.add("3");

        assertLinesMatch(expected, result);
    }

    @Test
    @SuppressWarnings("VariableDeclarationUsageDistance")
    public void backwardPointAttrIter() throws InvalidInfraException {
        // build a test infrastructure
        var infra = new Infra();

        var nodeA = infra.makeNoOpNode("A");
        var nodeB = infra.makeNoOpNode("B");
        var nodeC = infra.makeNoOpNode("C");

        var forwardEdge = infra.makeTopoEdge(
                nodeA.getIndex(),
                nodeB.getIndex(),
                "e1", 42);

        var backwardEdge = infra.makeTopoEdge(
                nodeC.getIndex(),
                nodeB.getIndex(),
                "e2", 50);

        {
            var builder = forwardEdge.operationalPoints.builder();
            builder.add(0, new OperationalPoint("skipped", "skipped"));
            builder.add(10, new OperationalPoint("1", "1"));
            builder.add(42.0, new OperationalPoint("2a", "2a"));
            builder.add(42.0, new OperationalPoint("2b", "2b"));
            builder.build();
        }

        {
            var builder = backwardEdge.operationalPoints.builder();
            builder.add(0, new OperationalPoint("oob", "oob"));
            builder.add(20, new OperationalPoint("4", "4"));
            builder.add(42.0, new OperationalPoint("3a", "3b"));
            builder.add(42.0, new OperationalPoint("3a", "3a"));
            builder.build();
        }

        infra.prepare();

        var trainPath = new TrainPath();
        trainPath.addEdge(forwardEdge, EdgeDirection.START_TO_STOP, 0, Double.POSITIVE_INFINITY);
        trainPath.addEdge(backwardEdge, EdgeDirection.STOP_TO_START, Double.NEGATIVE_INFINITY, backwardEdge.length);

        var result = PathAttrIterator.streamPoints(
                trainPath,
                0,
                5.,
                84.,
                TopoEdge::getOperationalPoints)
                .map(e -> e.value.name)
                .collect(Collectors.toList());

        var expected = new ArrayList<String>();
        expected.add("1");
        expected.add("2a");
        expected.add("2b");
        expected.add("3a");
        expected.add("3b");
        expected.add("4");

        assertLinesMatch(expected, result);
    }
}
