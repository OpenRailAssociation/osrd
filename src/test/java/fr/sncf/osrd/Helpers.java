package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.squareup.moshi.JsonReader;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import fr.sncf.osrd.utils.PathUtils;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import okio.Okio;

import java.io.File;
import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Supplier;

public class Helpers {
    public static final class TestEvent extends TimelineEvent {
        public final String data;
        private final BiConsumer<Simulation, TestEvent> onOccurrenceCallback;
        private final BiConsumer<Simulation, TestEvent> onCancellationCallback;

        private TestEvent(
                TimelineEventId eventId,
                String data,
                BiConsumer<Simulation, TestEvent> onOccurrenceCallback,
                BiConsumer<Simulation, TestEvent> onCancellationCallback
        ) {
            super(eventId);
            this.data = data;
            this.onOccurrenceCallback = onOccurrenceCallback;
            this.onCancellationCallback = onCancellationCallback;
        }

        @Override
        protected void onOccurrence(Simulation sim) {
            if (onOccurrenceCallback != null)
                onOccurrenceCallback.accept(sim, this);
        }

        @Override
        protected void onCancellation(Simulation sim) {
            if (onCancellationCallback != null)
                onCancellationCallback.accept(sim, this);
        }

        @Override
        public String toString() {
            return data;
        }

        @Override
        @SuppressFBWarnings("BC_UNCONFIRMED_CAST")
        public boolean deepEquals(TimelineEvent other) {
            if (other.getClass() != TestEvent.class)
                return false;
            var o = (TestEvent) other;
            return o.data.equals(data)
                    && o.eventId.equals(eventId)
                    && o.onOccurrenceCallback == onOccurrenceCallback
                    && o.onCancellationCallback == onCancellationCallback;
        }

        /** Plan a test event at a given time with no callbacks */
        public static TestEvent plan(
                Simulation sim,
                double eventTime,
                String data
        ) {
            return plan(sim, eventTime, data, null);
        }

        /** Plan a test event at a given time with the specified callbacks on occurence */
        public static TestEvent plan(
                Simulation sim,
                double eventTime,
                String data,
                BiConsumer<Simulation, TestEvent> onOccurrenceCallback
        ) {
            return plan(sim, eventTime, data, onOccurrenceCallback, null);
        }

        /** Plan a test event at a given time with the specified callbacks */
        public static TestEvent plan(
                Simulation sim,
                double eventTime,
                String data,
                BiConsumer<Simulation, TestEvent> onOccurrenceCallback,
                BiConsumer<Simulation, TestEvent> onCancellationCallback
        ) {
            var change = new TestEventPlanned(sim, eventTime, data, onOccurrenceCallback, onCancellationCallback);
            var event = change.apply(sim);
            sim.publishChange(change);
            return event;
        }

        public static class TestEventPlanned extends Simulation.TimelineEventCreated {
            public final String data;
            private final BiConsumer<Simulation, TestEvent> onOccurrenceCallback;
            private final BiConsumer<Simulation, TestEvent> onCancellationCallback;

            private TestEventPlanned(
                    Simulation sim,
                    double eventTime,
                    String data,
                    BiConsumer<Simulation, TestEvent> onOccurrenceCallback,
                    BiConsumer<Simulation, TestEvent> onCancellationCallback
            ) {
                super(sim, eventTime);
                this.data = data;
                this.onOccurrenceCallback = onOccurrenceCallback;
                this.onCancellationCallback = onCancellationCallback;
            }

            private TestEvent apply(Simulation sim) {
                var event = new TestEvent(eventId, data, onOccurrenceCallback, onCancellationCallback);
                super.scheduleEvent(sim, event);
                return event;
            }

            @Override
            public void replay(Simulation sim) {
                apply(sim);
            }

            @Override
            public String toString() {
                return String.format("TestEventPlanned { eventId=%s, data=%s }", eventId, data);
            }
        }
    }


    /** Generates the defaults infra from tiny_infra/infra.json, to be edited for each test */
    public static RJSInfra getBaseInfra() {
        return getBaseInfra("tiny_infra/infra.json");
    }

    /** Generates the defaults infra from the specified path */
    public static RJSInfra getBaseInfra(String path) {
        try {
            var fileSource = Okio.source(getResourcePath(path));
            var bufferedSource = Okio.buffer(fileSource);
            var jsonReader = JsonReader.of(bufferedSource);
            return RJSInfra.adapter.fromJson(jsonReader);
        } catch (IOException e) {
            fail(e);
            throw new RuntimeException();
        }
    }

    /** Generates the defaults config from tiny_infra/config_railjson.json */
    public static Config getBaseConfig(String path) {
        try {
            return Config.readFromFile(getResourcePath(path));
        } catch (IOException | InvalidInfraException | InvalidRollingStock | InvalidSchedule e) {
            fail(e);
            throw new RuntimeException();
        }
    }

    /** Generates the defaults config from tiny_infra/config_railjson.json */
    public static Config getBaseConfig() {
        return getBaseConfig("tiny_infra/config_railjson.json");
    }

    /** Loads the given config file, but replaces the given allowance parameters in all the phases */
    public static Config makeConfigWithSpeedParams(List<RJSAllowance> params, String baseConfigPath) {
        var paramsList = params == null ? null : Collections.singletonList(params);
        return makeConfigWithSpeedParamsList(paramsList, baseConfigPath);
    }

    /** Loads the given config file, but replaces the given allowance parameters in the phases
     * the nth list of allowance is used for the nth phase */
    public static Config makeConfigWithSpeedParamsList(List<List<RJSAllowance>> params, String baseConfigPath) {
        ClassLoader classLoader = Helpers.class.getClassLoader();
        var configPath = classLoader.getResource(baseConfigPath);
        assert configPath != null;
        try {
            var path = Path.of(configPath.getFile());
            var baseDirPath = path.getParent();
            var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, path);
            var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
            var infra = Infra.parseFromFile(jsonConfig.infraType, infraPath.toString());
            var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
            var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);
            for (var trainSchedule : schedule.trainSchedules) {
                for (int i = 0; i < trainSchedule.phases.length; i++) {
                    trainSchedule.phases[i].allowances = params == null ? null
                            : params.get(i % params.size()).toArray(new RJSAllowance[0]);
                }
            }
            var trainSchedules = RJSSimulationParser.parse(infra, schedule);
            return new Config(
                    jsonConfig.simulationTimeStep,
                    infra,
                    trainSchedules,
                    jsonConfig.simulationStepPause,
                    jsonConfig.showViewer,
                    jsonConfig.realTimeViewer,
                    jsonConfig.changeReplayCheck
            );
        } catch (IOException | InvalidInfraException | InvalidRollingStock | InvalidSchedule e) {
            fail(e);
            throw new RuntimeException();
        }
    }

    /** Loads the phases in the given simulation file
     * The purpose of this function is to edit the phases and call makeCOnfigWithGivenPhases afterwards */
    public static RJSTrainPhase[] loadRJSPhases(String simulationPath) {
        try {
            ClassLoader classLoader = Helpers.class.getClassLoader();
            var path = classLoader.getResource(simulationPath);
            assert path != null;
            var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, Path.of(path.getFile()));
            return schedule.trainSchedules.stream().findAny().orElseThrow().phases;
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /** Loads the given config, but replaces the given phases in the schedule */
    public static Config makeConfigWithGivenPhases(RJSTrainPhase[] phases, String baseConfigPath) {
        ClassLoader classLoader = Helpers.class.getClassLoader();
        var configPath = classLoader.getResource(baseConfigPath);
        assert configPath != null;
        try {
            var path = Path.of(configPath.getFile());
            var baseDirPath = path.getParent();
            var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, path);
            var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
            var infra = Infra.parseFromFile(jsonConfig.infraType, infraPath.toString());
            var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
            var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);
            for (var trainSchedule : schedule.trainSchedules) {
                trainSchedule.phases = phases;
            }
            var trainSchedules = RJSSimulationParser.parse(infra, schedule);
            return new Config(
                    jsonConfig.simulationTimeStep,
                    infra,
                    trainSchedules,
                    jsonConfig.simulationStepPause,
                    jsonConfig.showViewer,
                    jsonConfig.realTimeViewer,
                    jsonConfig.changeReplayCheck
            );
        } catch (IOException | InvalidInfraException | InvalidRollingStock | InvalidSchedule e) {
            fail(e);
            throw new RuntimeException();
        }
    }

    /** Generates a config where all the RJSRunningTieParameters have been replaced by the one given */
    public static Config makeConfigWithSpeedParams(List<RJSAllowance> params) {
        return makeConfigWithSpeedParams(params, "tiny_infra/config_railjson.json");
    }

    /** Go through all the events in the simulation, fails if an exception is thrown */
    public static ArrayList<TimelineEvent> run(Simulation sim) {
        var config = getBaseConfig();
        return run(sim, config);
    }

    /** Go through all the events in the simulation with a specified config, fails if an exception is thrown */
    public static ArrayList<TimelineEvent> run(Simulation sim, Config config) {
        try {
            return runWithExceptions(sim, config);
        } catch (SimulationError e) {
            fail(e);
            throw new RuntimeException();
        }
    }

    /** Given a resource path find the full path (works cross platform) */
    public static Path getResourcePath(String resourcePath) {
        ClassLoader classLoader = Helpers.class.getClassLoader();
        var url = classLoader.getResource(resourcePath);
        assert url != null;
        try {
            return new File(url.toURI()).toPath();
        } catch (URISyntaxException e) {
            throw new RuntimeException(e);
        }
    }

    /** Go through all the events in the simulation, exceptions pass through */
    public static ArrayList<TimelineEvent> runWithExceptions(Simulation sim) throws SimulationError {
        var config = getBaseConfig();
        return runWithExceptions(sim, config);
    }

    /** Go through all the events in the simulation with a specified config, exceptions pass through */
    public static ArrayList<TimelineEvent> runWithExceptions(Simulation sim, Config config) throws SimulationError {
        var events = new ArrayList<TimelineEvent>();
        for (var trainSchedule : config.trainSchedules)
            TrainCreatedEvent.plan(sim, trainSchedule);
        while (!sim.isSimulationOver())
            events.add(sim.step());
        return events;
    }

    /** Generates an event that runs an assertion at a certain point in the simulation */
    public static void makeAssertEvent(Simulation sim, double time, Supplier<Boolean> predicate) {
        Procedure func = () -> assertTrue(predicate.get());
        makeFunctionEvent(sim, time, func);
    }

    /** Generates an event that runs a function at a certain point in the simulation */
    public static void makeFunctionEvent(Simulation sim, double time, Procedure func) {
        BiConsumer<Simulation, TestEvent> consumer = (s, test) -> {
            try {
                func.run();
            } catch (Exception e) {
                fail(e);
            }
        };
        TestEvent.plan(sim, time, null, consumer);
    }

    /** Simple class similar to java Runnable, but with exceptions */
    public interface Procedure {
        void run() throws Exception;
    }
}
