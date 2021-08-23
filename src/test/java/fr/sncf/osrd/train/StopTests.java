package fr.sncf.osrd.train;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.infra.InvalidInfraException;
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
        final var config = getBaseConfig();
        makeConfigWithGivenStops("tiny_infra/config_railjson.json",
                new RJSTrainStop[]{
                        new RJSTrainStop(1000., null, 10),
                        new RJSTrainStop(-1., null, 0)
                }
        );
        var simWinStops = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsWithStops = run(simWinStops, config);
        var lastPositionWithStop = lastTrainPosition(eventsWithStops);


        var simNoStop = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsNoStop = run(simNoStop);
        var lastPositionNoStop = lastTrainPosition(eventsNoStop);


        assertEquals(lastPositionNoStop, lastPositionWithStop, 0.1);
    }
}
