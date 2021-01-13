package fr.sncf.osrd;

import static fr.sncf.osrd.SignalSimulationTest.Signal.Aspect.*;
import static org.junit.jupiter.api.Assertions.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.utils.*;
import org.junit.jupiter.api.Test;

import java.util.Objects;

public class SignalSimulationTest {
    public static final class SignalAspectChange extends EntityChange<Signal, Void> {
        public final Signal signal;
        public final Signal.Aspect newAspect;

        /**
         * Creates a change of signal aspect
         * @param sim the simulation
         * @param signal the signal for which the aspect changed
         * @param newAspect the new aspect of the signal
         */
        public SignalAspectChange(Simulation sim, Signal signal, Signal.Aspect newAspect) {
            super(sim, signal);
            this.signal = signal;
            this.newAspect = newAspect;
        }

        @Override
        public boolean equals(Object obj) {
            if (obj == null)
                return false;

            if (this.getClass() != obj.getClass())
                return false;

            var o = (SignalAspectChange) obj;
            return this.signal == o.signal && this.newAspect == o.newAspect;
        }

        @Override
        public int hashCode() {
            return Objects.hash(signal, newAspect);
        }

        @Override
        public Void apply(Simulation sim, Signal signal) {
            signal.aspect = newAspect;
            return null;
        }
    }

    public static class Signal extends Entity {
        public enum Aspect {
            RED,
            YELLOW,
            GREEN,
        }

        private Aspect aspect;

        public Aspect getAspect() {
            return aspect;
        }

        Signal(String name, Aspect aspect, Signal master) {
            super(String.format("signal/%s", name));
            this.aspect = aspect;
            if (master != null)
                master.addSubscriber(this);
        }

        /**
         * Sets the aspect of the signal, creating an event in case it changes.
         * @param sim the simulation
         * @param newAspect the new aspect of the signal
         * @throws SimulationError if there's a logic error
         */
        public void setAspect(Simulation sim, Aspect newAspect) throws SimulationError {
            if (newAspect == aspect)
                return;
            var change = new SignalAspectChange(sim, this, newAspect);
            this.event(sim, sim.getTime(), change);
            change.apply(sim, this);
        }

        @Override
        @SuppressFBWarnings(value = "BC_UNCONFIRMED_CAST")
        protected void timelineEventUpdate(
                Simulation sim,
                TimelineEvent<?> event,
                TimelineEvent.State state
        ) throws SimulationError {
            if (event.value.getClass() == SignalAspectChange.class)
                masterAspectChanged(sim, (SignalAspectChange)event.value, state);
        }

        private void masterAspectChanged(
                Simulation sim,
                SignalAspectChange event,
                TimelineEvent.State state
        ) throws SimulationError {
            var newAspect = aspect;
            if (event.newAspect == RED) {
                newAspect = YELLOW;
            } else {
                newAspect = GREEN;
            }

            setAspect(sim, newAspect);
        }
    }

    @Test
    public void testSignaling() throws SimulationError {
        var sim = new Simulation(null, 0.0, null);
        final var masterSignal = new Signal("master", GREEN, null);
        final var slaveSignal = new Signal("slave", GREEN, masterSignal);
        masterSignal.setAspect(sim, RED);

        assertFalse(sim.isSimulationOver());
        assertEquals(new SignalAspectChange(sim, masterSignal, RED), sim.step());
        assertEquals(new SignalAspectChange(sim, slaveSignal, YELLOW), sim.step());
        assertTrue(sim.isSimulationOver());

        // we must be able to unsubscribe sinks
        masterSignal.removeSubscriber(slaveSignal);
        masterSignal.setAspect(sim, YELLOW);
        assertEquals(new SignalAspectChange(sim, masterSignal, YELLOW), sim.step());
        assertTrue(sim.isSimulationOver());
    }
}
