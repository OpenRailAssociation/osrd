package fr.sncf.osrd;

import static fr.sncf.osrd.SignalSimulationTest.Signal.Aspect.*;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.util.simulation.*;
import fr.sncf.osrd.util.simulation.core.AbstractEvent;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;
import org.junit.jupiter.api.Test;

import java.util.Objects;

public class SignalSimulationTest {
    public static class World {
    }

    public static class BaseEvent {
    }

    public static final class SignalChangeEvent extends BaseEvent {
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

        EventSource<SignalChangeEvent, World, BaseEvent> aspectChanged = new EventSource<>();
        EventSink<SignalChangeEvent, World, BaseEvent> masterAspectChangedSink;

        Signal(Aspect aspect, Signal master) {
            this.aspect = aspect;
            masterAspectChangedSink = this::masterAspectChanged;
            if (master != null)
                master.aspectChanged.subscribe(masterAspectChangedSink);
        }

        /**
         * Sets the aspect of the signal, creating an event in case it changes.
         * @param sim the simulation
         * @param newAspect the new aspect of the signal
         * @throws SimulationError if there's a logic error
         */
        public void setAspect(Simulation<World, BaseEvent> sim, Aspect newAspect) throws SimulationError {
            if (newAspect == aspect)
                return;
            aspectChanged.event(sim, sim.getTime(), new SignalChangeEvent(this, newAspect));
        }

        private void masterAspectChanged(
                Simulation<World, BaseEvent> sim,
                Event<SignalChangeEvent, World, BaseEvent> event,
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
        var sim = new Simulation<World, BaseEvent>(null, 0.0);
        final var masterSignal = new Signal(GREEN, null);
        final var slaveSignal = new Signal(GREEN, masterSignal);
        masterSignal.setAspect(sim, RED);

        assertFalse(sim.isSimulationOver());
        assertEquals(new SignalChangeEvent(masterSignal, RED), sim.step());
        assertEquals(new SignalChangeEvent(slaveSignal, YELLOW), sim.step());
        assertTrue(sim.isSimulationOver());

        // we must be able to unsubscribe sinks
        masterSignal.aspectChanged.unsubscribe(slaveSignal.masterAspectChangedSink);
        masterSignal.setAspect(sim, YELLOW);
        assertEquals(new SignalChangeEvent(masterSignal, YELLOW), sim.step());
        assertTrue(sim.isSimulationOver());
    }
}
