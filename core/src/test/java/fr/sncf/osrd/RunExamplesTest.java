package fr.sncf.osrd;

import static fr.sncf.osrd.train.TrainStatus.REACHED_DESTINATION;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.simulation.ChangeReplayChecker;
import fr.sncf.osrd.simulation.ChangeSerializer;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import fr.sncf.osrd.simulation.changelog.ChangeLogSummarizer;
import fr.sncf.osrd.train.Train;
import okio.Buffer;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.util.ArrayList;

public class RunExamplesTest {
    private static void runGivenConfigInfra(TestConfig testConfig, int nExpectedTrainsArrived) throws IOException {
        var changeConsumers = new ArrayList<ChangeConsumer>();
        var changelog = new ArrayChangeLog();
        changeConsumers.add(changelog);

        var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);

        testConfig.withChangeConsumer(multiplexer);
        var simState = testConfig.prepare();

        multiplexer.add(ChangeReplayChecker.from(simState.sim));

        simState.run();

        ChangeLogSummarizer.summarize(changelog);

        ChangeSerializer.serializeChangeLog(changelog, new Buffer());

        var nTrainsArrived = simState.sim.trains.values().stream()
                .map(Train::getLastState)
                .filter(trainState -> trainState.status.equals(REACHED_DESTINATION))
                .count();
        assertEquals(nExpectedTrainsArrived, nTrainsArrived);
    }

    @Test
    public void testTinyInfra() throws IOException {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        runGivenConfigInfra(testConfig, 1);
    }

    @Disabled("see issue https://github.com/DGEXSolutions/osrd-core/issues/216")
    @Test
    public void testCircularInfra() throws IOException {
        var testConfig = TestConfig.readResource("circular_infra/config.json");
        runGivenConfigInfra(testConfig, 0);
    }

    @Test
    public void testLineInfra() throws IOException {
        var testConfig = TestConfig.readResource("one_line/infra.json", "one_line/simulation.json");
        runGivenConfigInfra(testConfig, 1);
    }
}
