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
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.sim_infra.impl.ChunkPath;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.Helpers;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

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

        var simResult = simpleSim(fullInfra, pathProps, chunkPath, 0, Double.POSITIVE_INFINITY);
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

        var simResultA = simpleSim(fullInfra, pathPropsA, chunkPathA, 0, Double.POSITIVE_INFINITY);
        var simResultB = simpleSim(fullInfra, pathPropsB, chunkPathB, 0, Double.POSITIVE_INFINITY);

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

        var simResultA =
                simpleSim(fullInfra, pathPropsA, chunkPathA, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY);
        var simResultB =
                simpleSim(fullInfra, pathPropsB, chunkPathB, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY);

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
            if (statusHist.size() != 0 && statusHist.get(statusHist.size() - 1).equals(conflictStatus)) continue;
            statusHist.add(conflictStatus);
        }
        var expectedStatusHist = List.of(
                new ConflictStatus(true, true), new ConflictStatus(false, true), new ConflictStatus(false, false));
        assertIterableEquals(expectedStatusHist, statusHist);
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
            FullInfra fullInfra, PathProperties path, ChunkPath chunkPath, double initialSpeed, double maxSpeed) {
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
                List.of(),
                List.of(),
                "test",
                RollingStock.Comfort.STANDARD,
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
