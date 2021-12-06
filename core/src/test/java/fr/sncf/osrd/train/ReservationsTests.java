package fr.sncf.osrd.train;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
        var config = TestConfig.readResource("one_line/infra.json", "one_line/simulation.json");
        for (var signal : config.rjsInfra.signals) {
            var member = new RJSRSExpr.AspectSet.AspectSetMember(new ID<>("GREEN"), null);
            var members = new RJSRSExpr.AspectSet.AspectSetMember[]{member};
            signal.expr = new RJSRSExpr.AspectSet(members);
        }
        var schedules = config.rjsSimulation.trainSchedules;
        var firstSchedule = schedules.get(0);
        schedules.add(new RJSTrainSchedule(
                "Test.2",
                firstSchedule.rollingStock,
                20, // The first train is close to the end
                firstSchedule.initialHeadLocation,
                60,
                firstSchedule.phases,
                firstSchedule.trainControlMethod,
                firstSchedule.allowances,
                firstSchedule.stops,
                firstSchedule.routes,
                null,
                0,
                null
        ));
        var prepared = config.prepare();
        var error = assertThrows(SimulationError.class, prepared::runWithExceptions);
        assertTrue(error.getMessage().contains("Impossible to reserve"));
    }
}
