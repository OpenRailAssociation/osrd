package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.squareup.moshi.JsonReader;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import okio.Okio;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
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
            ClassLoader classLoader = Helpers.class.getClassLoader();
            var infraPath = classLoader.getResource(path);
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

    /** Go through all the events in the simulation, fails if an exception is thrown */
    public static ArrayList<TimelineEvent> run(Simulation sim) {
        var config = getBaseConfig();
        assert config != null;
        return run(sim, config);
    }

    /** Go through all the events in the simulation with a specified config, fails if an exception is thrown */
    public static ArrayList<TimelineEvent> run(Simulation sim, Config config) {
        try {
            return runWithExceptions(sim, config);
        } catch (SimulationError e) {
            fail(e);
            return null;
        }
    }

    /** Go through all the events in the simulation, exceptions pass through */
    public static ArrayList<TimelineEvent> runWithExceptions(Simulation sim) throws SimulationError {
        var config = getBaseConfig();
        assert config != null;
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
