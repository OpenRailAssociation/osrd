package fr.sncf.osrd.signalization;

import static fr.sncf.osrd.Helpers.makeAssertEvent;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.infra.signaling.AspectConstraint;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.train.TrainPath;
import org.junit.jupiter.api.Test;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class AspectConstraintTests {
    @Test
    public void testSwitchPosition() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json").prepare();
        var path = testConfig.schedules.get(0).plannedPath;
        assert path.switchPosition.size() == 1;
        assert path.switchPosition.get(0) == path.trackSectionPath.get(0).length();
    }

    @Test
    public void testSwitchPositionBackwards() throws InvalidSchedule {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json").prepare();
        var routeGraph = testConfig.infra.routeGraph;
        var routes = Stream.of(
                "rt.buffer_stop_c->tde.track-bar",
                "rt.tde.track-bar->tde.switch_foo-track",
                "rt.tde.switch_foo-track->buffer_stop_b"
        )
                .map(routeGraph.routeMap::get)
                .collect(Collectors.toList());
        var begin = routes.get(0).tvdSectionsPaths.get(0).trackSections[0].getBeginLocation();
        var end = routes.get(2).tvdSectionsPaths.get(1).trackSections[0].getEndLocation();
        var path = TrainPath.from(routes, begin, end);
        assert path.switchPosition.size() == 1;
        assert path.switchPosition.get(0) == path.length - path.trackSectionPath.get(2).length();
    }

    @Test
    public void testNextSwitch() {
        var constraintPosition = new AspectConstraint.ConstraintPosition(0,
                AspectConstraint.ConstraintPosition.Element.NEXT_SWITCH);
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json").prepare();
        var path = testConfig.schedules.get(0).plannedPath;
        var sim = testConfig.sim;
        makeAssertEvent(sim, 1, () -> {
            var train = testConfig.getTrains().get(0).getLastState();
            return constraintPosition.convert(train.currentPhaseState, train) == path.switchPosition.get(0);
        });
        testConfig.run();
        var train = testConfig.getTrains().get(0).getLastState();
        assert Double.isInfinite(constraintPosition.convert(train.currentPhaseState, train));
    }

    @Test
    public void testOffset() {
        var constraintPosition = new AspectConstraint.ConstraintPosition(42,
                AspectConstraint.ConstraintPosition.Element.NEXT_SWITCH);
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json").prepare();
        var path = testConfig.schedules.get(0).plannedPath;
        makeAssertEvent(testConfig.sim, 1, () -> {
            var train = testConfig.getTrains().get(0).getLastState();
            return constraintPosition.convert(train.currentPhaseState, train) == path.switchPosition.get(0) + 42;
        });
        testConfig.run();
    }
}
