package fr.sncf.osrd.api.pathfinding.constraints;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.Range;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.NeutralSection;
import fr.sncf.osrd.stdcm.DummyRouteGraphBuilder;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.List;
import java.util.stream.Stream;

public class ElectrificationConstraintsTest {
    static Stream<Arguments> testNeutralSectionArgs() {
        var fullCatenaryRanges = List.of(Range.closed(0., 1000.));
        var partialCatenaryRanges = List.of(Range.closed(0., 100.), Range.closed(900., 1000.));
        var noCatenaryRanges = List.of();
        return Stream.of(
                // Catenary ranges, with neutral section, neutral section direction
                Arguments.of(fullCatenaryRanges, true, Direction.FORWARD),
                Arguments.of(fullCatenaryRanges, true, Direction.BACKWARD),
                Arguments.of(fullCatenaryRanges, false, null),
                Arguments.of(partialCatenaryRanges, true, Direction.FORWARD),
                Arguments.of(partialCatenaryRanges, true, Direction.BACKWARD),
                Arguments.of(partialCatenaryRanges, false, null),
                Arguments.of(noCatenaryRanges, true, Direction.FORWARD),
                Arguments.of(noCatenaryRanges, false, null)
        );
    }

    @ParameterizedTest
    @MethodSource("testNeutralSectionArgs")
    public void testNeutralSectionAndCatenaryBlockingRanges(List<Range<Double>> catenaryRanges,
                                                            boolean withNeutralSection,
                                                            Direction neutralSectionDirection) {

        var route = new DummyRouteGraphBuilder.DummyRoute("route", 1000, null, null, null);

        assert TestTrains.FAST_ELECTRIC_TRAIN.getModeNames().contains("25000");
        var catenaryLength = 0.;
        for (var catenaryRange : catenaryRanges) {
            route.getTrackRanges().get(0).track.getEdge().getVoltages().put(catenaryRange, "25000");
            catenaryLength += catenaryRange.upperEndpoint() - catenaryRange.lowerEndpoint();
        }

        if (withNeutralSection) {
            var neutralSections = route.getTrackRanges().get(0).track.getEdge().getNeutralSections(
                    neutralSectionDirection);
            neutralSections.put(Range.closedOpen(100., 950.), new NeutralSection(false));
        }

        var blockedRanges = new ElectrificationConstraints(List.of(TestTrains.FAST_ELECTRIC_TRAIN)).apply(route);

        if (catenaryLength > 900) {
            assertEquals(0, blockedRanges.size());
        } else if (catenaryLength > 100) {
            if (withNeutralSection && neutralSectionDirection == Direction.FORWARD) {
                assertEquals(0, blockedRanges.size());
            } else {
                assertEquals(1, blockedRanges.size());
                assertTrue(blockedRanges.contains(new Pathfinding.Range(100., 900.)));
            }
        } else {
            if (withNeutralSection && neutralSectionDirection == Direction.FORWARD) {
                assertEquals(2, blockedRanges.size());
                assertTrue(blockedRanges.contains(new Pathfinding.Range(0., 100.)));
                assertTrue(blockedRanges.contains(new Pathfinding.Range(950., 1000.)));
            } else {
                assertEquals(1, blockedRanges.size());
                assertTrue(blockedRanges.contains(new Pathfinding.Range(0., 1000.)));
            }
        }
    }
}
