package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.train.PathAttrIterator;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.utils.DoubleOrientedRangeSequence;
import fr.sncf.osrd.utils.RangeValue;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;


public class RangeAttrIter {
    @Test
    @SuppressWarnings("VariableDeclarationUsageDistance")
    @SuppressFBWarnings({"DLS_DEAD_LOCAL_STORE"})
    public void backwardRangeAttrIter() throws InvalidInfraException {
        // build a test infrastructure
        var infraBuilder = new Infra.Builder();

        var nodeA = infraBuilder.trackGraph.makePlaceholderNode("A");
        var nodeB = infraBuilder.trackGraph.makePlaceholderNode("B");
        var nodeC = infraBuilder.trackGraph.makePlaceholderNode("C");

        var forwardEdge = infraBuilder.trackGraph.makeTrackSection(
                nodeA.index,
                nodeB.index,
                "e1", 42
        );

        var backwardEdge = infraBuilder.trackGraph.makeTrackSection(
                nodeC.index,
                nodeB.index,
                "e2", 50
        );

        /*
                start                                   stop
            0     5                 42                   84        92  <= path offsets
            +=======================+==============================+
            0        10     30    42|50  41    20        8         0   <= edge offsets

                                               ----------+ 5
                                         ------+ 4
                                  --|----+ 3
                          2 +-------|--
                   1 +-------
          0 +---------
         */

        {
            var builder = forwardEdge.slope.builder();
            builder.add(0, 10, 0.);
            builder.add(10, 30, 1.);
            builder.add(30., 42, 2.);
            // // this fails at infra prepare() time
            // builder.add(42.0, -3.);
            // builder.add(60.0, -4.);
            builder.build();
        }

        {
            var builder = backwardEdge.slope.builder();
            builder.add(0., 8, 6.);
            builder.add(8., 20, -5.);
            builder.add(20, 41, -4.);
            builder.add(41.0, 50, -3.);
            // // this fails at infra prepare() time
            // builder.add(51.0, -5.);
            builder.build();
        }

        final var infra = infraBuilder.build();

        var trainPath = new TrainPath();
        trainPath.addEdge(forwardEdge, EdgeDirection.START_TO_STOP, 0, Double.POSITIVE_INFINITY);
        trainPath.addEdge(backwardEdge, EdgeDirection.STOP_TO_START, Double.NEGATIVE_INFINITY, backwardEdge.length);

        List<RangeValue<Double>> result = PathAttrIterator.streamRanges(
                trainPath,
                0,
                5.,
                84.,
                TrackSection::getSlope)
                .collect(Collectors.toList());

        var expected = new ArrayList<RangeValue<Double>>();
        expected.add(new RangeValue<>(5., 10., 0.));
        expected.add(new RangeValue<>(10., 30., 1.));
        expected.add(new RangeValue<>(30., 42., 2.));
        expected.add(new RangeValue<>(42., 51., 3.));
        expected.add(new RangeValue<>(51., 72., 4.));
        expected.add(new RangeValue<>(72., 84., 5.));

        assertEquals(expected.size(), result.size(), "invalid number of entries");
        for (int i = 0; i < result.size(); i++) {
            var expectedRange = expected.get(i);
            var resultRange = result.get(i);
            assertEquals(expectedRange, resultRange);
        }
    }

    @Test
    public void doubleOrientedRangeSeqForwardIteration() throws InvalidInfraException {
        var seq = new DoubleOrientedRangeSequence();
        {
            var builder = seq.builder();
            builder.add(1, 10, 42.0);
            builder.add(10, 20, 84.0);
            builder.build();
        }

        var forwardRes = new ArrayList<RangeValue<Double>>();
        seq.iterate(
                EdgeDirection.START_TO_STOP,
                2.0,
                18.0,
                v -> v + 100
        ).forEachRemaining(forwardRes::add);

        assertEquals(2, forwardRes.size());
        assertEquals(new RangeValue<>(102.0, 110.0, 42.0), forwardRes.get(0));
        assertEquals(new RangeValue<>(110.0, 118.0, 84.0), forwardRes.get(1));
    }

    @Test
    public void doubleOrientedRangeSeqBackwardIteration() throws InvalidInfraException {
        var seq = new DoubleOrientedRangeSequence();
        {
            var builder = seq.builder();
            builder.add(1, 10, 42.0);
            builder.add(10, 20, 84.0);
            builder.build();
        }

        var forwardRes = new ArrayList<RangeValue<Double>>();
        seq.iterate(
                EdgeDirection.STOP_TO_START,
                18.0,
                2.0,
                v -> v + 100
        ).forEachRemaining(forwardRes::add);

        assertEquals(2, forwardRes.size());
        assertEquals(new RangeValue<>(118.0, 110.0, -84.0), forwardRes.get(0));
        assertEquals(new RangeValue<>(110.0, 102.0, -42.0), forwardRes.get(1));
    }
}
