package fr.sncf.osrd.envelope_sim_infra;

import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.*;
import static fr.sncf.osrd.infra.InfraHelpers.getSignalingRoute;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeDebug;
import fr.sncf.osrd.envelope.EnvelopeTestUtils;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.FlatPath;
import fr.sncf.osrd.envelope_sim_infra.ertms.etcs.BrakingCurves;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSStandaloneTrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.train.TrainStop;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class ETCSBrakingCurvesTest {

    @Test
    void testEBDBrakingCurves() throws Exception {
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
        var stops = new ArrayList<TrainStop>();
        stops.add(new TrainStop(path.length(), 0.1));
        stops.add(new TrainStop(path.length() / 2, 0.1));

        var schedule = new StandaloneTrainSchedule(testRollingStock, 0, stops, null, null);
        var mrsp = makeSimpleMRSP(testContext, 40);
        var ebdBrakingCurves = BrakingCurves.from(path, schedule, TIME_STEP, mrsp);
        var plotBuilder = new EnvelopeDebug.PlotBuilder();
        for (var curve : ebdBrakingCurves) {
            plotBuilder.add(Envelope.make(curve), "A");
        }
        plotBuilder.add(mrsp, "mrsp");
        plotBuilder.plot();
        var numberOfDetectors = path.detectors().size();
        var numberOfStops = stops.size();
        var numberOfCurves = ebdBrakingCurves.size();
        assertEquals(numberOfCurves, numberOfDetectors + numberOfStops);
    }
}
