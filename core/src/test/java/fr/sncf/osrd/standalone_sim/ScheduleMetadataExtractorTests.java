package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static fr.sncf.osrd.infra.InfraHelpers.getSignalingRoute;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeStopWrapper;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.standalone_sim.result.ResultOccupancyTiming;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.train.TrainStop;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class ScheduleMetadataExtractorTests {

    @Test
    public void tinyInfraTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = infraFromRJS(rjsInfra);
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
        var timings = makeRouteOccupancy(infra, path, testRollingStock, envelope);

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
        var infra = infraFromRJS(rjsInfra);
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
        makeRouteOccupancy(infra, path, testRollingStock, envelope);
    }

    @Test
    public void veryLongTrainTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = infraFromRJS(rjsInfra);
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
        makeRouteOccupancy(infra, path, testRollingStock, envelope);
    }

    @Test
    public void oneLineInfraTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("one_line/infra.json");
        var infra = infraFromRJS(rjsInfra);
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
        makeRouteOccupancy(infra, path, testRollingStock, envelope);
    }

    @Test
    public void veryShortPathTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("one_line/infra.json");
        var infra = infraFromRJS(rjsInfra);
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
        makeRouteOccupancy(infra, path, testRollingStock, envelope);
    }

    @Test
    public void tinyInfraSignalUpdatesTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = infraFromRJS(rjsInfra);
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
        var infra = infraFromRJS(rjsInfra);
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
        checkStopDelay(infra, envelope, path, testRollingStock.length);
    }

    /** Tests that the signaling events are properly delayed after a stop */
    private void checkStopDelay(SignalingInfra infra, Envelope envelope, TrainPath path, double length) {
        var envelopeWithStops = new EnvelopeStopWrapper(envelope, List.of(new TrainStop(1000, 4242)));
        var eventsWithStop = ScheduleMetadataExtractor.computeEvents(
                infra,
                path,
                length,
                envelopeWithStops
        );
        var eventsWithoutStop = ScheduleMetadataExtractor.computeEvents(
                infra,
                path,
                length,
                envelope
        );

        assertEquals(eventsWithStop.size(), eventsWithoutStop.size());
        for (int i = 0; i < eventsWithStop.size(); i++) {
            var eventWithStop = eventsWithStop.get(i);
            var eventWithoutStop = eventsWithoutStop.get(i);
            assertEquals(eventWithStop.position(), eventWithoutStop.position());
            if (eventWithStop.position() < 1000)
                assertEquals(eventWithoutStop.time(), eventWithStop.time());
            else
                assertEquals(eventWithoutStop.time() + 4242, eventWithStop.time());
        }
    }

    /** Checks that the generated signal updates are valid */
    private static void checkSignalUpdates(
            SignalingInfra infra,
            Envelope envelope,
            TrainPath path,
            double trainLength
    ) {
        var events = ScheduleMetadataExtractor.computeEvents(infra, path, trainLength, envelope);
        var updates = ScheduleMetadataExtractor.makeSignalUpdates(envelope, path, events);
        var simplifiedUpdates = updates.stream()
                .map(u -> new SimplifiedUpdate(u.signalID, u.timeStart, u.color))
                .collect(Collectors.toSet());

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

        // Checks that the signals are set to "open" from the moment they're seen
        for (var route : path.routePath()) {
            var signal = route.element().getEntrySignal();
            if (signal == null)
                continue;
            var seen = Math.max(0, route.pathOffset() - signal.getSightDistance());
            if (seen > 0)
                assertTrue(simplifiedUpdates.contains(new SimplifiedUpdate(
                        signal.getID(),
                        envelope.interpolateTotalTime(seen),
                        signal.getLeastRestrictiveState().getRGBColor()
                )));
        }
    }

    private static Map<String, ResultOccupancyTiming> makeRouteOccupancy(
            SignalingInfra infra, TrainPath path, RollingStock testRollingStock, Envelope envelope
    ) {
        var events = ScheduleMetadataExtractor.computeEvents(infra, path, testRollingStock.length, envelope);
        return ScheduleMetadataExtractor.makeRouteOccupancy(infra, envelope, path, testRollingStock.length, events);
    }


    private record SimplifiedUpdate(String id, double time, int color){}
}
