package fr.sncf.osrd

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class DriverBehaviourTest {
    @Test
    fun mrspWithDriverBehaviour() {
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", 100.meters, 20.0),
                infra.addBlock("b", "c", 100.meters, 10.0),
                infra.addBlock("c", "d", 100.meters, 20.0)
            )
        val path: PathProperties = makePathProps(infra, infra, blocks, Length(0.meters), listOf())
        val testRollingStock = TestTrains.VERY_SHORT_FAST_TRAIN
        val driverBehaviour = DriverBehaviour(2.0, 3.0)
        var mrsp = computeMRSP(path, testRollingStock, true, null)
        mrsp = driverBehaviour.applyToMRSP(mrsp)
        Assertions.assertEquals(20.0, mrsp.interpolateSpeedRightDir(0.0, 1.0))
        Assertions.assertEquals(10.0, mrsp.interpolateSpeedRightDir((100 - 3).toDouble(), 1.0))
        Assertions.assertEquals(
            20.0,
            mrsp.interpolateSpeedRightDir(200 + 2 + testRollingStock.length, 1.0)
        )
    }
}
