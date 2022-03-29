package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static fr.sncf.osrd.new_infra.InfraHelpers.getSignalingRoute;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.new_infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.new_infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.new_infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;

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
        var testContext = new EnvelopeSimContext(testRollingStock, EnvelopeTrainPath.fromNew(path), TIME_STEP);
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
}
