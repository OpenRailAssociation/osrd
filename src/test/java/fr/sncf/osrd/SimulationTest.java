package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.util.simulation.*;
import fr.sncf.osrd.util.simulation.core.AbstractEvent;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;
import org.junit.jupiter.api.Test;

public class SimulationTest {
    public static class World {
    }

    @Test
    public void timerTest() throws SimulationError {
        var sim = new Simulation<World, String>(null, 1.0);
        var timer = new EventSource<String, World, String>();
        timer.event(sim, sim.getTime() + 42, "time's up");
        var stepEvent = sim.step();
        assertEquals(stepEvent, "time's up");
        assertEquals(sim.getTime(), 1.0 + 42.0, 0.00001);
    }

    @Test
    @SuppressFBWarnings(value = {"SIC_INNER_SHOULD_BE_STATIC_ANON", "DLS_DEAD_LOCAL_STORE"})
    public void testSinks() throws SimulationError {
        var sim = new Simulation<World, Object>(null, 0.0);
        var timer = new EventSource<String, World, Object>();
        timer.event(sim, 1.0, "a");
        timer.event(sim, 2.0, "b");
        timer.event(sim, 3.0, "c");
        timer.event(sim, 4.0, "d");

        var timerResponse = new EventSource<String, World, Object>();
        var otherChannel = new EventSource<String, World, Object>();
        // sinks can be functions or methods, as its a functional interface
        timer.subscribe((_sim, event, newState) -> {
            String msg = event.value;
            timerResponse.event(_sim, _sim.getTime() + 0.5, msg + "_response");
            if (_sim.getTime() > 2.7)
                otherChannel.event(_sim, _sim.getTime(), msg + " simultaneous event");
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

    public static class SinkClass {
        public void testSink(
                Simulation<World, Object> sim,
                Event<String, World, Object> event,
                AbstractEvent.EventState state
        ) {
        }
    }

    @Test
    public void testMethodSourceUnregister() throws SimulationError {
        var source = new EventSource<String, World, Object>();
        var sinkClass = new SinkClass();
        EventSink<String, World, Object> sink = sinkClass::testSink;
        source.subscribe(sink);
        assertEquals(1, source.subscribers.size());
        source.unsubscribe(sink);
        assertEquals(0, source.subscribers.size());
    }
}
