package fr.sncf.osrd.envelope_sim_infra;

import static fr.sncf.osrd.Helpers.fullInfraFromRJS;
import static fr.sncf.osrd.Helpers.getExampleInfra;
import static fr.sncf.osrd.api.pathfinding.PathfindingUtils.makePath;
import static fr.sncf.osrd.envelope.EnvelopeTestUtils.makeFlatPart;
import static fr.sncf.osrd.envelope.MRSPEnvelopeBuilder.LimitKind.SPEED_LIMIT;
import static fr.sncf.osrd.envelope.MRSPEnvelopeBuilder.LimitKind.TRAIN_LIMIT;
import static fr.sncf.osrd.envelope_sim.EnvelopeProfile.CONSTANT_SPEED;
import static fr.sncf.osrd.train.TestTrains.MAX_SPEED;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static fr.sncf.osrd.train.TestTrains.VERY_LONG_FAST_TRAIN;
import static fr.sncf.osrd.train.TestTrains.VERY_SHORT_FAST_TRAIN;
import static fr.sncf.osrd.utils.units.Distance.toMeters;
import static org.assertj.core.api.AssertionsForInterfaceTypes.assertThat;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeTestUtils;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSApplicableDirectionsTrackRange;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.train.RollingStock;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class MRSPTest {

    private Path path;
    private static final double POSITION1 = 200;
    private static final double POSITION2 = 1000;
    private static final double POSITION3 = 1200;
    private static final double SPEED1 = 42;
    private static final double SPEED2 = 90;
    private static final double SPEED3 = 70;
    private static final String NAME = "The chosen one";
    private static final String TRAIN_TAG1 = "Hello there";
    private static final String TRAIN_TAG2 = "General Kenobi";

    @BeforeAll
    public void setUp() throws IOException, URISyntaxException {
        var rjsInfra = getExampleInfra("small_infra/infra.json");
        var speedSection1 = new RJSSpeedSection(NAME, SPEED1, Map.of(TRAIN_TAG1, SPEED2),
                List.of(new RJSApplicableDirectionsTrackRange("TA0", ApplicableDirection.BOTH,
                        POSITION1, POSITION2)));
        var speedSection2 = new RJSSpeedSection(NAME, 0, Map.of(TRAIN_TAG2, SPEED3),
                List.of(new RJSApplicableDirectionsTrackRange("TA0", ApplicableDirection.BOTH,
                        POSITION2, POSITION3)));
        rjsInfra.speedSections = new ArrayList<>();
        rjsInfra.speedSections.addAll(List.of(speedSection1, speedSection2));
        var infra = fullInfraFromRJS(rjsInfra);
        path = makePath(infra.blockInfra(), infra.rawInfra(), 1);
    }

    @ParameterizedTest
    @MethodSource("testComputeMRSPArgs")
    public void testComputeMRSP(Path path, RollingStock rollingStock, boolean addRollingStockLength, String trainTag,
                                Envelope expectedEnvelope) {
        var mrsp = MRSP.computeMRSP(path, rollingStock, addRollingStockLength, trainTag);
        EnvelopeTestUtils.assertEquals(expectedEnvelope, mrsp, 0.001);
    }

    @SuppressFBWarnings(value = "UPM_UNCALLED_PRIVATE_METHOD", justification = "called implicitly by MethodSource")
    private Stream<Arguments> testComputeMRSPArgs() {
        var pathLength = toMeters(path.getLength());
        return Stream.of(
                // Multiple speed sections with correct/incorrect train tag and no rolling stock length
                Arguments.of(path, REALISTIC_FAST_TRAIN, false, TRAIN_TAG2,
                        Envelope.make(
                                // No speed section at first => train speed limit
                                makeFlatPart(List.of(TRAIN_LIMIT, CONSTANT_SPEED), 0, POSITION1, MAX_SPEED),
                                // Speed section with incorrect train tag => speed 1
                                makeFlatPart(List.of(SPEED_LIMIT, CONSTANT_SPEED), POSITION1, POSITION2, SPEED1),
                                // Speed section with correct train tag => speed 3
                                makeFlatPart(List.of(SPEED_LIMIT, CONSTANT_SPEED), POSITION2, POSITION3, SPEED3),
                                // No speed section at end => train speed limit
                                makeFlatPart(List.of(TRAIN_LIMIT, CONSTANT_SPEED), POSITION3, pathLength, MAX_SPEED))),

                // Multiple speed sections with rolling stock length
                Arguments.of(path, REALISTIC_FAST_TRAIN, true, null,
                        Envelope.make(
                                // No speed section at first => train speed limit
                                makeFlatPart(List.of(TRAIN_LIMIT, CONSTANT_SPEED), 0, POSITION1, MAX_SPEED),
                                // Speed section with incorrect train tag: speed 1
                                makeFlatPart(List.of(SPEED_LIMIT, CONSTANT_SPEED), POSITION1,
                                        POSITION2 + REALISTIC_FAST_TRAIN.length, SPEED1),
                                // Rolling stock length > speedSection2 length => speedSection2 not taken into account
                                // No speed section at end => train speed limit
                                makeFlatPart(List.of(TRAIN_LIMIT, CONSTANT_SPEED),
                                        POSITION2 + REALISTIC_FAST_TRAIN.length, pathLength, MAX_SPEED))),

                // No speed sections taken into account: speedSection1 speed2 > train maxSpeed, speedSection2 speed 0m/s
                Arguments.of(path, REALISTIC_FAST_TRAIN, false, TRAIN_TAG1,
                        Envelope.make(makeFlatPart(List.of(TRAIN_LIMIT, CONSTANT_SPEED), 0, pathLength, MAX_SPEED))));
    }
}

