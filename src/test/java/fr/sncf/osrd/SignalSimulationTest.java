package fr.sncf.osrd;

import static fr.sncf.osrd.SignalSimulationTest.Signal.Aspect.*;
import static org.junit.jupiter.api.Assertions.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.utils.*;
import org.junit.jupiter.api.Test;

import java.util.Objects;

public class SignalSimulationTest {
    public static final class SignalChange extends BaseChange {
        public final Signal signal;
        public final Signal.Aspect aspect;

        public SignalChange(Signal signal, Signal.Aspect aspect) {
            this.signal = signal;
            this.aspect = aspect;
        }

        @Override
        public boolean equals(Object obj) {
            if (obj == null)
                return false;

            if (this.getClass() != obj.getClass())
                return false;

            var o = (SignalChange) obj;
            return this.signal == o.signal && this.aspect == o.aspect;
        }

        @Override
        public int hashCode() {
            return Objects.hash(signal, aspect);
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

        Signal(Aspect aspect, Signal master) {
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
            this.event(sim, sim.getTime(), new SignalChange(this, newAspect));
            this.aspect = newAspect;
        }

        @Override
        @SuppressFBWarnings(value = "BC_UNCONFIRMED_CAST")
        protected void timelineEventUpdate(
                Simulation sim,
                TimelineEvent<?> event,
                TimelineEvent.State state
        ) throws SimulationError {
            if (event.value.getClass() == SignalChange.class)
                masterAspectChanged(sim, (SignalChange)event.value, state);
        }

        private void masterAspectChanged(
                Simulation sim,
                SignalChange event,
                TimelineEvent.State state
        ) throws SimulationError {
            var newAspect = aspect;
            if (event.aspect == RED) {
                newAspect = YELLOW;
            } else {
                newAspect = GREEN;
            }

            setAspect(sim, newAspect);
        }
    }

    @Test
    public void testSignaling() throws SimulationError {
        var sim = new Simulation(null, 0.0);
        final var masterSignal = new Signal(GREEN, null);
        final var slaveSignal = new Signal(GREEN, masterSignal);
        masterSignal.setAspect(sim, RED);

        assertFalse(sim.isSimulationOver());
        assertEquals(new SignalChange(masterSignal, RED), sim.step());
        assertEquals(new SignalChange(slaveSignal, YELLOW), sim.step());
        assertTrue(sim.isSimulationOver());

        // we must be able to unsubscribe sinks
        masterSignal.removeSubscriber(slaveSignal);
        masterSignal.setAspect(sim, YELLOW);
        assertEquals(new SignalChange(masterSignal, YELLOW), sim.step());
        assertTrue(sim.isSimulationOver());
    }
}
