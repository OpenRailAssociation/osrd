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
        protected void timelineEventUpdate(
                Simulation sim,
                TimelineEvent<?> event,
                TimelineEvent.State state
        ) throws SimulationError {
            events.add(new EventUpdate(event, state));
        }
    }


    @Test
    public void timerTest() throws SimulationError {
        var sim = new Simulation(null, 1.0, null, null);
        var timer = new MockEntity("test");
        timer.event(sim, sim.getTime() + 42, "time's up");
        var stepEvent = sim.step();
        assertEquals(stepEvent, "time's up");
        assertEquals(sim.getTime(), 1.0 + 42.0, 0.00001);
    }

    @Test
    @SuppressFBWarnings(value = {"SIC_INNER_SHOULD_BE_STATIC_ANON", "DLS_DEAD_LOCAL_STORE"})
    public void testEventOrder() throws SimulationError {
        var sim = new Simulation(null, 0.0, null, null);
        var timer = new MockEntity("test");
        timer.event(sim, 1.0, "a");
        timer.event(sim, 2.0, "b");
        timer.event(sim, 3.0, "c");
        timer.event(sim, 4.0, "d");

        var timerResponse = new MockEntity("timer");
        var otherChannel = new MockEntity("other");
        // sinks can be functions or methods, as its a functional interface
        timer.addSubscriber(new Entity("subscriber") {
            @Override
            protected void timelineEventUpdate(
                    Simulation sim,
                    TimelineEvent<?> event,
                    TimelineEvent.State state
            ) throws SimulationError {
                String msg = event.value.toString();
                timerResponse.event(sim, sim.getTime() + 0.5, msg + "_response");
                if (sim.getTime() > 2.7)
                    otherChannel.event(sim, sim.getTime(), msg + " simultaneous event");
            }
        });

        assertFalse(sim.isSimulationOver());
        assertEquals("a", sim.step());
        assertEquals("a_response", sim.step());
        assertEquals("b", sim.step());
        assertEquals("b_response", sim.step());
        assertEquals("c", sim.step());
        assertEquals("c simultaneous event", sim.step());
        assertEquals("c_response", sim.step());
        assertEquals("d", sim.step());
        assertEquals("d simultaneous event", sim.step());
        assertEquals("d_response", sim.step());
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
