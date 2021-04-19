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
import java.util.concurrent.Callable;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.function.Supplier;

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

    /** Generates the defaults config from tiny_infra/config_railjson.json */
    public static Config getBaseConfig() {
        ClassLoader classLoader = Helpers.class.getClassLoader();
        var configPath = classLoader.getResource("tiny_infra/config_railjson.json");
        assert configPath != null;
        try {
            return Config.readFromFile(Path.of(configPath.getFile()));
        } catch (IOException | InvalidInfraException | InvalidRollingStock | InvalidSchedule e) {
            fail(e);
            return null;
        }
    }

    /** Go through all the events in the simulation */
    public static ArrayList<TimelineEvent> run(Simulation sim) {
        var config = getBaseConfig();
        return run(sim, config);
    }

    /** Go through all the events in the simulation with a specified config*/
    public static ArrayList<TimelineEvent> run(Simulation sim, Config config) {
        var events = new ArrayList<TimelineEvent>();
        try {
            for (var trainSchedule : config.trainSchedules)
                TrainCreatedEvent.plan(sim, trainSchedule);
            while (!sim.isSimulationOver())
                events.add(sim.step());
            return events;
        } catch (SimulationError e) {
            fail(e);
            return null;
        }
    }

    /** Generates an event that runs an assertion at a certain point in the simulation */
    public static void makeAssertEvent(Simulation sim, double time, Supplier<Boolean> predicate) {
        Runnable func = () -> assertTrue(predicate.get());
        makeFunctionEvent(sim, time, func);
    }

    /** Generates an event that runs a function at a certain point in the simulation */
    public static void makeFunctionEvent(Simulation sim, double time, Runnable func) {
        BiConsumer<Simulation, SimulationTest.TestEvent> consumer = (s, test) -> func.run();
        SimulationTest.TestEvent.plan(sim, time, null, consumer);
    }

}
