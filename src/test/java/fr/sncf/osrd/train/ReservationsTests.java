package fr.sncf.osrd.train;

import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.sncf.osrd.TestConfig;
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
        var config = TestConfig.readResource("tiny_infra/config_railjson.json");
        var schedules = config.rjsSimulation.trainSchedules;
        var firstSchedule = schedules.get(0);
        schedules.add(new RJSTrainSchedule(
                "Test.2",
                firstSchedule.rollingStock,
                550, // The first train is close to the end
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
        assert error.getMessage().contains("reserved");
    }

    @Test
    public void testErrorIfTrainsCollide() {
        var config = TestConfig.readResource("one_line/config.json");
        var schedules = config.rjsSimulation.trainSchedules;
        for (var schedule : schedules)
            schedule.initialSpeed = 1000; // the trains go very fast on the same track in different directions
        var prepared = config.prepare();
        var error = assertThrows(SimulationError.class, prepared::runWithExceptions);
        assert error.getMessage().contains("already occupied");
    }
}
