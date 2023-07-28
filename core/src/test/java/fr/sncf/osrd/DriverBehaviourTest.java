package fr.sncf.osrd;

import static fr.sncf.osrd.envelope_sim_infra.MRSP.computeMRSP;

import fr.sncf.osrd.api.utils.PathPropUtils;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.DummyInfra;
import fr.sncf.osrd.utils.units.Distance;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import java.util.List;

public class DriverBehaviourTest {
    @Test
    public void mrspWithDriverBehaviour() {
        var infra = DummyInfra.make();
        var blocks = List.of(
                infra.addBlock("a", "b", Distance.fromMeters(100), 20),
                infra.addBlock("b", "c", Distance.fromMeters(100), 10),
                infra.addBlock("c", "d", Distance.fromMeters(100), 20)
        );
        var path = PathPropUtils.makePathProps(infra, infra, blocks, 0);
        var testRollingStock = TestTrains.VERY_SHORT_FAST_TRAIN;
        var driverBehaviour = new DriverBehaviour(2, 3);
        var mrsp = computeMRSP(path, testRollingStock, true, null);
        mrsp = driverBehaviour.applyToMRSP(mrsp);
        Assertions.assertEquals(20, mrsp.interpolateSpeedRightDir(0, 1));
        Assertions.assertEquals(10, mrsp.interpolateSpeedRightDir(100 - 3, 1));
        Assertions.assertEquals(20, mrsp.interpolateSpeedRightDir(200 + 2 + testRollingStock.length, 1));
    }
}
