package fr.sncf.osrd.envelope_sim_infra;

import static fr.sncf.osrd.envelope.EnvelopeTestUtils.makeFlatPart;
import static fr.sncf.osrd.envelope_sim.EnvelopeProfile.CONSTANT_SPEED;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeTestUtils;
import fr.sncf.osrd.infra.InfraHelpers;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.SpeedLimits;
import fr.sncf.osrd.infra.implementation.tracks.directed.DiTrackEdgeImpl;
import fr.sncf.osrd.infra.implementation.tracks.directed.DirectedInfraBuilder;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra.implementation.tracks.undirected.TrackSectionImpl;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSApplicableDirectionsTrackRange;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;

public class MRSPTest {
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
        InfraHelpers.setTrackSpeedSections(edge, speedSections);
        List<TrackRangeView> path = List.of(
                new TrackRangeView(20, 100, new DiTrackEdgeImpl(edge, Direction.FORWARD))
        );

        var mrspNoTags = MRSP.from(path, TestTrains.REALISTIC_FAST_TRAIN, false, null);
        var mrspFast = MRSP.from(path, TestTrains.REALISTIC_FAST_TRAIN, false, "FAST");
        var mrspShort = MRSP.from(path, TestTrains.REALISTIC_FAST_TRAIN, false, "SHORT");
        var mrspLong = MRSP.from(path, TestTrains.REALISTIC_FAST_TRAIN, false, "LONG");

        EnvelopeTestUtils.assertEquals(
                Envelope.make(
                        makeFlatPart(List.of(MRSP.LimitKind.SPEED_LIMIT, CONSTANT_SPEED), 0, 5, 50),
                        makeFlatPart(List.of(MRSP.LimitKind.SPEED_LIMIT, CONSTANT_SPEED), 5, 30, 25),
                        makeFlatPart(List.of(MRSP.LimitKind.TRAIN_LIMIT, CONSTANT_SPEED), 30, 80,
                                TestTrains.REALISTIC_FAST_TRAIN.maxSpeed)
                ), mrspNoTags, 0.001);

        EnvelopeTestUtils.assertEquals(
                Envelope.make(
                        makeFlatPart(List.of(MRSP.LimitKind.SPEED_LIMIT, CONSTANT_SPEED), 0, 5, 75),
                        makeFlatPart(List.of(MRSP.LimitKind.SPEED_LIMIT, CONSTANT_SPEED), 5, 30, 25),
                        makeFlatPart(List.of(MRSP.LimitKind.TRAIN_LIMIT, CONSTANT_SPEED), 30, 80,
                                TestTrains.REALISTIC_FAST_TRAIN.maxSpeed)
                ), mrspFast, 0.001);

        EnvelopeTestUtils.assertEquals(
                Envelope.make(
                        makeFlatPart(List.of(MRSP.LimitKind.SPEED_LIMIT, CONSTANT_SPEED), 0, 5, 50),
                        makeFlatPart(List.of(MRSP.LimitKind.SPEED_LIMIT, CONSTANT_SPEED), 5, 30, 10),
                        makeFlatPart(List.of(MRSP.LimitKind.TRAIN_LIMIT, CONSTANT_SPEED), 30, 80,
                                TestTrains.REALISTIC_FAST_TRAIN.maxSpeed)
                ), mrspShort, 0.001);

        EnvelopeTestUtils.assertEquals(
                Envelope.make(
                        makeFlatPart(List.of(MRSP.LimitKind.SPEED_LIMIT, CONSTANT_SPEED), 0, 5, 22),
                        makeFlatPart(List.of(MRSP.LimitKind.SPEED_LIMIT, CONSTANT_SPEED), 5, 30, 25),
                        makeFlatPart(List.of(MRSP.LimitKind.TRAIN_LIMIT, CONSTANT_SPEED), 30, 80,
                                TestTrains.REALISTIC_FAST_TRAIN.maxSpeed)
                ), mrspLong, 0.001);
    }


    @Test
    public void mrspFromInfraPath() {
        var rjsInfra = InfraHelpers.makeSingleTrackRJSInfra();
        rjsInfra.speedSections = List.of(
                new RJSSpeedSection("foo1", 42, new HashMap<>(), List.of(
                        new RJSApplicableDirectionsTrackRange(
                                "track",
                                ApplicableDirection.BOTH,
                                0, 30
                        )
                )),
                new RJSSpeedSection("foo2", 21, new HashMap<>(), List.of(
                        new RJSApplicableDirectionsTrackRange(
                                "track",
                                ApplicableDirection.START_TO_STOP,
                                30, 50
                        )
                )),
                new RJSSpeedSection("foo3", 10.5, new HashMap<>(), List.of(
                        new RJSApplicableDirectionsTrackRange(
                                "track",
                                ApplicableDirection.STOP_TO_START,
                                70, 100
                        )
                ))
        );
        var infra = DirectedInfraBuilder.fromRJS(rjsInfra, new DiagnosticRecorderImpl(true));
        var path = List.of(
                new TrackRangeView(0, 15, infra.getEdge("track", Direction.FORWARD)),
                new TrackRangeView(15, 15, infra.getEdge("track", Direction.FORWARD)),
                new TrackRangeView(15, 80, infra.getEdge("track", Direction.FORWARD))
        );
        var testRollingStock = TestTrains.VERY_SHORT_FAST_TRAIN;

        var mrsp = MRSP.from(path, testRollingStock, true, null);
        Assertions.assertEquals(42, mrsp.interpolateSpeedRightDir(0, 1));
        Assertions.assertEquals(42, mrsp.interpolateSpeedRightDir(15, 1));
        Assertions.assertEquals(42, mrsp.interpolateSpeedRightDir(29, 1));
        Assertions.assertEquals(21, mrsp.interpolateSpeedRightDir(30, 1));
        Assertions.assertEquals(21, mrsp.interpolateSpeedRightDir(49, 1));
        Assertions.assertEquals(testRollingStock.maxSpeed, mrsp.interpolateSpeedRightDir(51, 1));
        Assertions.assertEquals(testRollingStock.maxSpeed, mrsp.interpolateSpeedRightDir(75, 1));
    }
}
