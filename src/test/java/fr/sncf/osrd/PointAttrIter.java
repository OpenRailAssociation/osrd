package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertLinesMatch;

import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.branching.BranchAttrs;
import fr.sncf.osrd.infra.graph.EdgeDirection;
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
        var testBranch = infra.makeBranch("1", "test branch");

        var nodeA = infra.makeNoOpNode("A");
        var nodeB = infra.makeNoOpNode("B");
        var nodeC = infra.makeNoOpNode("C");

        final var firstEdge = infra.makeTopoLink(
                nodeA, nodeA::addEdge,
                nodeB, nodeB::addEdge,
                "e1", 42,
                testBranch, 0, 42.0
        );

        final var secondEdge = infra.makeTopoLink(
                nodeB, nodeB::addEdge,
                nodeC, nodeC::addEdge,
                "e2", 42.0,
                testBranch, 42.0, 42 * 2
        );

        var builder = testBranch.attributes.operationalPoints.builder();
        builder.add(0, new OperationalPoint("skipped", "skipped"));
        builder.add(10, new OperationalPoint("1", "1"));
        builder.add(42.0, new OperationalPoint("2a", "2a"));
        builder.add(42.0, new OperationalPoint("2b", "2b"));
        builder.add(60.0, new OperationalPoint("3", "3"));
        builder.add(1000, new OperationalPoint("oob", "oob"));
        builder.build();
        infra.prepare();

        var trainPath = new TrainPath();
        trainPath.addEdge(firstEdge, EdgeDirection.START_TO_STOP);
        trainPath.addEdge(secondEdge, EdgeDirection.START_TO_STOP);

        var result = PathAttrIterator.streamPoints(
                infra,
                trainPath,
                0,
                5.,
                84.,
                BranchAttrs::getOperationalPoints)
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
        var forwardBranch = infra.makeBranch("1", "test branch");
        var backwardBranch = infra.makeBranch("2", "backward branch");

        var nodeA = infra.makeNoOpNode("A");
        var nodeB = infra.makeNoOpNode("B");
        var nodeC = infra.makeNoOpNode("C");

        var forwardEdge = infra.makeTopoLink(
                nodeA, nodeA::addEdge,
                nodeB, nodeB::addEdge,
                "e1", 42,
                forwardBranch, 0, 42.0);

        var backwardEdge = infra.makeTopoLink(
                nodeC, nodeC::addEdge,
                nodeB, nodeB::addEdge,
                "e2", 50,
                backwardBranch, 0, 50);

        {
            var builder = forwardBranch.attributes.operationalPoints.builder();
            builder.add(0, new OperationalPoint("skipped", "skipped"));
            builder.add(10, new OperationalPoint("1", "1"));
            builder.add(42.0, new OperationalPoint("2a", "2a"));
            builder.add(42.0, new OperationalPoint("2b", "2b"));
            builder.add(60.0, new OperationalPoint("oob", "oob"));
            builder.build();
        }

        {
            var builder = backwardBranch.attributes.operationalPoints.builder();
            builder.add(0, new OperationalPoint("oob", "oob"));
            builder.add(20, new OperationalPoint("4", "4"));
            builder.add(42.0, new OperationalPoint("3a", "3b"));
            builder.add(42.0, new OperationalPoint("3a", "3a"));
            builder.add(60.0, new OperationalPoint("oob", "oob"));
            builder.build();
        }

        infra.prepare();

        var trainPath = new TrainPath();
        trainPath.addEdge(forwardEdge, EdgeDirection.START_TO_STOP);
        trainPath.addEdge(backwardEdge, EdgeDirection.STOP_TO_START);

        var result = PathAttrIterator.streamPoints(
                infra,
                trainPath,
                0,
                5.,
                84.,
                BranchAttrs::getOperationalPoints)
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
