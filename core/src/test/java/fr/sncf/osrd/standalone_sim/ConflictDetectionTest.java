package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.Helpers.fullInfraFromRJS;
import static fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict.ConflictType.ROUTING;
import static fr.sncf.osrd.api.ConflictDetectionEndpoint.ConflictDetectionResult.Conflict.ConflictType.SPACING;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.TestMRSPBuilder.makeSimpleMRSP;
import static fr.sncf.osrd.infra.InfraHelpers.getSignalingRoute;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.conflicts.ConflictsKt;
import fr.sncf.osrd.conflicts.TrainRequirements;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.SimpleContextBuilder;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;

public class ConflictDetectionTest {
    static TrainRequirements convertRequirements(long trainId, double offset, ResultTrain train) {
        var spacingRequirements = new ArrayList<ResultTrain.SpacingRequirement>();
        for (var req : train.spacingRequirements)
            spacingRequirements.add(new ResultTrain.SpacingRequirement(
                    req.zone,
                    offset + req.beginTime,
                    offset + req.endTime
            ));
        var routingRequirements = new ArrayList<ResultTrain.RoutingRequirement>();
        for (var req : train.routingRequirements) {
            var zoneReqs = new ArrayList<ResultTrain.RoutingZoneRequirement>();
            for (var zoneReq : req.zones)
                zoneReqs.add(new ResultTrain.RoutingZoneRequirement(
                        zoneReq.zone,
                        zoneReq.entryDetector,
                        zoneReq.exitDetector,
                        zoneReq.switches,
                        zoneReq.endTime + offset
                ));
            routingRequirements.add(new ResultTrain.RoutingRequirement(
                    req.route,
                    offset + req.beginTime,
                    zoneReqs
            ));
        }
        return new TrainRequirements(trainId, spacingRequirements, routingRequirements);
    }

    static TrainPath makePath(
            SignalingInfra infra,
            List<String> routeIDs,
            String startTrack,
            double startOff,
            String endTrack,
            double endOff
    ) {
        var routes = routeIDs.stream().map((routeID) -> getSignalingRoute(infra, routeID)).toList();
        return TrainPathBuilder.from(routes,
                new TrackLocation(infra.getTrackSection(startTrack), startOff),
                new TrackLocation(infra.getTrackSection(endTrack), endOff)
        );
    }

    record SimResult(ResultTrain train, Envelope envelope) {}

    static SimResult simpleSim(FullInfra fullInfra, TrainPath path, double initialSpeed, double maxSpeed) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        if (maxSpeed > testRollingStock.maxSpeed)
            maxSpeed = testRollingStock.maxSpeed;

        if (Double.isInfinite(initialSpeed))
            initialSpeed = maxSpeed;

        assert initialSpeed <= maxSpeed;

        var stops = new double[]{ path.length() };
        var context = SimpleContextBuilder.makeSimpleContext(path.length(), 0);
        var flatMRSP = makeSimpleMRSP(context, maxSpeed);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        var envelope = MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope);

        var schedule = new StandaloneTrainSchedule(
                testRollingStock, initialSpeed, List.of(), List.of(), List.of(),
                "test", RollingStock.Comfort.STANDARD, null, null
        );
        //return new SimResult(ScheduleMetadataExtractor.run(envelope, path, schedule, fullInfra), envelope);
        return null;
    }

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
        var infra = fullInfra.java();

        // A path from the center track of south-west station to the center-top track of mid west station
        var path = makePath(
                infra, List.of("rt.buffer_stop.1->DA0", "rt.DA0->DA5", "rt.DA5->DC5"),
                "TA1", 146.6269028126681,
                "TC1", 444.738508351214
        );

        var simResult = simpleSim(fullInfra, path, 0, Double.POSITIVE_INFINITY);
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
            assertTrue(lastZoneReleaseTime > nextReq.beginTime,
                    "Route reservations do not overlap at index %d: [.., %f] has no overlap with [%f, ...]".formatted(
                            i, lastZoneReleaseTime, nextReq.beginTime));
        }
        var lastRoutingRequirement = routingRequirements.get(routingRequirements.size() - 1);
        var lastZoneReleaseTime = getLastZoneReleaseTime(lastRoutingRequirement);
        Assertions.assertEquals(lastZoneReleaseTime, simResult.envelope.getTotalTime(), 0.001);
    }

    static double getLastZoneReleaseTime(ResultTrain.RoutingRequirement requirement) {
        return requirement.zones.stream().map(e -> e.endTime).reduce(Double::max).get();
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
        var infra = fullInfra.java();

        // these paths are fairly distant from each other, but require passing a signal which protects
        // a very long route. As the routes for pathA and pathB are incompatible with each other,
        // a conflict should occur.
        var pathA = makePath(
                infra, List.of("rt.buffer_stop.0->DA2", "rt.DA2->DA5"),
                "TA0", 1795,
                "TA0", 1825
        );
        var pathB = makePath(
                infra, List.of("rt.DD0->DC0", "rt.DC0->DA3"),
                "TC0", 205,
                "TC0", 175
        );

        var simResultA = simpleSim(fullInfra, pathA, 0, Double.POSITIVE_INFINITY);
        var simResultB = simpleSim(fullInfra, pathB, 0, Double.POSITIVE_INFINITY);

        // if both trains runs at the same time, there should be a conflict
        {
            var conflicts = ConflictsKt.detectConflicts(List.of(
                    convertRequirements(0L, 0.0, simResultA.train),
                    convertRequirements(1L, 0.0, simResultB.train)
            ));
            assertTrue(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == ROUTING));
            assertFalse(conflicts.stream().anyMatch((conflict) -> conflict.conflictType == SPACING));
        }

        // no conflicts should occur if trains don't run at the same time
        {
            var conflicts = ConflictsKt.detectConflicts(List.of(
                    convertRequirements(0L, 0.0, simResultA.train),
                    // give enough time for switches to move (the default move time is 5)
                    convertRequirements(1L, simResultA.envelope.getTotalTime() + 5.1, simResultB.train)
            ));
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
        var infra = fullInfra.java();

        // path that stops in station
        var pathA = makePath(
                infra, List.of("rt.DA2->DA5", "rt.DA5->DC4"),
                "TA6", 0,
                "TC0", 600
        );
        // path that continues on
        var pathB = makePath(
                infra, List.of("rt.DA2->DA5", "rt.DA5->DC5", "rt.DC5->DD2"),
                "TA6", 0,
                "TD0", 8500
        );

        var simResultA = simpleSim(fullInfra, pathA, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY);
        var simResultB = simpleSim(fullInfra, pathB, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY);

        record ConflictStatus(boolean spacing, boolean routing) {}

        var statusHist = new ArrayList<ConflictStatus>();
        for (int i = 0; i < 200; i += 4) {
            var conflicts = ConflictsKt.detectConflicts(List.of(
                    convertRequirements(0L, 0, simResultA.train),
                    convertRequirements(1L, (double) i, simResultB.train)
            ));
            var spacingConflict = false;
            var routingConflict = false;
            for (var conflict : conflicts)
                switch (conflict.conflictType) {
                    case SPACING -> spacingConflict = true;
                    case ROUTING -> routingConflict = true;
                }
            var conflictStatus = new ConflictStatus(spacingConflict, routingConflict);
            if (statusHist.size() != 0 && statusHist.get(statusHist.size() - 1).equals(conflictStatus))
                continue;
            statusHist.add(conflictStatus);
        }
        var expectedStatusHist = List.of(
                new ConflictStatus(true, true),
                new ConflictStatus(false, true),
                new ConflictStatus(false, false)
        );
        assertIterableEquals(expectedStatusHist, statusHist);
    }
}
