package fr.sncf.osrd.infra_state;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.squareup.moshi.JsonReader;
import fr.sncf.osrd.SimulationTest;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import okio.Okio;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.function.BiConsumer;
import java.util.function.Function;

public class Helpers {

    /** Generates the defaults infra from tiny_infra/infra.json, to be edited for each test */
    public static RJSInfra getBaseInfra() {
        try {
            ClassLoader classLoader = Helpers.class.getClassLoader();
            var infraPath = classLoader.getResource("tiny_infra/infra.json");
            assert infraPath != null;
            var fileSource = Okio.source(Path.of(infraPath.getFile()));
            var bufferedSource = Okio.buffer(fileSource);
            var jsonReader = JsonReader.of(bufferedSource);
            return RJSInfra.adapter.fromJson(jsonReader);
        } catch (IOException e) {
            fail(e);
            return null;
        }
    }

    /** Go through all the events in the simulation */
    public static ArrayList<TimelineEvent> run(Simulation sim) {
        ClassLoader classLoader = Helpers.class.getClassLoader();
        var configPath = classLoader.getResource("tiny_infra/config_railjson.json");
        assert configPath != null;
        var events = new ArrayList<TimelineEvent>();
        try {
            Config config = Config.readFromFile(Path.of(configPath.getFile()));
            for (var trainSchedule : config.trainSchedules)
                TrainCreatedEvent.plan(sim, trainSchedule);
            while (!sim.isSimulationOver())
                events.add(sim.step());
            return events;
        } catch (IOException | InvalidInfraException | InvalidRollingStock | InvalidSchedule | SimulationError e) {
            fail(e);
            return null;
        }
    }

    /** Generates an event that runs an assertion at a certain point in the simulation */
    public static void makeAssertEvent(Simulation sim, double time, Function<Simulation, Boolean> predicate) {
        BiConsumer<Simulation, SimulationTest.TestEvent> consumer = (s, test) -> assertTrue(predicate.apply(s));
        SimulationTest.TestEvent.plan(sim, time, null, consumer);
    }

}
