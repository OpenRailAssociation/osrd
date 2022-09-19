package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.api.stdcm.new_pipeline.BlockPath;
import fr.sncf.osrd.api.stdcm.new_pipeline.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.new_pipeline.STDCMSimulation;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.FlatPath;
import org.junit.jupiter.api.Test;
import java.util.Set;

public class STDCMSimulationTests {

    @Test
    public void simpleTest() {
        // This test only checks that nothing crashes on a very simple case
        var path = new BlockPath(
                new FlatPath(1000, 0),
                Set.of(new OccupancyBlock(0, Double.POSITIVE_INFINITY, 0, 1000))
        );
        var res = STDCMSimulation.makeSTDCMEnvelope(path, REALISTIC_FAST_TRAIN);
        checkResult(path, res);
    }

    @Test
    public void simpleDelay() {
        // The second half of the path is not available yet when we reach it going at max speed
        var physicsPath = new FlatPath(10000, 0);
        var testContext = new EnvelopeSimContext(REALISTIC_FAST_TRAIN, physicsPath, TIME_STEP);
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 60, new double[]{});
        var timeAtMiddle = maxEffortEnvelope.interpolateTotalTime(5000);
        var path = new BlockPath(
                physicsPath,
                Set.of(
                        new OccupancyBlock(0, Double.POSITIVE_INFINITY, 0, 5000),
                        new OccupancyBlock(timeAtMiddle + 60, Double.POSITIVE_INFINITY, 5000, 10000)
                )
        );
        var res = STDCMSimulation.makeSTDCMEnvelope(path, REALISTIC_FAST_TRAIN);
        checkResult(path, res);
    }

    @Test
    public void narrowOpening() {
        // We need to add a lot of delay in a very narrow area in the middle of the path,
        // which forces us to enter and leave that area at low speed
        var physicsPath = new FlatPath(10000, 0);
        var testContext = new EnvelopeSimContext(REALISTIC_FAST_TRAIN, physicsPath, TIME_STEP);
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 60, new double[]{});
        var timeAtMiddle = maxEffortEnvelope.interpolateTotalTime(5000);
        var path = new BlockPath(
                physicsPath,
                Set.of(
                        new OccupancyBlock(timeAtMiddle + 120, Double.POSITIVE_INFINITY, 0, 5000),
                        new OccupancyBlock(0, timeAtMiddle + 600, 5100, 10000)
                )
        );
        var res = STDCMSimulation.makeSTDCMEnvelope(path, REALISTIC_FAST_TRAIN);
        checkResult(path, res);
    }

    /** Checks that the result is continuous, starts and ends at speed = 0,
     * and doesn't step outside the boundaries */
    public static void checkResult(BlockPath path, Envelope result) {
        assertNotNull(result);
        assertTrue(result.continuous);
        assertTrue(Math.abs(result.getEndSpeed()) < 1e-5);
        assertTrue(Math.abs(result.getBeginSpeed()) < 1e-5);
        for (var block : path.blocks()) {
            var entryTime = result.interpolateTotalTime(block.distanceStart());
            var exitTime = result.interpolateTotalTime(block.distanceEnd());
            assertTrue(entryTime >= block.timeStart());
            assertTrue(exitTime <= block.timeEnd());
        }
    }
}
