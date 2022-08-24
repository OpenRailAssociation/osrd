package fr.sncf.osrd.envelope_sim_infra;

import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.*;
import static fr.sncf.osrd.infra.InfraHelpers.getSignalingRoute;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeDebug;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim_infra.ertms.etcs.BrakingCurves;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;
import java.util.List;

public class ETCSBrakingCurvesTest {

    @Test
    void testBrakingCurves() throws Exception {
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

        var mrsp = makeSimpleMRSP(testContext, 40);
        var ebdBrakingCurves = BrakingCurves.from(path, testRollingStock, TIME_STEP, mrsp);
        var plotBuilder = new EnvelopeDebug.PlotBuilder();
        for (var curve : ebdBrakingCurves) {
            plotBuilder.add(Envelope.make(curve), "A");
        }
        plotBuilder.add(mrsp, "mrsp");
        plotBuilder.plot();
        var numberOfDetectors = path.detectors().size();
        var numberOfCurves = ebdBrakingCurves.size();
        assertEquals(2 * numberOfDetectors, numberOfCurves);
    }
}
