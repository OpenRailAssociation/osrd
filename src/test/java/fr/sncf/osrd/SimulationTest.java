package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.Event;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.Process;
import org.junit.jupiter.api.Test;

public class SimulationTest {
    public static class TestSignal extends Process<String> {
        public final TestSignal master;

        public enum Aspect {
            RED,
            YELLOW,
            GREEN,
        }

        Aspect aspect;
        Event<String> aspectChanged;

        protected TestSignal(Simulation<String> sim, TestSignal master) {
            this.master = master;
            this.aspectChanged = sim.newMultiUseEvent();
        }

        @Override
        public State init(Simulation<String> sim) throws SimulationError {
            return waitEvents(master.aspectChanged);
        }

        @Override
        public State react(Simulation<String> sim) throws SimulationError {
            var oldAspect = aspect;
            if (master.aspect == Aspect.RED) {
                aspect = Aspect.YELLOW;
            } else {
                aspect = Aspect.GREEN;
            }

            if (aspect != oldAspect)
                sim.scheduleNow(aspectChanged, "slave signal changed wow");
            return waitEvents(sim.timer(42., "ok"));
        }
    }

    @Test
    public void timerTest() throws SimulationError {
        var sim = new Simulation<String>(1.0);
        sim.timer(42, "time's up");
        var stepEvent = sim.step();
        assertEquals(stepEvent, "time's up");
        assertEquals(sim.getTime(), 1.0 + 42.0, 0.00001);
    }

    @Test
    @SuppressFBWarnings(value = {"SIC_INNER_SHOULD_BE_STATIC_ANON", "DLS_DEAD_LOCAL_STORE"})
    public void processTest() throws SimulationError {
        var sim = new Simulation<String>(0.0);
        var timerA = sim.timer(1.0, "a");
        var timerB = sim.timer(2.0, "b");
        var timerC = sim.timer(3.0, "c");
        var timerD = sim.timer(4.0, "d");

        var procTerminationEvent = sim.newSingleUseEvent();
        var proc = sim.registerProcess(new Process<String>() {
            @Override
            public State init(Simulation<String> sim) throws SimulationError {
                return waitEvents(WaitMode.WAIT_ALL, timerB, timerC);
            }

            @Override
            public State react(Simulation<String> sim) throws SimulationError {
                assertEquals(this.triggeredEvents.size(), 2);
                assertEquals(this.triggeredEvents.get(0), timerB);
                assertEquals(this.triggeredEvents.get(1), timerC);
                assertEquals(sim.getTime(), 3.0, 0.0);
                return terminate(sim, procTerminationEvent, "process died");
            }
        });

        assertFalse(sim.isSimulationOver());
        assertEquals(sim.step(), "a");
        assertFalse(sim.isSimulationOver());
        assertEquals(sim.step(), "b");
        assertFalse(sim.isSimulationOver());
        assertEquals(sim.step(), "c");
        assertFalse(sim.isSimulationOver());
        assertEquals(sim.step(), "process died");
        assertFalse(sim.isSimulationOver());
        assertEquals(sim.step(), "d");
        assertEquals(sim.getTime(), 4.0, 0.0);
        assertTrue(sim.isSimulationOver());
    }
}
