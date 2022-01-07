package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_sim.EnvelopeShape.*;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopePart;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;

public class EnvelopeMaintainSpeedTest {
    @Test
    public void suddenSlope() {
        var stops = new double[] { };
        var envelopePath = new EnvelopePath(
                10000,
                new double[] { 0, 5000, 6000, 7000, 8000, 8500, 9000, 10000 },
                new double[] { 0, 40, -40, 0, 50, -50, 0 }
        );
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;

        var flatMRSP = Envelope.make(
                EnvelopePart.generateTimes(null, new double[] { 0, 10000 }, new double[] { 44.4, 44.4})
        );
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(testRollingStock, envelopePath, stops, flatMRSP);
        var maxEffortEnvelope = MaxEffortEnvelope.from(testRollingStock, envelopePath, 0, maxSpeedEnvelope);
        EnvelopeShape.check(maxEffortEnvelope, new EnvelopeShape[][] {
                {INCREASING}, {CONSTANT},
                {DECREASING, INCREASING}, {CONSTANT},
                {DECREASING, INCREASING}, {CONSTANT}
        });
        assertTrue(maxEffortEnvelope.continuous);
    }
}
