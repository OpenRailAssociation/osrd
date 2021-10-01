package fr.sncf.osrd.train;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.speedcontroller.SpeedInstructionsTests.isLate;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.StopActionPoint;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.TimelineEvent;
import org.junit.jupiter.api.Test;

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
                    new RJSTrainStop(-1., null, 0)
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
                    new RJSTrainStop(-1., null, 0)
            };

        final var configLong = TestConfig.readResource("tiny_infra/config_railjson.json");
        for (var train : configLong.rjsSimulation.trainSchedules)
            train.stops = new RJSTrainStop[]{
                    new RJSTrainStop(1000., null, durationStopLong),
                    new RJSTrainStop(-1., null, 0)
            };

        var preparedShort = configShort.prepare();
        preparedShort.run();
        var timeShort = preparedShort.sim.getTime();

        var preparedLong = configLong.prepare();
        preparedLong.run();
        var timeLong = preparedLong.sim.getTime();

        assertEquals(timeShort - durationStopShort, timeLong - durationStopLong, 0.1);
    }

    public void testStopDurationNull() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var configStop = makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(2000., null, 100),
                        new RJSTrainStop(1000., null, 0),
                        new RJSTrainStop(-1., null, 0)
                }
        );
        final var configNoStop = makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(2000., null, 100),
                        new RJSTrainStop(-1., null, 0)
                }
        );
        var simStop = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        run(simStop, configStop);
        var timeWithStop = simStop.getTime();

        var simNoStop = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        run(simNoStop, configNoStop);
        var timeNoStop = simNoStop.getTime();

        assertEquals(timeNoStop, timeWithStop, 0.1);
    }

    public void testStopEndDurationNull() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var config = makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(1000., null, 0),
                        new RJSTrainStop(-1., null, 0)
                }
        );

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        run(sim, config);

        assertTrue(sim.isSimulationOver());
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
                    new RJSTrainStop(-1., null, 0)
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
                    new RJSTrainStop(-1., null, 0)
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

        assertEquals(lastPositionNoStop, lastPositionWithStop, 0.1);
        assertEquals(timeWithStops, timeNoStop, 0.1);
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
                    new RJSTrainStop(-1., null, 0)
            };

        var events = config.run();
        var nStops = events.stream()
                .filter(event -> event instanceof StopActionPoint.RestartTrainEvent)
                .count();
        assertEquals(6, nStops);
    }
}
