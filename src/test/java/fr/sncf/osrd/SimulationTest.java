package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.simulation.Simulation;
import org.junit.jupiter.api.Test;

public class SimulationTest {
    @Test
    public void timerTest() throws SimulationError {
        var sim = new Simulation<String>(1.0);
        var timer = new EventSource<String, String>();
        sim.event(timer, sim.getTime() + 42, "time's up");
        var stepEvent = sim.step();
        assertEquals(stepEvent, "time's up");
        assertEquals(sim.getTime(), 1.0 + 42.0, 0.00001);
    }

    @Test
    @SuppressFBWarnings(value = {"SIC_INNER_SHOULD_BE_STATIC_ANON", "DLS_DEAD_LOCAL_STORE"})
    public void testSinks() throws SimulationError {
        var sim = new Simulation<Object>(0.0);
        var timer = new EventSource<String, Object>();
        sim.event(timer, 1.0, "a");
        sim.event(timer, 2.0, "b");
        sim.event(timer, 3.0, "c");
        sim.event(timer, 4.0, "d");

        var timerResponse = new EventSource<String, Object>();
        var otherChannel = new EventSource<String, Object>();
        // sinks can be functions or methods, as its a functional interface
        timer.subscribe((_sim, event, newState) -> {
            String msg = event.value;
            _sim.event(timerResponse, _sim.getTime() + 0.5, msg + "_response");
            if (_sim.getTime() > 2.7)
                _sim.event(otherChannel, _sim.getTime(), msg + " simultaneous event");
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
