package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.meters
import fr.sncf.osrd.sim_infra.api.normal
import fr.sncf.osrd.sim_infra.api.reverse
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilder
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.milliseconds

class TestBALtoBAL {
    @Test
    fun testBALtoBAL() {
        // All "I" mark the location of detectors, which delimit zones.
        //
        // u      v
        // I---A--I-+
        //           \
        // w       x  \    y       z
        // I---B---I---C---I---D---I
        //
        //  <-- reverse     normal -->

        // region build the test infrastructure
        val builder = RawInfraBuilder()
        // region switches
        val switch = builder.movableElement(delay = 10L.milliseconds) {
            config("xy")
            config("vy")
        }
        // endregion

        // region zones
        val zoneA = builder.zone(listOf())
        val zoneB = builder.zone(listOf())
        val zoneC = builder.zone(listOf(switch))
        val zoneD = builder.zone(listOf())

        val detectorU = builder.detector("U")
        builder.setNextZone(detectorU.normal, zoneA)
        val detectorV = builder.detector("V")
        builder.setNextZone(detectorV.normal, zoneC)
        builder.setNextZone(detectorV.reverse, zoneA)
        val detectorW = builder.detector("W")
        builder.setNextZone(detectorW.normal, zoneB)
        val detectorX = builder.detector("X")
        builder.setNextZone(detectorX.normal, zoneC)
        builder.setNextZone(detectorX.reverse, zoneB)
        val detectorY = builder.detector("Y")
        builder.setNextZone(detectorY.normal, zoneD)
        builder.setNextZone(detectorY.reverse, zoneC)
        val detectorZ = builder.detector("Z")
        builder.setNextZone(detectorZ.reverse, zoneD)
        // endregion

        // region signals
        val signalX = builder.physicalSignal("X", 300.meters) {
            logicalSignal("BAL", listOf("BAL"), mapOf(Pair("Nf", "true")))
        }
        val signalV = builder.physicalSignal("V", 300.meters) {
            logicalSignal("BAL", listOf("BAL"), mapOf(Pair("Nf", "true")))
        }
        // endregion

        // region zone paths
        val zonePathWX = builder.zonePath(detectorW.normal, detectorX.normal, 10.meters) {
            signal(signalX, 8.meters)
        }
        val zonePathXY = builder.zonePath(detectorX.normal, detectorY.normal, 10.meters) {
            movableElement(switch, StaticIdx(0u), 5.meters)
        }
        val zonePathYZ = builder.zonePath(detectorY.normal, detectorZ.normal, 10.meters)
        val zonePathUV = builder.zonePath(detectorU.normal, detectorV.normal, 10.meters) {
            signal(signalV, 8.meters)
        }
        val zonePathVY = builder.zonePath(detectorV.normal, detectorY.normal, 10.meters) {
            movableElement(switch, StaticIdx(1u), 5.meters)
        }
        // endregion

        // region routes
        // create a route from W to Z, releasing at Y and Z
         builder.route("W-Z") {
            zonePath(zonePathWX) // zone B
            zonePath(zonePathXY) // zone C
            zonePath(zonePathYZ) // zone D
            // release at zone C and D
            releaseZone(1)
            releaseZone(2)
        }

        // create a route from U to Z, releasing at Z
        builder.route("U-Z") {
            zonePath(zonePathUV) // zone A
            zonePath(zonePathVY) // zone C
            zonePath(zonePathYZ) // zone D
            // release at zone D
            releaseZone(2)
        }
        // endregion
        val infra = builder.build()
        // endregion

        val sigSystemManager = SigSystemManagerImpl()
        sigSystemManager.addSignalingSystem(BAL)
        sigSystemManager.addSignalDriver(BALtoBAL)
        val simulator = SignalingSimulatorImpl(sigSystemManager)
        val loadedSignalInfra = simulator.loadSignals(infra)
        val blockInfra = simulator.buildBlocks(infra, loadedSignalInfra)
        val fullPath = mutableStaticIdxArrayListOf<Block>()
        fullPath.add(blockInfra.getBlocksAtDetector(detectorU.normal).first())
        fullPath.add(blockInfra.getBlocksAtDetector(detectorV.normal).first())
        val zoneStates = mutableListOf(ZoneStatus.CLEAR, ZoneStatus.CLEAR, ZoneStatus.CLEAR)
        val res = simulator.evaluate(infra, loadedSignalInfra, blockInfra, fullPath, 0, fullPath.size, zoneStates, ZoneStatus.INCOMPATIBLE)
        assertEquals("A", res[loadedSignalInfra.getLogicalSignals(signalV).first()]!!.getEnum("aspect"))
    }
}
