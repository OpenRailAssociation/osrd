package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertLinesMatch;

import fr.sncf.osrd.infra.*;
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
        var line = infra.makeLine("test line", "1");
        var testTrack = Track.createAndRegister(line, "1", "test track");

        var nodeA = infra.makeNoOpNode("A");
        var nodeB = infra.makeNoOpNode("B");
        var nodeC = infra.makeNoOpNode("C");

        final var firstEdge = infra.makeTopoLink(
                nodeA, nodeA::addEdge,
                nodeB, nodeB::addEdge,
                0, 42,
                testTrack, "e1", 42.0);

        final var secondEdge = infra.makeTopoLink(
                nodeB, nodeB::addEdge,
                nodeC, nodeC::addEdge,
                42.0, 42 * 2,
                testTrack, "e2", 42.0);

        var builder = testTrack.attributes.operationalPoints.builder();
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
                TrackAttrs::getOperationalPoints)
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
        var line = infra.makeLine("test line", "1");
        var forwardTrack = Track.createAndRegister(line, "1", "test track");
        var backwardTrack = Track.createAndRegister(line, "2", "backward track");

        var nodeA = infra.makeNoOpNode("A");
        var nodeB = infra.makeNoOpNode("B");
        var nodeC = infra.makeNoOpNode("C");

        var forwardEdge = infra.makeTopoLink(
                nodeA, nodeA::addEdge,
                nodeB, nodeB::addEdge,
                0, 42,
                forwardTrack, "e1", 42.0);

        var backwardEdge = infra.makeTopoLink(
                nodeC, nodeC::addEdge,
                nodeB, nodeB::addEdge,
                0, 50,
                backwardTrack, "e2", 50);

        {
            var builder = forwardTrack.attributes.operationalPoints.builder();
            builder.add(0, new OperationalPoint("skipped", "skipped"));
            builder.add(10, new OperationalPoint("1", "1"));
            builder.add(42.0, new OperationalPoint("2a", "2a"));
            builder.add(42.0, new OperationalPoint("2b", "2b"));
            builder.add(60.0, new OperationalPoint("oob", "oob"));
            builder.build();
        }

        {
            var builder = backwardTrack.attributes.operationalPoints.builder();
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
                TrackAttrs::getOperationalPoints)
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
