package fr.sncf.osrd.train;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.railjson.schema.schedule.RJSLegacyAllowance.MarginType.PERCENTAGE;
import static fr.sncf.osrd.simulation.Simulation.timeStep;
import static fr.sncf.osrd.speedcontroller.SpeedInstructionsTests.isLate;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.infra.StopActionPoint;
import fr.sncf.osrd.railjson.schema.schedule.RJSLegacyAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.speedcontroller.CoastingSpeedController;
import fr.sncf.osrd.speedcontroller.MarginTests;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import java.util.stream.Collectors;

public class StopTests {

    static double lastTrainPosition(Iterable<TimelineEvent> events) {
        return getSpeedPerPosition(events).lastKey();
    }

    @Test
    public void testResumeAfterStop() {
        var configWithStops = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var schedule : configWithStops.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(1000., null, 10),
                    new RJSTrainStop(-1., null, 1)
            };
        var eventsWithStops = configWithStops.run();
        var lastPositionWithStop = lastTrainPosition(eventsWithStops);

        var configNoStop = TestConfig.readResource("tiny_infra/config_railjson.json");
        var eventsNoStops = configNoStop.run();
        var lastPositionNoStop = lastTrainPosition(eventsNoStops);

        assertEquals(lastPositionNoStop, lastPositionWithStop, 0.1);
    }

    @Test
    public void testStopDuration() {
        var durationStopShort = 10;
        var durationStopLong = 100;

        final var configShort = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var train : configShort.rjsSimulation.trainSchedules)
            train.stops = new RJSTrainStop[]{
                    new RJSTrainStop(1000., null, durationStopShort),
                    new RJSTrainStop(-1., null, 1)
            };

        final var configLong = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var train : configLong.rjsSimulation.trainSchedules)
            train.stops = new RJSTrainStop[]{
                    new RJSTrainStop(1000., null, durationStopLong),
                    new RJSTrainStop(-1., null, 1)
            };

        var preparedShort = configShort.prepare();
        preparedShort.run();
        var timeShort = preparedShort.sim.getTime();

        var preparedLong = configLong.prepare();
        preparedLong.run();
        var timeLong = preparedLong.sim.getTime();

        assertEquals(timeShort - durationStopShort, timeLong - durationStopLong, 0.1);
    }

    @Test
    public void testStopDurationNull() {
        final var configStop = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var train : configStop.rjsSimulation.trainSchedules)
            train.stops = new RJSTrainStop[]{
                    new RJSTrainStop(2000., null, 100),
                    new RJSTrainStop(1000., null, 0),
                    new RJSTrainStop(-1., null, 1)
            };
        final var configNoStop = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var train : configNoStop.rjsSimulation.trainSchedules)
                train.stops = new RJSTrainStop[]{
                        new RJSTrainStop(2000., null, 100),
                        new RJSTrainStop(-1., null, 1)
                };
        var preparedStops = configStop.prepare();
        preparedStops.run();
        var timeWithStop = preparedStops.sim.getTime();

        var preparedNoStops = configNoStop.prepare();
        preparedNoStops.run();
        var timeNoStop = preparedNoStops.sim.getTime();

        assertEquals(timeWithStop, timeNoStop, 0.5);
    }

    @Test
    public void testStopEndDurationNull() {
        final var config = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var train : config.rjsSimulation.trainSchedules)
            train.stops = new RJSTrainStop[]{
                    new RJSTrainStop(1000., null, 0),
                    new RJSTrainStop(-1., null, 0)
            };

        var prepared = config.prepare();
        prepared.run();

        var lastSpeed = prepared.sim.trains.get("Test.").getLastState().speed;
        assertTrue(lastSpeed > 30);
    }

    @Test
    public void testCorrectExpectedTimes() {
        final var config = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var train : config.rjsSimulation.trainSchedules)
            train.stops = new RJSTrainStop[]{
                    new RJSTrainStop(200., null, 10),
                    new RJSTrainStop(1000., null, 10),
                    new RJSTrainStop(3000., null, 0),
                    new RJSTrainStop(5000., null, 60),
                    new RJSTrainStop(-1., null, 1)
            };

        var preparedSim = config.prepare();
        var sim = preparedSim.sim;
        for (int i = 10; i < 150; i++) {
            makeAssertEvent(sim, i, () -> !isLate(sim));
        }
        preparedSim.run();
    }

    @Test
    public void testNoStopWhenNegativeOrZeroTimes() {
        final var configWithStops = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var schedule : configWithStops.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[] {
                    new RJSTrainStop(200., null, -1),
                    new RJSTrainStop(1000., null, 0),
                    new RJSTrainStop(3000., null, -1),
                    new RJSTrainStop(5000., null, 0),
                    new RJSTrainStop(-1., null, 1)
            };
        var preparedWithStops = configWithStops.prepare();
        var eventsWithStops = preparedWithStops.run();
        var lastPositionWithStop = lastTrainPosition(eventsWithStops);
        var timeWithStops = preparedWithStops.sim.getTime();

        final var configNoStops = TestConfig.readResource("tiny_infra/config_railjson.json");
        var preparedConfigNoStops = configNoStops.prepare();
        var eventsNoStop = preparedConfigNoStops.run();
        var lastPositionNoStop = lastTrainPosition(eventsNoStop);
        var timeNoStop = preparedConfigNoStops.sim.getTime();

        assertEquals(lastPositionNoStop, lastPositionWithStop, timeStep * 2 + lastPositionNoStop * 0.01);
        assertEquals(timeWithStops, timeNoStop, timeStep * 2 + timeWithStops * 0.01);
    }

    @Test
    public void testCorrectNumberGeneratedEvents() {
        final var config = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var schedule : config.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(200., null, -1),
                    new RJSTrainStop(1000., null, 0),
                    new RJSTrainStop(3000., null, 10),
                    new RJSTrainStop(5000., null, -1),
                    new RJSTrainStop(6000., null, 0),
                    new RJSTrainStop(-1., null, 1)
            };

        var events = config.run();
        var nStops = events.stream()
                .filter(event -> event instanceof StopActionPoint.RestartTrainEvent)
                .count();
        assertEquals(6, nStops);
    }

    @Disabled
    @Test
    public void testStopWithLinearMargin() {
        var durationStopShort = 10;
        var durationStopLong = 100;
        double value = 10;
        var allowance = new RJSLegacyAllowance.Linear(PERCENTAGE, value);

        final var configWithShortStop =
                TestConfig.readResource("tiny_infra/config_railjson.json").clearAllowances();

        for (var schedule : configWithShortStop.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(5000., null, durationStopShort),
                    new RJSTrainStop(-1., null, 1)
            };

        var testWithShortStop =
                MarginTests.ComparativeTest.from(
                        configWithShortStop, () -> configWithShortStop.setAllAllowances(allowance)
                );

        final var configWithLongStop =
                TestConfig.readResource("tiny_infra/config_railjson.json").clearAllowances();

        for (var schedule : configWithLongStop.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(5000., null, durationStopLong),
                    new RJSTrainStop(-1., null, 1)
            };

        var testWithLongStop =
                MarginTests.ComparativeTest.from(
                        configWithLongStop, () -> configWithLongStop.setAllAllowances(allowance)
                );

        var timeShortStopNoMargin = testWithShortStop.baseTime();
        var timeShortStopWithMargin = testWithShortStop.testedTime();
        var timeLongStopNoMargin = testWithLongStop.baseTime();
        var timeLongStopWithMargin = testWithLongStop.testedTime();

        var expectedTimeShortStopWithMargin = timeShortStopNoMargin * (1 + value / 100);
        assertEquals(
                expectedTimeShortStopWithMargin,
                timeShortStopWithMargin,
                expectedTimeShortStopWithMargin * 0.01);
        var expectedTimeLongStopNoMargin = timeShortStopNoMargin - durationStopShort + durationStopLong;
        assertEquals(
                expectedTimeLongStopNoMargin,
                timeLongStopNoMargin,
                expectedTimeLongStopNoMargin * 0.01);
        var expectedTimeLongStopWithMargin =
                timeShortStopNoMargin * (1 + value / 100) - durationStopShort + durationStopLong;
        assertEquals(
                expectedTimeLongStopWithMargin,
                timeLongStopWithMargin,
                expectedTimeLongStopWithMargin * 0.01);
    }

    @Test
    public void testStopWithConstructionMargin() {
        var durationStopShort = 10;
        var durationStopLong = 100;
        double value = 30;
        final double begin = 3000;
        final double end = 5000;

        var allowance = new RJSLegacyAllowance.Construction(value);
        allowance.beginPosition = begin;
        allowance.endPosition = end;

        final var configWithShortStop = TestConfig.readResource("tiny_infra/config_railjson.json").clearAllowances();

        for (var schedule : configWithShortStop.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(5000., null, durationStopShort),
                    new RJSTrainStop(-1., null, 1)
            };

        var testWithShortStop =
                MarginTests.ComparativeTest.from(
                        configWithShortStop, () -> configWithShortStop.setAllAllowances(allowance)
                );

        final var configWithLongStop =
                TestConfig.readResource("tiny_infra/config_railjson.json").clearAllowances();

        for (var schedule : configWithLongStop.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(5000., null, durationStopLong),
                    new RJSTrainStop(-1., null, 1)
            };

        var testWithLongStop =
                MarginTests.ComparativeTest.from(
                        configWithLongStop, () -> configWithLongStop.setAllAllowances(allowance)
                );

        var timeShortStopNoMargin = testWithShortStop.baseTime();
        var timeShortStopWithMargin = testWithShortStop.testedTime();
        var timeLongStopNoMargin = testWithLongStop.baseTime();
        var timeLongStopWithMargin = testWithLongStop.testedTime();

        var expectedTimeShortStopWithMargin = timeShortStopNoMargin + value;
        assertEquals(expectedTimeShortStopWithMargin, timeShortStopWithMargin, expectedTimeShortStopWithMargin * 0.01);
        var expectedTimeLongStopNoMargin = timeShortStopNoMargin - durationStopShort + durationStopLong;
        assertEquals(expectedTimeLongStopNoMargin, timeLongStopNoMargin, expectedTimeLongStopNoMargin * 0.01);
        var expectedTimeLongStopWithMargin = timeShortStopNoMargin + value - durationStopShort + durationStopLong;
        assertEquals(expectedTimeLongStopWithMargin, timeLongStopWithMargin, expectedTimeLongStopWithMargin * 0.01);
    }

    @Test
    public void testStopWithMareco() {
        var durationStopShort = 10;
        var durationStopLong = 100;
        double value = 10;
        final var allowance = new RJSLegacyAllowance.Mareco(PERCENTAGE, value);

        final var baseConfig = TestConfig.readResource("tiny_infra/config_railjson.json").clearAllowances();
        for (var schedule : baseConfig.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(5000., null, 1e-3),
                    new RJSTrainStop(-1., null, 1)
            };
        final var test = baseConfig.prepare();
        test.run();
        final var baseTime = test.sim.getTime();

        final var configWithShortStop = TestConfig.readResource("tiny_infra/config_railjson.json").clearAllowances();

        for (var schedule : configWithShortStop.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(5000., null, durationStopShort),
                    new RJSTrainStop(-1., null, 1)
            };

        var testWithShortStop =
                MarginTests.ComparativeTest.from(
                        configWithShortStop, () -> configWithShortStop.setAllAllowances(allowance)
                );

        final var configWithLongStop =
                TestConfig.readResource("tiny_infra/config_railjson.json").clearAllowances();

        for (var schedule : configWithLongStop.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(5000., null, durationStopLong),
                    new RJSTrainStop(-1., null, 1)
            };

        var testWithLongStop =
                MarginTests.ComparativeTest.from(
                        configWithLongStop, () -> configWithLongStop.setAllAllowances(allowance)
                );

        final var timeShortStopNoMargin = testWithShortStop.baseTime();
        final var timeShortStopWithMargin = testWithShortStop.testedTime();
        final var timeLongStopNoMargin = testWithLongStop.baseTime();
        final var timeLongStopWithMargin = testWithLongStop.testedTime();

        var expectedTimeShortStopNoMargin = baseTime + durationStopShort;
        assertEquals(
                expectedTimeShortStopNoMargin,
                timeShortStopNoMargin,
                expectedTimeShortStopNoMargin * 0.01);
        var expectedTimeShortStopWithMargin = baseTime * (1 + value / 100) + durationStopShort;
        assertEquals(
                expectedTimeShortStopWithMargin,
                timeShortStopWithMargin,
                expectedTimeShortStopWithMargin * 0.01);
        var expectedTimeLongStopNoMargin = baseTime + durationStopLong;
        assertEquals(
                expectedTimeLongStopNoMargin,
                timeLongStopNoMargin,
                expectedTimeLongStopNoMargin * 0.01);
        var expectedTimeLongStopWithMargin =
                baseTime * (1 + value / 100) + durationStopLong;
        assertEquals(
                expectedTimeLongStopWithMargin,
                timeLongStopWithMargin,
                expectedTimeLongStopWithMargin * 0.01);
    }

    @Test
    public void testMarecoMultipleStops(TestInfo info) {
        var durationStop = 10;
        double value = 10;
        final var allowance =
                new RJSLegacyAllowance.Mareco(PERCENTAGE, value);

        final var config = TestConfig.readResource("tiny_infra/config_railjson.json")
                .clearAllowances()
                .clearSlopes()
                .setGlobalSpeedLimit(15);

        for (var schedule : config.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(2000., null, durationStop),
                    new RJSTrainStop(3000., null, durationStop),
                    new RJSTrainStop(4000., null, durationStop),
                    new RJSTrainStop(5000., null, durationStop),
                    new RJSTrainStop(7000., null, durationStop),
                    new RJSTrainStop(-1., null, 1)
            };

        var test = MarginTests.ComparativeTest.from(
                config, () -> config.setAllAllowances(allowance)
        );
        test.saveGraphs(info);

        var schedule = test.testedState.schedules.get(0);
        var coastingSpeedControllers = schedule.speedInstructions.targetSpeedControllers.stream()
                .filter(sc -> sc instanceof CoastingSpeedController)
                .collect(Collectors.toSet());
        var nCoastingSpeedControllers = coastingSpeedControllers.size();
        // make sure 6 coastingSpeedControllers are generated, one for each stop
        assertEquals(6, nCoastingSpeedControllers);
    }

    @Test
    public void testMarecoDistributionMultipleStops(TestInfo info) {
        var durationStop = 1000;
        double value = 10;

        final var allowance =
                new RJSLegacyAllowance.Mareco(PERCENTAGE, value);

        final var config = TestConfig.readResource("tiny_infra/config_railjson.json")
                .clearAllowances()
                .clearSlopes();

        for (var schedule : config.rjsSimulation.trainSchedules)
            schedule.stops = new RJSTrainStop[]{
                    new RJSTrainStop(2000., null, durationStop),
                    new RJSTrainStop(3000., null, durationStop),
                    new RJSTrainStop(4000., null, durationStop),
                    new RJSTrainStop(5000., null, durationStop),
                    new RJSTrainStop(7000., null, durationStop),
                    new RJSTrainStop(-1., null, 1)
            };

        var test = MarginTests.ComparativeTest.from(
                config, () -> config.setAllAllowances(allowance)
        );

        var timePerPosition = getTimePerPosition(test.baseEvents);
        var timePerPositionAllowance = getTimePerPosition(test.testedEvents);
        var stopPositions = test.baseState.getTrains().get(0).schedule.stops.stream()
                .map(stop -> stop.position)
                .collect(Collectors.toList());
        var beginArea = 0.;
        for (var endArea : stopPositions) {
            var baseTime = timePerPosition.interpolate(endArea) - timePerPosition.interpolate(beginArea);
            var allowanceTime = timePerPositionAllowance.interpolate(endArea)
                    - timePerPositionAllowance.interpolate(beginArea);
            var expectedTime = baseTime * (1 + value / 100);
            assertEquals(expectedTime, allowanceTime, expectedTime * 0.1 + 2 * timeStep);
            beginArea = endArea;
        }
    }
}

