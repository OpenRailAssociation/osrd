package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertLinesMatch;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.train.PathAttrIterator;
import fr.sncf.osrd.train.TrainPath;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.stream.Collectors;

class PointAttrIter {
    /* TODO: adapt these tests to use slopes instead of operationalPoints.

    @Test
    @SuppressWarnings("VariableDeclarationUsageDistance")
    @SuppressFBWarnings({"DLS_DEAD_LOCAL_STORE"})
    public void simplePointAttrIter() throws InvalidInfraException {
        // build a test infrastructure
        var infraBuilder = new Infra.Builder();

        var nodeA = infraBuilder.makePlaceholderNode("A");
        var nodeB = infraBuilder.makePlaceholderNode("B");
        var nodeC = infraBuilder.makePlaceholderNode("C");

        final var firstEdge = infraBuilder.makeTrackSection(
                nodeA.getIndex(),
                nodeB.getIndex(),
                "e1", 42
        );

        final var secondEdge = infraBuilder.makeTrackSection(
                nodeB.getIndex(),
                nodeC.getIndex(),
                "e2", 42
        );

        // these two points are on both edges
        var common2a = infraBuilder.makeOperationalPoint("2a");
        var common2b = infraBuilder.makeOperationalPoint("2b");

        // add attributes on the first edge
        infraBuilder.makeOperationalPoint("skipped").addRef(firstEdge, 0, 0);
        infraBuilder.makeOperationalPoint("1").addRef(firstEdge, 10, 10);
        common2a.addRef(firstEdge, 42.0, 42.0);
        common2b.addRef(firstEdge, 42.0, 42.0);

        // add attributes on the second edge
        {
            var builder = secondEdge.operationalPoints.builder();
            builder.add(42.0 - 42.0, common2a);
            builder.add(42.0 - 42.0, common2b);
            builder.add(60.0 - 42.0, new RMLOperationalPoint("3"));
            builder.build();
        }

        final var infra = infraBuilder.build();

        var trainPath = new TrainPath();
        trainPath.addEdge(firstEdge, EdgeDirection.START_TO_STOP, 0, Double.POSITIVE_INFINITY);
        trainPath.addEdge(secondEdge, EdgeDirection.START_TO_STOP, Double.NEGATIVE_INFINITY, secondEdge.length);

        var fullResult = PathAttrIterator.streamPoints(
                trainPath,
                0,
                5.,
                84.,
                TrackSection::getOperationalPoints)
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
    @SuppressFBWarnings({"DLS_DEAD_LOCAL_STORE"})
    public void backwardPointAttrIter() throws InvalidInfraException {
        // build a test infrastructure
        var infraBuilder = new Infra.Builder();

        var nodeA = infraBuilder.makePlaceholderNode("A");
        var nodeB = infraBuilder.makePlaceholderNode("B");
        var nodeC = infraBuilder.makePlaceholderNode("C");

        var forwardEdge = infraBuilder.makeTrackSection(
                nodeA.getIndex(),
                nodeB.getIndex(),
                "e1", 42);

        var backwardEdge = infraBuilder.makeTrackSection(
                nodeC.getIndex(),
                nodeB.getIndex(),
                "e2", 50);

        {
            var builder = forwardEdge.operationalPoints.builder();
            builder.add(0, infraBuilder.makeOperationalPoint("skipped"));
            builder.add(10, infraBuilder.makeOperationalPoint("1"));
            builder.add(42.0, infraBuilder.makeOperationalPoint("2a"));
            builder.add(42.0, infraBuilder.makeOperationalPoint("2b");
            builder.build();
        }

        {
            var builder = backwardEdge.operationalPoints.builder();
            builder.add(0, infraBuilder.makeOperationalPoint("oob"));
            builder.add(20, infraBuilder.makeOperationalPoint("4"));
            builder.add(42.0, infraBuilder.makeOperationalPoint("3a"));
            builder.add(42.0, infraBuilder.makeOperationalPoint("3a"));
            builder.build();
        }

        final var infra = infraBuilder.build();

        var trainPath = new TrainPath();
        trainPath.addEdge(forwardEdge, EdgeDirection.START_TO_STOP, 0, Double.POSITIVE_INFINITY);
        trainPath.addEdge(backwardEdge, EdgeDirection.STOP_TO_START, Double.NEGATIVE_INFINITY, backwardEdge.length);

        var result = PathAttrIterator.streamPoints(
                trainPath,
                0,
                5.,
                84.,
                TrackSection::getOperationalPoints)
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
     */
}
