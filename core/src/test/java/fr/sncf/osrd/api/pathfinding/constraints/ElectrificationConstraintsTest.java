package fr.sncf.osrd.api.pathfinding.constraints;

import static fr.sncf.osrd.Helpers.getSmallInfra;
import static org.assertj.core.api.AssertionsForClassTypes.assertThat;

import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class ElectrificationConstraintsTest {

    private ElectrificationConstraints electrificationConstraints;
    private double chunk0Length;
    private double chunk1Length;

    @BeforeAll
    public void setUp() {
        var infra = getSmallInfra();
        electrificationConstraints = new ElectrificationConstraints(infra.blockInfra(), infra.rawInfra(),
                List.of(TestTrains.FAST_ELECTRIC_TRAIN));

        chunk0Length = infra.rawInfra().getTrackChunkLength(0);
        chunk1Length = infra.rawInfra().getTrackChunkLength(1);
    }

    @ParameterizedTest
    @MethodSource("testDeadSectionArgs")
    public void testDeadSectionAndCatenaryBlockedRanges(int blockId,
                                                        Collection<Pathfinding.Range> expectedBlockedRanges) {
        var blockedRanges = electrificationConstraints.apply(blockId);
        assertThat(blockedRanges).isEqualTo(expectedBlockedRanges);
    }

    Stream<Arguments> testDeadSectionArgs() {
        return Stream.of(
                // Partially corresponding catenary ranges with dead section
                Arguments.of(0,
                        Set.of(new Pathfinding.Range(0., 80000.), new Pathfinding.Range(130000., chunk1Length))),
                // No corresponding catenary ranges without dead sections
                Arguments.of(1, Set.of(new Pathfinding.Range(0., chunk0Length))),
                // Fully corresponding catenary ranges without dead sections
                Arguments.of(2, new HashSet<>())
        );
    }
}
