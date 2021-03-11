package fr.sncf.osrd;

import static fr.sncf.osrd.SignalSimulationTest.TestSignal.Aspect.*;
import static org.junit.jupiter.api.Assertions.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.*;
import org.junit.jupiter.api.Test;

import java.util.Objects;

public class SignalSimulationTest {
    public static final class SignalAspectChange extends EntityChange<TestSignal, MockEntityID<TestSignal>, Void> {
        public final TestSignal signal;
        public final TestSignal.Aspect newAspect;

        /**
         * Creates a change of signal aspect
         * @param sim the simulation
         * @param signal the signal for which the aspect changed
         * @param newAspect the new aspect of the signal
         */
        public SignalAspectChange(Simulation sim, TestSignal signal, TestSignal.Aspect newAspect) {
            super(sim, signal.getID());
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
        public Void apply(Simulation sim, TestSignal signal) {
            signal.aspect = newAspect;
            return null;
        }
    }

    public static class TestSignal extends AbstractEntity<TestSignal, MockEntityID<TestSignal>> {
        public enum Aspect {
            RED,
            YELLOW,
            GREEN,
        }

        private Aspect aspect;

        @SuppressWarnings("SameParameterValue")
        TestSignal(String name, Aspect aspect, TestSignal master) {
            super(new MockEntityID<>(name));
            this.aspect = aspect;
            if (master != null)
                master.subscribers.add(this);
        }

        /**
         * Sets the aspect of the signal, creating an event in case it changes.
         * @param sim the simulation
         * @param newAspect the new aspect of the signal
         */
        public void setAspect(Simulation sim, Aspect newAspect) {
            if (newAspect == aspect)
                return;
            var change = new SignalAspectChange(sim, this, newAspect);
            sim.scheduleEvent(this, sim.getTime(), change);
            change.apply(sim, this);
        }

        @Override
        @SuppressFBWarnings(value = "BC_UNCONFIRMED_CAST")
        public void onEventOccurred(
                Simulation sim,
                TimelineEvent<?> event
        ) {
            if (event.value.getClass() == SignalAspectChange.class)
                masterAspectChanged(sim, (SignalAspectChange) event.value);
        }

        @Override
        public void onEventCancelled(Simulation sim, TimelineEvent<?> event) {
        }

        private void masterAspectChanged(
                Simulation sim,
                SignalAspectChange event
        )  {
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
        var sim = Simulation.createWithoutInfra(0.0, null);
        final var masterSignal = new TestSignal("master", GREEN, null);
        final var slaveSignal = new TestSignal("slave", GREEN, masterSignal);
        masterSignal.setAspect(sim, RED);

        assertFalse(sim.isSimulationOver());
        assertEquals(new SignalAspectChange(sim, masterSignal, RED), sim.step());
        assertEquals(new SignalAspectChange(sim, slaveSignal, YELLOW), sim.step());
        assertTrue(sim.isSimulationOver());

        // we must be able to unsubscribe sinks
        masterSignal.subscribers.remove(slaveSignal);
        assertTrue(masterSignal.subscribers.isEmpty());
        masterSignal.setAspect(sim, YELLOW);
        assertEquals(new SignalAspectChange(sim, masterSignal, YELLOW), sim.step());
        assertTrue(sim.isSimulationOver());
    }
}
