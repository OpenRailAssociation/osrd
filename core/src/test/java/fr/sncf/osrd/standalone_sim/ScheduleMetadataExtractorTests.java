package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.TIME_STEP;
import static fr.sncf.osrd.infra.InfraHelpers.getSignalingRoute;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeSimContextBuilder;
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
        var testContext = EnvelopeSimContextBuilder.build(
                testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP, RollingStock.Comfort.STANDARD);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        makeRouteOccupancy(path, testRollingStock, envelope);
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
        var testContext = EnvelopeSimContextBuilder.build(
                testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP, RollingStock.Comfort.STANDARD);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        // We only check that no assertion is thrown in the validation
        makeRouteOccupancy(path, testRollingStock, envelope);
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
        var testContext = EnvelopeSimContextBuilder.build(
                testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP, RollingStock.Comfort.STANDARD);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        // We only check that no assertion is thrown in the validation
        makeRouteOccupancy(path, testRollingStock, envelope);
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
        var testContext = EnvelopeSimContextBuilder.build(
                testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP, RollingStock.Comfort.STANDARD);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        // We only check that no assertion is thrown in the validation
        makeRouteOccupancy(path, testRollingStock, envelope);
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
        var testContext = EnvelopeSimContextBuilder.build(
                testRollingStock, EnvelopeTrainPath.from(path), TIME_STEP, RollingStock.Comfort.STANDARD);
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        // We only check that no assertion is thrown in the validation
        makeRouteOccupancy(path, testRollingStock, envelope);
    }


    private static void makeRouteOccupancy(
            TrainPath path, RollingStock testRollingStock, Envelope envelope
    ) {
        ScheduleMetadataExtractor.makeRouteOccupancy(envelope, path, testRollingStock.length);
    }
}
