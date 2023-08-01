package fr.sncf.osrd.api.pathfinding.constraints;

import static fr.sncf.osrd.Helpers.fullInfraFromRJS;
import static fr.sncf.osrd.Helpers.getExampleInfra;
import static fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType.G1;
import static org.assertj.core.api.Assertions.assertThat;

import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class LoadingGaugeConstraintsTest {

    private LoadingGaugeConstraints loadingGaugeConstraints;
    private double chunk0Length;
    private double chunk1Length;

    @BeforeAll
    public void setUp() throws IOException, URISyntaxException {
        var rjsInfra = getExampleInfra("small_infra/infra.json");
        rjsInfra.trackSections.forEach(trackSection -> {
            if (Objects.equals(trackSection.id, "TA0")) {
                trackSection.loadingGaugeLimits = List.of(new RJSLoadingGaugeLimit(0, trackSection.length, G1));
            }
        });
        var infra = fullInfraFromRJS(rjsInfra);

        loadingGaugeConstraints = new LoadingGaugeConstraints(infra.blockInfra(), infra.rawInfra(),
                List.of(TestTrains.FAST_TRAIN_LARGE_GAUGE));

        chunk0Length = infra.rawInfra().getTrackChunkLength(0);
        chunk1Length = infra.rawInfra().getTrackChunkLength(1);
    }

    @ParameterizedTest
    @MethodSource("testLoadingGaugeArgs")
    public void testLoadingGaugeBlockedRanges(int blockId, Collection<Pathfinding.Range> expectedBlockedRanges) {
        var blockedRanges = loadingGaugeConstraints.apply(blockId);
        assertThat(blockedRanges).isEqualTo(expectedBlockedRanges);
    }

    Stream<Arguments> testLoadingGaugeArgs() {
        return Stream.of(
                // Loading gauge constraints partially applied to block
                Arguments.of(0, Set.of(new Pathfinding.Range(0., chunk1Length))),
                // Loading gauge constraints fully applied to block
                Arguments.of(1, Set.of(new Pathfinding.Range(0., chunk0Length))),
                // No loading gauge constraints
                Arguments.of(2, new HashSet<>())
        );
    }
}
