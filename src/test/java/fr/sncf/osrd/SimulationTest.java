package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.*;

import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.function.BiConsumer;

@SuppressWarnings("MissingJavadocMethod")
public class SimulationTest {
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

        public static TestEvent plan(
                Simulation sim,
                double eventTime,
                String data
        ) {
            return plan(sim, eventTime, data, null);
        }

        public static TestEvent plan(
                Simulation sim,
                double eventTime,
                String data,
                BiConsumer<Simulation, TestEvent> onOccurrenceCallback
        ) {
            return plan(sim, eventTime, data, onOccurrenceCallback, null);
        }

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

        public static class TestEventPlanned extends Change {
            public final double eventTime;
            public final String data;
            private final BiConsumer<Simulation, TestEvent> onOccurrenceCallback;
            private final BiConsumer<Simulation, TestEvent> onCancellationCallback;

            TestEventPlanned(
                    Simulation sim,
                    double eventTime,
                    String data,
                    BiConsumer<Simulation, TestEvent> onOccurrenceCallback,
                    BiConsumer<Simulation, TestEvent> onCancellationCallback
            ) {
                super(sim);
                this.eventTime = eventTime;
                this.data = data;
                this.onOccurrenceCallback = onOccurrenceCallback;
                this.onCancellationCallback = onCancellationCallback;
            }

            TestEvent apply(Simulation sim) {
                var event = new TestEvent(
                        sim.nextEventId(eventTime),
                        data,
                        onOccurrenceCallback,
                        onCancellationCallback
                );
                sim.scheduleEvent(event);
                return event;
            }

            @Override
            public void replay(Simulation sim) {
                apply(sim);
            }
        }
    }

    @Test
    public void timerTest() throws SimulationError {
        var sim = Simulation.createWithoutInfra(1.0, null);
        var event = TestEvent.plan(sim, sim.getTime() + 42, null);
        assertSame(event, sim.step());
        assertEquals(event.getState(), TimelineEvent.State.OCCURRED);
        assertTrue(sim.isSimulationOver());
        assertEquals(sim.getTime(), 1.0 + 42.0, 0.00001);
    }

    @Test
    @SuppressFBWarnings(value = {"SIC_INNER_SHOULD_BE_STATIC_ANON", "DLS_DEAD_LOCAL_STORE"})
    public void testEventOrder() throws SimulationError {
        var multiplexer = new ChangeConsumerMultiplexer(new ArrayList<>());
        var sim = Simulation.createWithoutInfra(0.0, multiplexer);
        multiplexer.add(ChangeReplayChecker.from(sim));

        BiConsumer<Simulation, TestEvent> onEventOccurred = (_sim, event) -> {
            var curTime = _sim.getTime();
            TestEvent.plan(_sim, curTime + 0.5, event.toString() + " response");
            if (curTime > 2.7)
                TestEvent.plan(_sim, curTime, event.toString() + " simultaneous event");
        };

        TestEvent.plan(sim, 1.0, "a", onEventOccurred);
        TestEvent.plan(sim, 2.0, "b", onEventOccurred);
        TestEvent.plan(sim, 3.0, "c", onEventOccurred);
        TestEvent.plan(sim, 4.0, "d", onEventOccurred);

        assertFalse(sim.isSimulationOver());
        assertEquals("a", sim.step().toString());
        assertEquals("a response", sim.step().toString());
        assertEquals("b", sim.step().toString());
        assertEquals("b response", sim.step().toString());
        assertEquals("c", sim.step().toString());
        assertEquals("c simultaneous event", sim.step().toString());
        assertEquals("c response", sim.step().toString());
        assertEquals("d", sim.step().toString());
        assertEquals("d simultaneous event", sim.step().toString());
        assertEquals("d response", sim.step().toString());
        assertEquals(sim.getTime(), 4.5, 0.0);
        assertTrue(sim.isSimulationOver());
    }
}
