package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.Helpers.fullInfraFromRJS;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.infra.InfraHelpers.getSignalingRoute;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.envelope_sim.SimpleContextBuilder;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import java.util.List;

public class ConflictDetectionTest {
    @Test
    public void testRequirements() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");
        var fullInfra = fullInfraFromRJS(rjsInfra);
        var infra = fullInfra.java();

        // A path from the center track of south-west station to the center-top track of mid west station
        var path = TrainPathBuilder.from(
                List.of(
                        getSignalingRoute(infra, "rt.buffer_stop.1->DA0"),
                        getSignalingRoute(infra, "rt.DA0->DA6_1"),
                        getSignalingRoute(infra, "rt.DA6_1->DA6_2"),
                        getSignalingRoute(infra, "rt.DA6_2->DA6_3"),
                        getSignalingRoute(infra, "rt.DA6_3->DA6_4"),
                        getSignalingRoute(infra, "rt.DA6_4->DA6_5"),
                        getSignalingRoute(infra, "rt.DA6_5->DA5"),
                        getSignalingRoute(infra, "rt.DA5->DC5")
                ),
                new TrackLocation(infra.getTrackSection("TA1"), 146.6269028126681),
                new TrackLocation(infra.getTrackSection("TC1"), 444.738508351214)
        );

        var testContext = SimpleContextBuilder.makeSimpleContext(path.length(), 0);
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var envelope = makeSimpleMaxEffortEnvelope(
                testContext,
                testRollingStock.maxSpeed, new double[]{}
        );
        // We only check that no assertion is thrown in the validation
        var schedule = new StandaloneTrainSchedule(
                testRollingStock, 0, List.of(), List.of(), List.of(),
                "test", RollingStock.Comfort.STANDARD, null, null
        );

        var result = ScheduleMetadataExtractor.run(envelope, path, schedule, fullInfra);
        var spacingRequirements = result.spacingRequirements;

        // ensure spacing requirements span the entire trip duration
        var firstSpacingRequirement = spacingRequirements.get(0);
        Assertions.assertEquals(firstSpacingRequirement.beginTime, 0.0);
        for (int i = 0; i < spacingRequirements.size() - 1; i++) {
            var curReq = spacingRequirements.get(i);
            var nextReq = spacingRequirements.get(i + 1);
            Assertions.assertTrue(curReq.endTime > nextReq.beginTime);
        }
        var lastSpacingRequirement = spacingRequirements.get(spacingRequirements.size() - 1);
        Assertions.assertEquals(lastSpacingRequirement.endTime, envelope.getTotalTime(), 0.001);
    }
}
