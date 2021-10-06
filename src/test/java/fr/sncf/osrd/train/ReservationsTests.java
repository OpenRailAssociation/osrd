package fr.sncf.osrd.train;

import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.simulation.SimulationError;
import org.junit.jupiter.api.Test;
import java.util.Optional;

public class ReservationsTests {

    @Test
    public void testControlledRoutesUnspecified() {
        var config = TestConfig.readResource("tiny_infra/config_railjson.json");
        var simState = config.prepare();

        var infra = simState.infra;

        for (var route : infra.routeGraph.routeMap.values()) {
            var includesSwitch = route.switchesGroup.size() > 0;
            assert route.isControlled() == includesSwitch;
        }
    }

    @Test
    public void testErrorIfTrainsOverlap() {
        // Forces all signals to green
        var config = TestConfig.readResource("one_line/config.json");
        for (var track : config.rjsInfra.trackSections) {
            for (var signal : track.signals) {
                var member = new RJSRSExpr.AspectSet.AspectSetMember(new ID<>("GREEN"), null);
                var members = new RJSRSExpr.AspectSet.AspectSetMember[]{member};
                signal.expr = new RJSRSExpr.AspectSet(members);
            }
        }
        var schedules = config.rjsSimulation.trainSchedules;
        var firstSchedule = schedules.get(0);
        schedules.add(new RJSTrainSchedule(
                "Test.2",
                firstSchedule.rollingStock,
                500, // The first train is close to the end
                firstSchedule.initialHeadLocation,
                40,
                firstSchedule.phases,
                firstSchedule.trainControlMethod,
                firstSchedule.allowances,
                firstSchedule.stops,
                firstSchedule.routes,
                null,
                0
        ));
        var prepared = config.prepare();
        var error = assertThrows(SimulationError.class, prepared::runWithExceptions);
        assert error.getMessage().contains("already occupied");
    }

    @Test
    public void testErrorIfTrainsCollide() {
        // Forces all signals to green
        var config = TestConfig.readResource("one_line/config.json");
        for (var track : config.rjsInfra.trackSections) {
            for (var signal : track.signals) {
                var member = new RJSRSExpr.AspectSet.AspectSetMember(new ID<>("GREEN"), null);
                var members = new RJSRSExpr.AspectSet.AspectSetMember[]{member};
                signal.expr = new RJSRSExpr.AspectSet(members);
            }
        }

        // Checks that an error is thrown when the trains collide
        var prepared = config.prepare();
        var error = assertThrows(SimulationError.class, prepared::runWithExceptions);
        assert error.getMessage().contains("already occupied");
    }
}
