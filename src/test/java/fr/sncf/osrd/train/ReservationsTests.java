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
            assert route.isControlled == includesSwitch;
        }
    }

    /** function to set arbitrary reservation status given the id */
    private static Optional<Boolean> isReserved(String id) {
        if (id.hashCode() % 3 == 0)
            return Optional.of(true);
        if (id.hashCode() % 3 == 1)
            return Optional.of(false);
        return Optional.empty();
    }

    @Test
    public void testControlledRoutesSpecified() {
        var config = TestConfig.readResource("tiny_infra/config_railjson.json");

        for (var route : config.rjsInfra.routes) {
            route.isControlled = isReserved(route.id).orElse(null);
        }
        var simState = config.prepare();

        var infra = simState.infra;

        for (var route : infra.routeGraph.routeMap.values()) {
            var shouldBeControlled = isReserved(route.id).orElse(null);
            // only checks if not left unspecified
            assert shouldBeControlled == null || route.isControlled == shouldBeControlled;
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
                firstSchedule.routes
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
