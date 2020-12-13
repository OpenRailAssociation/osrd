package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.simulation.core.Simulation;
import fr.sncf.osrd.simulation.core.SimulationError;
import org.junit.jupiter.api.Test;

public class SimulationTest {
    @Test
    public void timerTest() throws SimulationError {
        var sim = new Simulation<String>(1.0);
        var timer = new EventSource<String, String>();
        timer.event(sim, sim.getTime() + 42, "time's up");
        var stepEvent = sim.step();
        assertEquals(stepEvent, "time's up");
        assertEquals(sim.getTime(), 1.0 + 42.0, 0.00001);
    }

    @Test
    @SuppressFBWarnings(value = {"SIC_INNER_SHOULD_BE_STATIC_ANON", "DLS_DEAD_LOCAL_STORE"})
    public void testSinks() throws SimulationError {
        var sim = new Simulation<Object>(0.0);
        var timer = new EventSource<String, Object>();
        timer.event(sim, 1.0, "a");
        timer.event(sim, 2.0, "b");
        timer.event(sim, 3.0, "c");
        timer.event(sim, 4.0, "d");

        var timerResponse = new EventSource<String, Object>();
        var otherChannel = new EventSource<String, Object>();
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
}
