package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.train.PathAttrIterator;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.util.RangeValue;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;


public class RangeAttrIter {
    @Test
    @SuppressWarnings("VariableDeclarationUsageDistance")
    public void backwardRangeAttrIter() throws InvalidInfraException {
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

        /*
                start                                   stop
            0     5                 42                   84        92  <= path offsets
            +=======================+==============================+
            0        10     30    42|50  41    20        8         0   <= track offsets

                                               ----------+ 5
                                         ------+ 4
                                  --|----+ 3
                          2 +-------|--
                   1 +-------
          0 +---------
         */

        {
            var builder = forwardTrack.attributes.slope.builder();
            builder.add(0, 0.);
            builder.add(10, 1.);
            builder.add(30., 2.);
            builder.add(42.0, -3.);
            builder.add(60.0, -4.);
            builder.build();
        }

        {
            var builder = backwardTrack.attributes.slope.builder();
            builder.add(0., -6.);
            builder.add(8., 5.);
            builder.add(20, 4.);
            builder.add(41.0, 3.);
            builder.add(51.0, -5.);
            builder.build();
        }

        infra.prepare();

        var trainPath = new TrainPath();
        trainPath.addEdge(forwardEdge, EdgeDirection.START_TO_STOP);
        trainPath.addEdge(backwardEdge, EdgeDirection.STOP_TO_START);

        List<RangeValue<Double>> result = PathAttrIterator.streamRanges(
                infra,
                trainPath,
                0,
                5.,
                84.,
                TrackAttrs::getSlope)
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
            assertEquals(
                    expectedRange.value, resultRange.value,
                    String.format("range value differs at index %d", i)
            );

            assertEquals(
                    expectedRange.start, resultRange.start, 0.0001f,
                    String.format("range start differs at index %d", i)
            );

            assertEquals(
                    expectedRange.end, resultRange.end, 0.0001f,
                    String.format("range end differs at index %d", i)
            );
        }
    }
}
