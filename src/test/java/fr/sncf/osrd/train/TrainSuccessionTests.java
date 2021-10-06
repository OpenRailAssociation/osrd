package fr.sncf.osrd.train;

import static fr.sncf.osrd.train.TrainStatus.REACHED_DESTINATION;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import org.junit.jupiter.api.Test;

public class TrainSuccessionTests {

    private static TestConfig.TestSimulationState runSimWithSuccession(double delay) {
        final var config = TestConfig.readResource("tiny_infra/config_railjson.json");
        var firstTrain = config.rjsSimulation.trainSchedules.get(0);
        firstTrain.id = "first";
        var secondTrain = new RJSTrainSchedule(firstTrain);
        secondTrain.id = "second";
        secondTrain.rollingStock = null;
        secondTrain.previousTrainId = "first";
        secondTrain.trainTransitionDelay = delay;
        config.rjsSimulation.trainSchedules.add(secondTrain);

        var prepared = config.prepare();
        prepared.run();
        return prepared;
    }

    @Test
    public void testSimpleTrainSuccession() {
        var result = runSimWithSuccession(10);
        var trains = result.sim.trains;
        assert trains.size() == 2;
        assert trains.values().stream().allMatch(t -> REACHED_DESTINATION == t.getLastState().status);
    }

    @Test
    public void testSuccessionDelay() {
        var resultShort = runSimWithSuccession(0);
        var resultLonger = runSimWithSuccession(60);
        assertEquals(resultShort.sim.getTime() + 60, resultLonger.sim.getTime(), 0.1);
    }

    @Test
    public void testRestartTime() {
        var result = runSimWithSuccession(10);
        var trains = result.sim.trains;
        assert trains.size() == 2;
        var firstTrainStopTime = trains.get("first").getLastState().time;
        var secondTrainStartTime = 0.;
        assert result.events != null;
        for (var e : result.events) {
            if (e instanceof TrainCreatedEvent)
                if (((TrainCreatedEvent) e).schedule.trainID.equals("second")) {
                    secondTrainStartTime = e.eventId.scheduledTime;
                    break;
                }
        }
        assertEquals(firstTrainStopTime + 10, secondTrainStartTime, 1);
    }
}
