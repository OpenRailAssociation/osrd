package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict.ConflictType.ROUTING;
import static fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict.ConflictType.SPACING;
import static fr.sncf.osrd.envelope_sim.TestMRSPBuilder.makeSimpleMRSP;
import static fr.sncf.osrd.sim_infra.api.PathPropertiesKt.makePathProperties;
import static fr.sncf.osrd.sim_infra.api.PathPropertiesKt.makeTrackLocation;
import static fr.sncf.osrd.sim_infra.api.TrackInfraKt.getTrackSectionFromNameOrThrow;
import static fr.sncf.osrd.utils.Helpers.chunkPathFromRoutes;
import static fr.sncf.osrd.utils.Helpers.fullInfraFromRJS;
import static fr.sncf.osrd.utils.units.Distance.fromMeters;
import static fr.sncf.osrd.utils.units.Distance.toMeters;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.conflicts.ConflictsKt;
import fr.sncf.osrd.conflicts.TrainRequirements;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.SimpleContextBuilder;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort;
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.sim_infra.impl.ChunkPath;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.Helpers;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

public class ConflictDetectionTest {

    private record SimResult(ResultTrain train, Envelope envelope) {}

    @Test
    public void testRequirementProperties() throws Exception {
        /*
        Checks the following requirement properties:
         - consecutive spacing requirements have overlapping time spans
         - spacing requirements span the entire trip duration
         - consecutive routing requirements have overlapping time spans
         - routing requirements span the entire trip duration
         */

        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");
        var fullInfra = fullInfraFromRJS(rjsInfra);
        var rawInfra = fullInfra.rawInfra();

        // A path from the center track of south-west station to the center-top track of mid west station
        var chunkPath = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.buffer_stop.1->DA0", "rt.DA0->DA5", "rt.DA5->DC5"),
                makeTrackLocation(getTrackSectionFromNameOrThrow("TA1", rawInfra), fromMeters(146.6269028126681)),
                makeTrackLocation(getTrackSectionFromNameOrThrow("TC1", rawInfra), fromMeters(444.738508351214)));
        var pathProps = makePathProperties(rawInfra, chunkPath, null);

        var simResult = simpleSim(fullInfra, pathProps, chunkPath, 0, Double.POSITIVE_INFINITY, List.of());
        var spacingRequirements = simResult.train.spacingRequirements;

        // ensure spacing requirements span the entire trip duration
        var firstSpacingRequirement = spacingRequirements.get(0);
        Assertions.assertEquals(firstSpacingRequirement.beginTime, 0.0);
        for (int i = 0; i < spacingRequirements.size() - 1; i++) {
            var curReq = spacingRequirements.get(i);
            var nextReq = spacingRequirements.get(i + 1);
            assertTrue(curReq.endTime > nextReq.beginTime);
        }
        var lastSpacingRequirement = spacingRequirements.get(spacingRequirements.size() - 1);
        Assertions.assertEquals(lastSpacingRequirement.endTime, simResult.envelope.getTotalTime(), 0.001);

        // ensure routing requirements span the entire trip duration
        var routingRequirements = simResult.train.routingRequirements;
        var firstRoutingRequirement = routingRequirements.get(0);
        Assertions.assertEquals(firstRoutingRequirement.beginTime, 0.0);
        // ensure route requirement times overlap
        for (int i = 0; i < routingRequirements.size() - 1; i++) {
            var curReq = routingRequirements.get(i);
            var nextReq = routingRequirements.get(i + 1);
            var lastZoneReleaseTime = getLastZoneReleaseTime(curReq);
            assertTrue(
                    lastZoneReleaseTime > nextReq.beginTime,
                    "Route reservations do not overlap at index %d: [.., %f] has no overlap with [%f, ...]"
                            .formatted(i, lastZoneReleaseTime, nextReq.beginTime));
        }
        var lastRoutingRequirement = routingRequirements.get(routingRequirements.size() - 1);
        var lastZoneReleaseTime = getLastZoneReleaseTime(lastRoutingRequirement);
        Assertions.assertEquals(lastZoneReleaseTime, simResult.envelope.getTotalTime(), 0.001);
    }

    @Test
    public void headToHeadRoutingConflict() throws Exception {
        /*
        Interlocking is supposed to prevent trains from being sent head to head.
        If one of the conflicting routes is very long, the routing conflict can occur
        long before any spacing conflict.
         */
        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");
        var fullInfra = fullInfraFromRJS(rjsInfra);
        var rawInfra = fullInfra.rawInfra();
        var ta0 = getTrackSectionFromNameOrThrow("TA0", rawInfra);
        var tc0 = getTrackSectionFromNameOrThrow("TC0", rawInfra);

        // these paths are fairly distant from each other, but require passing a signal which protects
        // a very long route. As the routes for pathA and pathB are incompatible with each other,
        // a conflict should occur.
        var chunkPathA = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.buffer_stop.0->DA2", "rt.DA2->DA5"),
                makeTrackLocation(ta0, fromMeters(1795)),
                makeTrackLocation(ta0, fromMeters(1825)));
        var pathPropsA = makePathProperties(rawInfra, chunkPathA, null);
        var chunkPathB = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DD0->DC0", "rt.DC0->DA3"),
                makeTrackLocation(tc0, fromMeters(205)),
                makeTrackLocation(tc0, fromMeters(175)));
        var pathPropsB = makePathProperties(rawInfra, chunkPathB, null);

        var simResultA = simpleSim(fullInfra, pathPropsA, chunkPathA, 0, Double.POSITIVE_INFINITY, List.of());
        var simResultB = simpleSim(fullInfra, pathPropsB, chunkPathB, 0, Double.POSITIVE_INFINITY, List.of());

        // if both trains runs at the same time, there should be a conflict
        {
            var conflicts = ConflictsKt.detectConflicts(List.of(
                    convertRequirements(0L, 0.0, simResultA.train), convertRequirements(1L, 0.0, simResultB.train)));
            assertTrue(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == ROUTING));
            assertFalse(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == SPACING));
        }

        // no conflicts should occur if trains don't run at the same time
        {
            var conflicts = ConflictsKt.detectConflicts(List.of(
                    convertRequirements(0L, 0.0, simResultA.train),
                    // give enough time for switches to move (the default move time is 5)
                    convertRequirements(1L, simResultA.envelope.getTotalTime() + 5.1, simResultB.train)));
            assertFalse(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == ROUTING));
            assertFalse(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == SPACING));
        }
    }

    @Test
    public void divergenceRoutingConflict() throws Exception {
        /*
        Two trains are following each other on the same track. The first train stops at the station, while the second
        one does not. As the first train slows down to stop, it holds the route to its track longer, which causes a
        conflict with the other train.
         */
        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");
        var fullInfra = fullInfraFromRJS(rjsInfra);
        var rawInfra = fullInfra.rawInfra();
        var ta6 = getTrackSectionFromNameOrThrow("TA6", rawInfra);
        var tc0 = getTrackSectionFromNameOrThrow("TC0", rawInfra);
        var td0 = getTrackSectionFromNameOrThrow("TD0", rawInfra);

        // path that stops in station
        var chunkPathA = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DA2->DA5", "rt.DA5->DC4"),
                makeTrackLocation(ta6, 0),
                makeTrackLocation(tc0, fromMeters(600)));
        var pathPropsA = makePathProperties(rawInfra, chunkPathA, null);
        // path that continues on
        var chunkPathB = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DA2->DA5", "rt.DA5->DC5", "rt.DC5->DD2"),
                makeTrackLocation(ta6, 0),
                makeTrackLocation(td0, fromMeters(8500)));
        var pathPropsB = makePathProperties(rawInfra, chunkPathB, null);

        var simResultA = simpleSim(
                fullInfra, pathPropsA, chunkPathA, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY, List.of());
        var simResultB = simpleSim(
                fullInfra, pathPropsB, chunkPathB, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY, List.of());

        record ConflictStatus(boolean spacing, boolean routing) {}

        var statusHist = new ArrayList<ConflictStatus>();
        for (int i = 0; i < 200; i += 4) {
            var conflicts = ConflictsKt.detectConflicts(List.of(
                    convertRequirements(0L, 0, simResultA.train), convertRequirements(1L, i, simResultB.train)));
            var spacingConflict = false;
            var routingConflict = false;
            for (var conflict : conflicts)
                switch (conflict.conflictType) {
                    case SPACING -> spacingConflict = true;
                    case ROUTING -> routingConflict = true;
                }
            var conflictStatus = new ConflictStatus(spacingConflict, routingConflict);
            if (!statusHist.isEmpty() && statusHist.get(statusHist.size() - 1).equals(conflictStatus)) continue;
            statusHist.add(conflictStatus);
        }
        var expectedStatusHist = List.of(
                new ConflictStatus(true, true), new ConflictStatus(false, true), new ConflictStatus(false, false));
        assertIterableEquals(expectedStatusHist, statusHist);
    }

    @Test
    public void arrivalOnStopSignalAvoidsConflict() throws Exception {
        /*
        Ideally, when a train stops on a platform, some other train might be able to pass it on another parallel route.
        In practice, the stop train will require the route in front of him (zone and switch positions)
        which will make the route unavailable for the other train.
        However, it's possible to configure the stop with a stop signal.
        In this case, the stop train should not require what's in front of him,
        until the stop signal goes green.
         */
        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");
        var fullInfra = fullInfraFromRJS(rjsInfra);
        var rawInfra = fullInfra.rawInfra();
        var tc0 = getTrackSectionFromNameOrThrow("TC0", rawInfra);
        var tc1 = getTrackSectionFromNameOrThrow("TC1", rawInfra);
        var td0 = getTrackSectionFromNameOrThrow("TD0", rawInfra);

        // these paths are fairly distant from each other, but require passing a signal which protects
        // a very long route. As the routes for pathA and pathB are incompatible with each other,
        // a conflict should occur.
        var chunkPathA = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DA5->DC5", "rt.DC5->DD2"),
                makeTrackLocation(tc1, fromMeters(185)), // cut path after PC1
                makeTrackLocation(td0, fromMeters(24820)));
        var pathPropsA = makePathProperties(rawInfra, chunkPathA, null);
        var chunkPathB = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DA5->DC4", "rt.DC4->DD2"),
                makeTrackLocation(tc0, fromMeters(185)), // cut path after PC0
                makeTrackLocation(td0, fromMeters(24820)));
        var pathPropsB = makePathProperties(rawInfra, chunkPathB, null);

        var simResultA = simpleSim(fullInfra, pathPropsA, chunkPathA, 0, Double.POSITIVE_INFINITY, List.of());
        var simResultB = simpleSim(fullInfra, pathPropsB, chunkPathB, 0, Double.POSITIVE_INFINITY, List.of());

        // if both trains runs at the same time, there should be a conflict
        {
            var conflicts = ConflictsKt.detectConflicts(List.of(
                    convertRequirements(0L, 0.0, simResultA.train), convertRequirements(1L, 0.0, simResultB.train)));
            assertTrue(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == ROUTING));
            assertTrue(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == SPACING));
        }
        // if both trains runs at the same time, but first one has an arrival on stop signal (before PC2 switch)
        // with a stop long enough for the other train to get out, there is no conflict
        {
            var stop = new TrainStop(500, 600, true);
            var simResultAWithStop =
                    simpleSim(fullInfra, pathPropsA, chunkPathA, 0, Double.POSITIVE_INFINITY, List.of(stop));

            var reqA = convertRequirements(0L, 0.0, simResultAWithStop.train);
            var reqB = convertRequirements(1L, 0.0, simResultB.train);
            var conflicts = ConflictsKt.detectConflicts(List.of(reqA, reqB));
            assertFalse(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == ROUTING));
            assertFalse(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == SPACING));
        }
    }

    /*
    Context: both trains start in station and the requirements on the block protecting the switch at station exit may
    conflict.
    This block is protected by 2 signals (first will be yellow, last and closest will be red).
    Test for trains starting after the first signal protecting block with the switch.
    Also, the stopping train stops either (all combinations):
    * on stop-signal or on open signal
    * while seeing the last signal protecting block or before seeing it

    Stopping on open signal and before seeing any signal protecting the block is quite an undefined behavior (train
    is starting after first signal) for routing conflicts.
    In current implementation, the considered signal is not really the limiting one, but the first signal seen by the
    train that is protecting the block.
    So one might consider that train should require resource at its very beginning, but we actually go for waiting
    to see any signal.
     */
    @ParameterizedTest
    @CsvSource({
        "false, true, true, true",
        "true, true, false, false",
        "false, false, false, false",
        "true, false, false, false",
    })
    public void conflictHandlingWithTrainStartingDuringRequirementTrigger(
            boolean onStopSignal, boolean seeingEntrySignal, boolean hasRoutingConflict, boolean hasSpacingConflict)
            throws Exception {
        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");
        var fullInfra = fullInfraFromRJS(rjsInfra);
        var rawInfra = fullInfra.rawInfra();
        var tc0 = getTrackSectionFromNameOrThrow("TC0", rawInfra);
        var tc1 = getTrackSectionFromNameOrThrow("TC1", rawInfra);
        var td0 = getTrackSectionFromNameOrThrow("TD0", rawInfra);

        var chunkPathA = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DA5->DC5", "rt.DC5->DD2"),
                makeTrackLocation(tc1, fromMeters(185)), // cut path after PC1
                makeTrackLocation(td0, fromMeters(24820)));
        var pathPropsA = makePathProperties(rawInfra, chunkPathA, null);
        var chunkPathB = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DA5->DC4", "rt.DC4->DD2"),
                makeTrackLocation(tc0, fromMeters(185)), // cut path after PC0
                makeTrackLocation(td0, fromMeters(24820)));
        var pathPropsB = makePathProperties(rawInfra, chunkPathB, null);

        var simResultB = simpleSim(fullInfra, pathPropsB, chunkPathB, 0, Double.POSITIVE_INFINITY, List.of());

        // signal position on track minus sight distance and start travelled path position
        var sightOffset = 800 - 400 - 185;
        var stopPosition = sightOffset + (seeingEntrySignal ? 100 : -100);
        var stop = new TrainStop(stopPosition, 600, onStopSignal);
        var simResultAWithStop =
                simpleSim(fullInfra, pathPropsA, chunkPathA, 0, Double.POSITIVE_INFINITY, List.of(stop));

        var reqA = convertRequirements(0L, 0.0, simResultAWithStop.train);
        var reqB = convertRequirements(1L, 0.0, simResultB.train);
        var conflicts = ConflictsKt.detectConflicts(List.of(reqA, reqB));
        assert (hasRoutingConflict == conflicts.stream().anyMatch((conflict) -> conflict.conflictType == ROUTING));
        assert (hasSpacingConflict == conflicts.stream().anyMatch((conflict) -> conflict.conflictType == SPACING));
    }

    /*
    Context: 2 trains would conflict requiring the same block at the same time at a crossing.
    Test conflict handling with a train stopping before or after seeing the very first signal protecting the
    crossing block (no ambiguity about the start of the train being after any protecting signal).
    Test also combination with reception on stop-signal or open signal.
     */
    @ParameterizedTest
    @CsvSource({
        "false, true, true, true",
        "true, true, false, false",
        "false, false, false, false",
        "true, false, false, false",
    })
    public void conflictHandlingBeforeAfterSignalSight(
            boolean onStopSignal, boolean seeingLimitingSignal, boolean hasRoutingConflict, boolean hasSpacingConflict)
            throws Exception {
        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");
        var fullInfra = fullInfraFromRJS(rjsInfra);
        var rawInfra = fullInfra.rawInfra();
        var tg0 = getTrackSectionFromNameOrThrow("TG0", rawInfra);
        var td0 = getTrackSectionFromNameOrThrow("TD0", rawInfra);
        var tf1 = getTrackSectionFromNameOrThrow("TF1", rawInfra);
        var te0 = getTrackSectionFromNameOrThrow("TE0", rawInfra);

        /*
        Trains without stop are conflicting at crossing
        Train A is going West (and will stop)
        Train B is going North
         */
        var chunkPathA = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DG1->DD7", "rt.DD7->DD4", "rt.DD4->DD0"),
                makeTrackLocation(tg0, fromMeters(800)),
                makeTrackLocation(td0, fromMeters(23000)));
        var pathPropsA = makePathProperties(rawInfra, chunkPathA, null);
        var chunkPathB = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.buffer_stop.4->DD5", "rt.DD5->DE1"),
                makeTrackLocation(tf1, fromMeters(3700)),
                makeTrackLocation(te0, fromMeters(400)));
        var pathPropsB = makePathProperties(rawInfra, chunkPathB, null);

        var simResultB = simpleSim(fullInfra, pathPropsB, chunkPathB, 0, Double.POSITIVE_INFINITY, List.of());

        // limiting signal is seen after 200 m on travelled path
        var sightOffset = 200;
        var stopPosition = sightOffset + (seeingLimitingSignal ? 100 : -100);
        var stop = new TrainStop(stopPosition, 600, onStopSignal);
        var simResultAWithStop =
                simpleSim(fullInfra, pathPropsA, chunkPathA, 0, Double.POSITIVE_INFINITY, List.of(stop));

        var reqA = convertRequirements(0L, 0.0, simResultAWithStop.train);
        var reqB = convertRequirements(1L, 0.0, simResultB.train);
        var conflicts = ConflictsKt.detectConflicts(List.of(reqA, reqB));
        assert (hasRoutingConflict == conflicts.stream().anyMatch((conflict) -> conflict.conflictType == ROUTING));
        assert (hasSpacingConflict == conflicts.stream().anyMatch((conflict) -> conflict.conflictType == SPACING));
    }

    /*
    Test that overtaking conflicts are correctly processed in the case of 2 trains, one is
    stopping for 10 min, the other is direct.
    For all combinations of:
    - stop with reception on stop signal or not
    - trains being close (5min) or far (1hour) from each other
    - first train leaving being the one with stop (overtaking) or the direct (no overtake)
     */
    @ParameterizedTest
    @CsvSource({
        "false, 300, true, true",
        "true, 300, false, false",
        "false, 3600, false, false",
        "true, 3600, false, false",
        "false, -300, false, false",
        "true, -300, false, false",
        "false, -3600, false, false",
        "true, -3600, false, false",
    })
    public void conflictDetectionForOvertakeInStation(
            boolean onStopSignal,
            double directStartTime, // stopping train starts at 0
            boolean hasRoutingConflict,
            boolean hasSpacingConflict)
            throws Exception {
        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");
        var fullInfra = fullInfraFromRJS(rjsInfra);
        var rawInfra = fullInfra.rawInfra();

        var ta6 = getTrackSectionFromNameOrThrow("TA6", rawInfra);
        var td0 = getTrackSectionFromNameOrThrow("TD0", rawInfra);

        var chunkPathCenter = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DA0->DA5", "rt.DA5->DC5", "rt.DC5->DD2"),
                makeTrackLocation(ta6, fromMeters(1000)), // start after DA3
                makeTrackLocation(td0, fromMeters(24820)));
        var pathPropsCenter = makePathProperties(rawInfra, chunkPathCenter, null);
        var chunkPathNorth = chunkPathFromRoutes(
                rawInfra,
                List.of("rt.DA0->DA5", "rt.DA5->DC4", "rt.DC4->DD2"),
                makeTrackLocation(ta6, fromMeters(1000)),
                makeTrackLocation(td0, fromMeters(24820)));
        var pathPropsNorth = makePathProperties(rawInfra, chunkPathNorth, null);

        var stop = new TrainStop(9700, 600, onStopSignal);
        var simResultCenterWithStop =
                simpleSim(fullInfra, pathPropsCenter, chunkPathCenter, 0, Double.POSITIVE_INFINITY, List.of(stop));
        var simResultNorthOvertaking =
                simpleSim(fullInfra, pathPropsNorth, chunkPathNorth, 0, Double.POSITIVE_INFINITY, List.of());

        var reqWithStop = convertRequirements(0L, 0.0, simResultCenterWithStop.train);
        var reqOvertaking = convertRequirements(1L, directStartTime, simResultNorthOvertaking.train);
        var conflicts = ConflictsKt.detectConflicts(List.of(reqWithStop, reqOvertaking));
        assert (hasRoutingConflict == conflicts.stream().anyMatch((conflict) -> conflict.conflictType == ROUTING));
        assert (hasSpacingConflict == conflicts.stream().anyMatch((conflict) -> conflict.conflictType == SPACING));
    }

    private static TrainRequirements convertRequirements(long trainId, double offset, ResultTrain train) {
        var spacingRequirements = new ArrayList<ResultTrain.SpacingRequirement>();
        for (var req : train.spacingRequirements)
            spacingRequirements.add(new ResultTrain.SpacingRequirement(
                    req.zone, offset + req.beginTime, offset + req.endTime, req.isComplete));
        var routingRequirements = new ArrayList<ResultTrain.RoutingRequirement>();
        for (var req : train.routingRequirements) {
            var zoneReqs = new ArrayList<ResultTrain.RoutingZoneRequirement>();
            for (var zoneReq : req.zones)
                zoneReqs.add(new ResultTrain.RoutingZoneRequirement(
                        zoneReq.zone,
                        zoneReq.entryDetector,
                        zoneReq.exitDetector,
                        zoneReq.switches,
                        zoneReq.endTime + offset));
            routingRequirements.add(new ResultTrain.RoutingRequirement(req.route, offset + req.beginTime, zoneReqs));
        }
        return new TrainRequirements(trainId, spacingRequirements, routingRequirements);
    }

    private static SimResult simpleSim(
            FullInfra fullInfra,
            PathProperties path,
            ChunkPath chunkPath,
            double initialSpeed,
            double maxSpeed,
            List<TrainStop> intermediateStops) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        if (maxSpeed > testRollingStock.maxSpeed) maxSpeed = testRollingStock.maxSpeed;

        if (Double.isInfinite(initialSpeed)) initialSpeed = maxSpeed;

        assert initialSpeed <= maxSpeed;

        var stops = new double[] {toMeters(path.getLength())};
        var context = SimpleContextBuilder.makeSimpleContext(toMeters(path.getLength()), 0);
        var flatMRSP = makeSimpleMRSP(context, maxSpeed);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        var envelope = MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope);

        var schedule = new StandaloneTrainSchedule(
                testRollingStock,
                initialSpeed,
                List.of(),
                intermediateStops,
                List.of(),
                "test",
                Comfort.STANDARD,
                null,
                null);
        return new SimResult(ScheduleMetadataExtractor.run(envelope, path, chunkPath, schedule, fullInfra), envelope);
    }

    private static double getLastZoneReleaseTime(ResultTrain.RoutingRequirement requirement) {
        return requirement.zones.stream()
                .map(e -> e.endTime)
                .reduce(Double::max)
                .get();
    }
}
