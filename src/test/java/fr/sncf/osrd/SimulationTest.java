package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.utils.*;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

public class SimulationTest {
    /**
     * A class that collects event updates it receives, for testing purposes.
     */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class MockEntity extends Entity {
        public MockEntity(String id) {
            super(id);
        }

        public static class EventUpdate {
            public final TimelineEvent<?> event;
            public final TimelineEvent.State state;

            public EventUpdate(TimelineEvent<?> event, TimelineEvent.State state) {
                this.event = event;
                this.state = state;
            }
        }

        public final ArrayList<EventUpdate> events = new ArrayList<>();

        @Override
        protected void onTimelineEventUpdate(
                Simulation sim,
                TimelineEvent<?> event,
                TimelineEvent.State state
        ) {
            events.add(new EventUpdate(event, state));
        }
    }

    public static class TEValue<T> extends TimelineEventValue {
        public final T value;

        public TEValue(T value) {
            this.value = value;
        }

        @Override
        public String toString() {
            return value.toString();
        }
    }

    @Test
    public void timerTest() throws SimulationError {
        var sim = new Simulation(null, 1.0, null);
        var timer = new MockEntity("test");
        sim.createEvent(timer, sim.getTime() + 42, new TEValue<String>("time's up"));
        var stepEvent = sim.step();
        assertEquals(stepEvent.toString(), "time's up");
        assertEquals(sim.getTime(), 1.0 + 42.0, 0.00001);
    }

    @Test
    @SuppressFBWarnings(value = {"SIC_INNER_SHOULD_BE_STATIC_ANON", "DLS_DEAD_LOCAL_STORE"})
    public void testEventOrder() throws SimulationError {
        var sim = new Simulation(null, 0.0, null);
        var timer = new MockEntity("test");
        sim.createEvent(timer, 1.0, new TEValue<String>("a"));
        sim.createEvent(timer, 2.0, new TEValue<String>("b"));
        sim.createEvent(timer, 3.0, new TEValue<String>("c"));
        sim.createEvent(timer, 4.0, new TEValue<String>("d"));

        var timerResponse = new MockEntity("timer");
        var otherChannel = new MockEntity("other");
        // sinks can be functions or methods, as its a functional interface
        timer.addSubscriber(new Entity("subscriber") {
            @Override
            protected void onTimelineEventUpdate(
                    Simulation sim,
                    TimelineEvent<?> event,
                    TimelineEvent.State state
            ) throws SimulationError {
                String msg = event.value.toString();
                sim.createEvent(timerResponse, sim.getTime() + 0.5, new TEValue<String>(msg + "_response"));
                if (sim.getTime() > 2.7)
                    sim.createEvent(otherChannel, sim.getTime(), new TEValue<String>(msg + " simultaneous event"));
            }
        });

        assertFalse(sim.isSimulationOver());
        assertEquals("a", sim.step().toString());
        assertEquals("a_response", sim.step().toString());
        assertEquals("b", sim.step().toString());
        assertEquals("b_response", sim.step().toString());
        assertEquals("c", sim.step().toString());
        assertEquals("c simultaneous event", sim.step().toString());
        assertEquals("c_response", sim.step().toString());
        assertEquals("d", sim.step().toString());
        assertEquals("d simultaneous event", sim.step().toString());
        assertEquals("d_response", sim.step().toString());
        assertEquals(sim.getTime(), 4.5, 0.0);
        assertTrue(sim.isSimulationOver());
    }

    @Test
    public void testMethodSourceUnregister() throws SimulationError {
        var source = new MockEntity("source");
        var sinkClass = new MockEntity("sink");
        source.addSubscriber(sinkClass);
        assertEquals(1, source.subscribers.size());
        source.removeSubscriber(sinkClass);
        assertEquals(0, source.subscribers.size());
    }
}
