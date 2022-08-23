package fr.sncf.osrd.envelope_sim_infra;

import static fr.sncf.osrd.envelope_sim.EnvelopeProfile.CONSTANT_SPEED;
import static fr.sncf.osrd.envelope_sim_infra.MRSP.LimitKind.SPEED_LIMIT;
import static fr.sncf.osrd.envelope_sim_infra.MRSP.LimitKind.TRAIN_LIMIT;
import static fr.sncf.osrd.infra.InfraHelpers.setTrackSpeedSections;
import static fr.sncf.osrd.train.TestTrains.*;

import com.google.common.collect.*;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeAttr;
import fr.sncf.osrd.envelope.EnvelopeTestUtils;
import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr;
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.SpeedLimits;
import fr.sncf.osrd.infra.implementation.tracks.directed.DiTrackEdgeImpl;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra.implementation.tracks.undirected.TrackSectionImpl;
import org.junit.jupiter.api.Test;
import java.util.EnumMap;
import java.util.List;

class MRSPEnvelopeBuilderTest {
    public static EnvelopePart makeFlatPart(TestAttr attr, double beginPos, double endPos, double speed) {
        return makeFlatPart(List.of(attr), beginPos, endPos, speed);
    }

    public static EnvelopePart makeFlatPart(Iterable<EnvelopeAttr> attrs,
                                            double beginPos, double endPos, double speed) {
        return EnvelopePart.generateTimes(
                attrs,
                new double[]{beginPos, endPos},
                new double[]{speed, speed}
        );
    }

    @Test
    void disjointGapFreeLimits() {
        /*
         *  +--------+        +-------+
         *           +--------+
         */
        var ep1 = makeFlatPart(TestAttr.A, 0, 1, 2);
        var ep2 = makeFlatPart(TestAttr.B, 1, 2, 1);
        var ep3 = makeFlatPart(TestAttr.C, 2, 3, 2);

        var envelope = new MRSPEnvelopeBuilder()
                .addPart(ep1)
                .addPart(ep2)
                .addPart(ep3)
                .build();

        var expectedEnvelope = Envelope.make(ep1, ep2, ep3);
        EnvelopeTestUtils.assertEquals(expectedEnvelope, envelope, 0.001);
    }

    @Test
    void overlappingLimits() {
        /*
         *  +-----------------------------+
         *        +-----------+
         *              +-----------+
         *  0     1     2     3     4     5
         */
        var ep1 = makeFlatPart(TestAttr.A, 0, 5, 3);
        var ep2 = makeFlatPart(TestAttr.B, 1, 3, 2);
        var ep3 = makeFlatPart(TestAttr.C, 2, 4, 1);

        var envelope = new MRSPEnvelopeBuilder()
                .addPart(ep1)
                .addPart(ep2)
                .addPart(ep3)
                .build();

        /*
         *  +-----+                 +-----+
         *        +-----+
         *              +-----------+
         *  0     1     2     3     4     5
         */
        var expectedEnvelope = Envelope.make(
                makeFlatPart(TestAttr.A, 0, 1, 3),
                makeFlatPart(TestAttr.B, 1, 2, 2),
                makeFlatPart(TestAttr.C, 2, 4, 1),
                makeFlatPart(TestAttr.A, 4, 5, 3)
        );
        EnvelopeTestUtils.assertEquals(expectedEnvelope, envelope, 0.001);
    }

    @Test
    void overlappingSameSpeedLimits() {
        /*
         *  +-----+=====+-----+
         *  0     1     2     3
         */
        var ep1 = makeFlatPart(TestAttr.A, 0, 2, 2);
        var ep2 = makeFlatPart(TestAttr.B, 1, 3, 2);

        var envelope = new MRSPEnvelopeBuilder()
                .addPart(ep1)
                .addPart(ep2)
                .build();

        /*
         *  +-----------+-----+
         *  0     1     2     3
         *
         *          OR
         *  +-----+-----------+
         *  0     1     2     3
         *
         * Both are valid, but we ensure the current implementation's behavior does not change.
         * It does not matter, it this breaks because the implementation changed, you can test for
         * the other case.
         */
        var expectedEnvelope = Envelope.make(
                makeFlatPart(TestAttr.A, 0, 2, 2),
                makeFlatPart(TestAttr.B, 2, 3, 2)
        );
        EnvelopeTestUtils.assertEquals(expectedEnvelope, envelope, 0.001);
    }

    @Test
    public void speedLimitByCategory() {
        final var edge = new TrackSectionImpl(100, "edge");
        var speedSections = new EnumMap<Direction, RangeMap<Double, SpeedLimits>>(Direction.class);
        var map = TreeRangeMap.<Double, SpeedLimits>create();
        map.put(
                Range.closed(10., 25.),
                new SpeedLimits(50, ImmutableMap.of(
                        "FAST", 75.,
                        "LONG", 22.
                ))
        );
        map.put(
                Range.closed(25., 50.),
                new SpeedLimits(25, ImmutableMap.of(
                        "SHORT", 10.
                ))
        );
        for (var dir : Direction.values())
            speedSections.put(dir, map);
        setTrackSpeedSections(edge, speedSections);
        var path = List.of(
                new TrackRangeView(20, 100, new DiTrackEdgeImpl(edge, Direction.FORWARD))
        );

        var mrspNoTags = MRSP.from(path, REALISTIC_FAST_TRAIN, false, List.of());
        var mrspFastShort = MRSP.from(path, REALISTIC_FAST_TRAIN, false, List.of("FAST", "SHORT"));
        var mrspFastLong = MRSP.from(path, REALISTIC_FAST_TRAIN, false, List.of("FAST", "LONG"));

        EnvelopeTestUtils.assertEquals(
                Envelope.make(
                        makeFlatPart(List.of(SPEED_LIMIT, CONSTANT_SPEED), 0, 5, 50),
                        makeFlatPart(List.of(SPEED_LIMIT, CONSTANT_SPEED), 5, 30, 25),
                        makeFlatPart(List.of(TRAIN_LIMIT, CONSTANT_SPEED), 30, 80, REALISTIC_FAST_TRAIN.maxSpeed)
                ), mrspNoTags, 0.001);

        EnvelopeTestUtils.assertEquals(
                Envelope.make(
                        makeFlatPart(List.of(SPEED_LIMIT, CONSTANT_SPEED), 0, 5, 75),
                        makeFlatPart(List.of(SPEED_LIMIT, CONSTANT_SPEED), 5, 30, 10),
                        makeFlatPart(List.of(TRAIN_LIMIT, CONSTANT_SPEED), 30, 80, REALISTIC_FAST_TRAIN.maxSpeed)
                ), mrspFastShort, 0.001);

        EnvelopeTestUtils.assertEquals(
                Envelope.make(
                        makeFlatPart(List.of(SPEED_LIMIT, CONSTANT_SPEED), 0, 5, 22),
                        makeFlatPart(List.of(SPEED_LIMIT, CONSTANT_SPEED), 5, 30, 25),
                        makeFlatPart(List.of(TRAIN_LIMIT, CONSTANT_SPEED), 30, 80, REALISTIC_FAST_TRAIN.maxSpeed)
                ), mrspFastLong, 0.001);
    }
}