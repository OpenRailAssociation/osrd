package fr.sncf.osrd.train;

import fr.sncf.osrd.TestConfig;
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
}
