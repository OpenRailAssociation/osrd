package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static fr.sncf.osrd.infra.InfraHelpers.getSignalingRoute;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.SignalizationEngine;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.infra_state.implementation.standalone.StandaloneSignalingSimulation;
import fr.sncf.osrd.infra_state.implementation.standalone.StandaloneState;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public class ScheduleMetadataExtractorTests {

    @Test
    public void tinyInfraTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var barA = infra.getTrackSection("ne.micro.bar_a");
        var fooA = infra.getTrackSection("ne.micro.foo_a");
        var path = TrainPathBuilder.from(
                List.of(
                        getSignalingRoute(infra, "rt.buffer_stop_c->tde.track-bar"),
                        getSignalingRoute(infra, "rt.tde.track-bar->tde.switch_foo-track"),
                        getSignalingRoute(infra, "rt.tde.switch_foo-track->buffer_stop_a")
                ),
                new TrackLocation(barA, 200),
                new TrackLocation(fooA, 0)
        );
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testContext = new EnvelopeSimContext(testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        var timings = ScheduleMetadataExtractor.makeRouteOccupancy(infra, envelope, path, testRollingStock.length);

        var routePath = path.routePath();
        for (int i = 0; i < routePath.size(); i++) {
            var signalingRoute = routePath.get(i).element();
            var route = signalingRoute.getInfraRoute();
            var offset = routePath.get(i).pathOffset();
            var occupiedPosition = Math.max(0, offset);
            assertEquals(
                    envelope.interpolateTotalTime(occupiedPosition),
                    timings.get(route.getID()).timeHeadOccupy
            );
            var freePosition = Math.min(path.length(), offset + route.getLength() + testRollingStock.length);
            if (i < routePath.size() - 1 && signalingRoute instanceof BAL3.BAL3Route bal3Route) {
                if (bal3Route.entrySignal() != null) {
                    var nextRoute = routePath.get(i + 1);
                    freePosition = Math.min(
                            path.length(),
                            nextRoute.pathOffset()
                                    + nextRoute.element().getInfraRoute().getLength()
                                    + testRollingStock.length
                    );
                }
            }
            assertEquals(
                    envelope.interpolateTotalTime(freePosition),
                    timings.get(route.getID()).timeTailFree
            );
        }
    }

    @Test
    public void tinyInfraEndsInMiddleRoutesTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var barA = infra.getTrackSection("ne.micro.bar_a");
        var fooA = infra.getTrackSection("ne.micro.foo_a");
        var path = TrainPathBuilder.from(
                List.of(
                        getSignalingRoute(infra, "rt.buffer_stop_c->tde.track-bar"),
                        getSignalingRoute(infra, "rt.tde.track-bar->tde.switch_foo-track"),
                        getSignalingRoute(infra, "rt.tde.switch_foo-track->buffer_stop_a")
                ),
                new TrackLocation(barA, 100),
                new TrackLocation(fooA, 100)
        );
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testContext = new EnvelopeSimContext(testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        // We only check that no assertion is thrown in the validation
        ScheduleMetadataExtractor.makeRouteOccupancy(infra, envelope, path, testRollingStock.length);
    }

    @Test
    public void veryLongTrainTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var barA = infra.getTrackSection("ne.micro.bar_a");
        var fooA = infra.getTrackSection("ne.micro.foo_a");
        var path = TrainPathBuilder.from(
                List.of(
                        getSignalingRoute(infra, "rt.buffer_stop_c->tde.track-bar"),
                        getSignalingRoute(infra, "rt.tde.track-bar->tde.switch_foo-track"),
                        getSignalingRoute(infra, "rt.tde.switch_foo-track->buffer_stop_a")
                ),
                new TrackLocation(barA, 100),
                new TrackLocation(fooA, 100)
        );
        var testRollingStock = TestTrains.VERY_LONG_FAST_TRAIN;
        var testContext = new EnvelopeSimContext(testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        // We only check that no assertion is thrown in the validation
        ScheduleMetadataExtractor.makeRouteOccupancy(infra, envelope, path, testRollingStock.length);
    }

    @Test
    public void oneLineInfraTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("one_line/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var routes = new ArrayList<SignalingRoute>();
        routes.add(getSignalingRoute(infra, "rt.buffer_stop.0->detector.0"));
        for (int i = 0; i < 9; i++)
            routes.add(getSignalingRoute(infra, String.format("rt.detector.%d->detector.%d", i, i + 1)));
        routes.add(getSignalingRoute(infra, "rt.detector.9->buffer_stop.1"));
        var path = TrainPathBuilder.from(
                routes,
                new TrackLocation(infra.getTrackSection("track.0"), 0),
                new TrackLocation(infra.getTrackSection("track.9"), 0)
        );
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testContext = new EnvelopeSimContext(testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        // We only check that no assertion is thrown in the validation
        ScheduleMetadataExtractor.makeRouteOccupancy(infra, envelope, path, testRollingStock.length);
    }

    @Test
    public void veryShortPathTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("one_line/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var routes = List.of(getSignalingRoute(infra, "rt.buffer_stop.0->detector.0"));
        var path = TrainPathBuilder.from(
                routes,
                new TrackLocation(infra.getTrackSection("track.0"), 0),
                new TrackLocation(infra.getTrackSection("track.0"), 10)
        );
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testContext = new EnvelopeSimContext(testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        // We only check that no assertion is thrown in the validation
        ScheduleMetadataExtractor.makeRouteOccupancy(infra, envelope, path, testRollingStock.length);
    }

    @Test
    public void tinyInfraSignalUpdatesTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var barA = infra.getTrackSection("ne.micro.bar_a");
        var fooA = infra.getTrackSection("ne.micro.foo_a");
        var path = TrainPathBuilder.from(
                List.of(
                        getSignalingRoute(infra, "rt.buffer_stop_c->tde.track-bar"),
                        getSignalingRoute(infra, "rt.tde.track-bar->tde.switch_foo-track"),
                        getSignalingRoute(infra, "rt.tde.switch_foo-track->buffer_stop_a")
                ),
                new TrackLocation(barA, 100),
                new TrackLocation(fooA, 100)
        );
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testContext = new EnvelopeSimContext(testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        checkSignalUpdates(infra, envelope, path, testRollingStock.length);
    }

    @Test
    public void oneLineInfraSignalTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("one_line/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var routes = new ArrayList<SignalingRoute>();
        routes.add(getSignalingRoute(infra, "rt.buffer_stop.0->detector.0"));
        for (int i = 0; i < 9; i++)
            routes.add(getSignalingRoute(infra, String.format("rt.detector.%d->detector.%d", i, i + 1)));
        routes.add(getSignalingRoute(infra, "rt.detector.9->buffer_stop.1"));
        var path = TrainPathBuilder.from(
                routes,
                new TrackLocation(infra.getTrackSection("track.0"), 0),
                new TrackLocation(infra.getTrackSection("track.9"), 0)
        );
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testContext = new EnvelopeSimContext(testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        checkSignalUpdates(infra, envelope, path, testRollingStock.length);
    }

    /** Checks that the generated signal updates are valid */
    private static void checkSignalUpdates(
            SignalingInfra infra,
            Envelope envelope,
            TrainPath path,
            double trainLength
    ) {
        var updates = ScheduleMetadataExtractor.makeSignalUpdates(infra, envelope, path, trainLength);
        var simplifiedUpdates = updates.stream()
                .map(u -> new SimplifiedUpdate(u.signalID, u.timeStart, u.color))
                .collect(Collectors.toSet());

        var infraState = StandaloneState.from(path, trainLength);
        var signalizationEngine = SignalizationEngine.from(infra, infraState);
        var events = StandaloneSignalingSimulation.run(path, infraState, signalizationEngine, envelope);

        // Check that every signal change is seen in the updates
        for (var e : events) {
            if (e.position() < path.length()
                    && !e.state().isFree()
                    && !e.state().equals(e.signal().getInitialState())) {
                assertTrue(simplifiedUpdates.contains(
                        new SimplifiedUpdate(e.signal().getID(), e.time(), e.state().getRGBColor()))
                );
            }
        }

        // Checks that the updates are consistent
        for (var u : updates) {
            assertTrue(u.timeStart >= 0);
            assertTrue(u.timeEnd <= envelope.getTotalTime());
        }
        var maxEndTime = updates.stream().mapToDouble(u -> u.timeEnd).max().orElse(0);
        var maxStartTime = updates.stream().mapToDouble(u -> u.timeStart).max().orElse(0);
        assertEquals(envelope.getTotalTime(), maxEndTime, 1e-5);
        assertTrue(maxStartTime < envelope.getTotalTime());

        // Checks that there is no overlapping state
        for (var signal : infra.getSignalMap().values()) {
            var signalUpdates = updates.stream()
                    .filter(u -> u.signalID.equals(signal.getID()))
                    .sorted(Comparator.comparingDouble(u -> u.timeStart))
                    .toList();
            for (int i = 1; i < signalUpdates.size(); i++)
                assertTrue(signalUpdates.get(i - 1).timeEnd <= signalUpdates.get(i).timeStart);
        }
    }


    private record SimplifiedUpdate(String id, double time, int color){}
}
