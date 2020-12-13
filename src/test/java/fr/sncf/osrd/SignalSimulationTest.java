package fr.sncf.osrd;

import static fr.sncf.osrd.SignalSimulationTest.Signal.Aspect.*;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.simulation.core.AbstractEvent;
import fr.sncf.osrd.simulation.core.Simulation;
import fr.sncf.osrd.simulation.core.SimulationError;
import org.junit.jupiter.api.Test;

import java.util.Objects;

public class SignalSimulationTest {
    public static class SignalSimulationEvent {
    }

    public static final class SignalChangeEvent extends SignalSimulationEvent {
        public final Signal signal;
        public final Signal.Aspect aspect;

        public SignalChangeEvent(Signal signal, Signal.Aspect aspect) {
            this.signal = signal;
            this.aspect = aspect;
        }

        @Override
        public boolean equals(Object obj) {
            if (obj == null)
                return false;

            if (this.getClass() != obj.getClass())
                return false;

            var o = (SignalChangeEvent) obj;
            return this.signal == o.signal && this.aspect == o.aspect;
        }

        @Override
        public int hashCode() {
            return Objects.hash(signal, aspect);
        }
    }

    public static class Signal {
        public enum Aspect {
            RED,
            YELLOW,
            GREEN,
        }

        private Aspect aspect;

        public Aspect getAspect() {
            return aspect;
        }

        EventSource<SignalChangeEvent, SignalSimulationEvent> aspectChanged = new EventSource<>();

        Signal(Aspect aspect, Signal master) {
            this.aspect = aspect;
            if (master != null)
                master.aspectChanged.subscribe(this::masterAspectChanged);
        }

        /**
         * Sets the aspect of the signal, creating an event in case it changes.
         * @param sim the simulation
         * @param newAspect the new aspect of the signal
         * @throws SimulationError if there's a logic error
         */
        public void setAspect(Simulation<SignalSimulationEvent> sim, Aspect newAspect) throws SimulationError {
            if (newAspect == aspect)
                return;
            aspectChanged.event(sim, sim.getTime(), new SignalChangeEvent(this, newAspect));
        }

        private void masterAspectChanged(
                Simulation<SignalSimulationEvent> sim,
                Event<SignalChangeEvent, SignalSimulationEvent> event,
                AbstractEvent.EventState state
        ) throws SimulationError {
            var newAspect = aspect;
            if (event.value.aspect == RED) {
                newAspect = YELLOW;
            } else {
                newAspect = GREEN;
            }

            setAspect(sim, newAspect);
        }
    }

    @Test
    public void testSignaling() throws SimulationError {
        var sim = new Simulation<SignalSimulationEvent>(0.0);
        final var masterSignal = new Signal(GREEN, null);
        final var slaveSignal = new Signal(GREEN, masterSignal);
        masterSignal.setAspect(sim, RED);

        assertFalse(sim.isSimulationOver());
        assertEquals(new SignalChangeEvent(masterSignal, RED), sim.step());
        assertEquals(new SignalChangeEvent(slaveSignal, YELLOW), sim.step());
        assertTrue(sim.isSimulationOver());
    }
}
