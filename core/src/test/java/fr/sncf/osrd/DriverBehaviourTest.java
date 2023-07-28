package fr.sncf.osrd;

import fr.sncf.osrd.envelope_sim_infra.LegacyMRSP;
import fr.sncf.osrd.infra.InfraHelpers;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.implementation.tracks.directed.DirectedInfraBuilder;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSApplicableDirectionsTrackRange;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.train.TestTrains;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import java.util.HashMap;
import java.util.List;

public class DriverBehaviourTest {
    @Test
    public void mrspWithDriverBehaviour() {
        List<TrackRangeView> path = pathSenarioForTest();
        var testRollingStock = TestTrains.VERY_SHORT_FAST_TRAIN;
        var driverBehaviour = new DriverBehaviour(16, 17);
        var mrsp = LegacyMRSP.from(path, testRollingStock, true, null);
        mrsp = driverBehaviour.applyToMRSP(mrsp);
        Assertions.assertEquals(42, mrsp.interpolateSpeedRightDir(0, 1));
        Assertions.assertEquals(42, mrsp.interpolateSpeedRightDir(12, 1));
        Assertions.assertEquals(21, mrsp.interpolateSpeedRightDir(13, 1));
        Assertions.assertEquals(21, mrsp.interpolateSpeedRightDir(66, 1));
        Assertions.assertEquals(testRollingStock.maxSpeed, mrsp.interpolateSpeedRightDir(75, 1));
    }

    @NotNull
    private static List<TrackRangeView> pathSenarioForTest() {
        var rjsInfra = InfraHelpers.makeSingleTrackRJSInfra();
        rjsInfra.speedSections = List.of(
                new RJSSpeedSection("foo1", 42, new HashMap<>(), List.of(
                        new RJSApplicableDirectionsTrackRange(
                                "track",
                                ApplicableDirection.BOTH,
                                0, 30
                        )
                )),
                new RJSSpeedSection("foo2", 21, new HashMap<>(), List.of(
                        new RJSApplicableDirectionsTrackRange(
                                "track",
                                ApplicableDirection.START_TO_STOP,
                                30, 50
                        )
                )),
                new RJSSpeedSection("foo3", 30, new HashMap<>(), List.of(
                        new RJSApplicableDirectionsTrackRange(
                                "track",
                                ApplicableDirection.STOP_TO_START,
                                70, 100
                        )
                ))
        );
        var infra = DirectedInfraBuilder.fromRJS(rjsInfra, new DiagnosticRecorderImpl(true));
        var path = List.of(
                new TrackRangeView(0, 20, infra.getEdge("track", Direction.FORWARD)),
                new TrackRangeView(20, 50, infra.getEdge("track", Direction.FORWARD)),
                new TrackRangeView(50, 80, infra.getEdge("track", Direction.FORWARD))
        );
        return path;
    }
}
