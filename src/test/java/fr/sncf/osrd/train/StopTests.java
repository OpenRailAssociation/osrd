package fr.sncf.osrd.train;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.speedcontroller.SpeedInstructionsTests.isLate;
import static org.junit.jupiter.api.Assertions.assertEquals;

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
    public void testResumeAfterStop() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var config = makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(1000., null, 10),
                        new RJSTrainStop(-1., null, 0)
                }
        );
        var simWithStops = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsWithStops = run(simWithStops, config);
        var lastPositionWithStop = lastTrainPosition(eventsWithStops);

        var simNoStop = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsNoStop = run(simNoStop);
        var lastPositionNoStop = lastTrainPosition(eventsNoStop);

        assertEquals(lastPositionNoStop, lastPositionWithStop, 0.1);
    }

    @Test
    public void testStopDuration() throws InvalidInfraException {
        final var infra = getBaseInfra();
        var durationStopShort = 10;
        var durationStopLong = 100;
        final var configShort = makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(1000., null, durationStopShort),
                        new RJSTrainStop(-1., null, 0)
                }
        );
        final var configLong = makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(1000., null, durationStopLong),
                        new RJSTrainStop(-1., null, 0)
                }
        );
        var simShort = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        run(simShort, configShort);
        var timeShort = simShort.getTime();

        var simLong = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        run(simLong, configLong);
        var timeLong = simLong.getTime();

        assertEquals(timeShort - durationStopShort, timeLong - durationStopLong, 0.1);
    }

    @Test
    public void testCorrectExpectedTimes() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var config = makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(200., null, 10),
                        new RJSTrainStop(1000., null, 10),
                        new RJSTrainStop(3000., null, 0),
                        new RJSTrainStop(5000., null, 60),
                        new RJSTrainStop(-1., null, 0)
                }
        );
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        for (int i = 10; i < 150; i++) {
            makeAssertEvent(sim, i, () -> !isLate(sim));
        }
        run(sim, config);
    }

    @Test
    public void testNoStopWhenNegativeTimes() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var config = makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(200., null, -1),
                        new RJSTrainStop(1000., null, -1),
                        new RJSTrainStop(3000., null, -1),
                        new RJSTrainStop(5000., null, -1),
                        new RJSTrainStop(-1., null, 0)
                }
        );
        var simWithStops = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsWithStops = run(simWithStops, config);
        var lastPositionWithStop = lastTrainPosition(eventsWithStops);
        var timeWithStops = simWithStops.getTime();

        var simNoStop = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsNoStop = run(simNoStop);
        var lastPositionNoStop = lastTrainPosition(eventsNoStop);
        var timeNoStop = simNoStop.getTime();

        assertEquals(lastPositionNoStop, lastPositionWithStop, 0.1);
        assertEquals(timeWithStops, timeNoStop, 0.1);
    }

    @Test
    public void testCorrectNumberGeneratedEvents() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var config = makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(200., null, -1),
                        new RJSTrainStop(1000., null, 0),
                        new RJSTrainStop(3000., null, 10),
                        new RJSTrainStop(5000., null, -1),
                        new RJSTrainStop(6000., null, 0),
                        new RJSTrainStop(-1., null, 0)
                }
        );
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var events = run(sim, config);
        var nStops = events.stream()
                .filter(event -> event instanceof StopActionPoint.RestartTrainEvent)
                .count();
        assertEquals(6, nStops);
    }
}
