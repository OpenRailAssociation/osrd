package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.bapr.BAPR
import fr.sncf.osrd.signaling.bapr.BAPRtoBAL
import fr.sncf.osrd.signaling.bapr.BAPRtoBAPR
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilder
import fr.sncf.osrd.utils.indexing.IdxMap
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import kotlin.test.Test
import kotlin.test.assertEquals

class TestBAPRtoBAL {
    @Test
    fun testBAPRtoBAL() {
        // All "I" mark the location of detectors, which delimit zones.
        // w   m M x  n  N y       z
        // I---A---I---B---I---C---I
        //
        //  <-- reverse     normal -->
        // m, n: BAPR distant
        // M: BAPR
        // N: BAL

        // region build the test infrastructure
        val builder = RawInfraBuilder()

        // region zones
        val zoneA = builder.zone(listOf())
        val zoneB = builder.zone(listOf())
        val zoneC = builder.zone(listOf())

        val detectorW = builder.detector("w")
        builder.setNextZone(detectorW.normal, zoneA)
        val detectorX = builder.detector("X")
        builder.setNextZone(detectorX.normal, zoneB)
        builder.setNextZone(detectorX.reverse, zoneA)
        val detectorY = builder.detector("Y")
        builder.setNextZone(detectorY.normal, zoneC)
        builder.setNextZone(detectorY.reverse, zoneB)
        val detectorZ = builder.detector("Z")
        builder.setNextZone(detectorZ.reverse, zoneC)
        // endregion

        // region signals
        val signalm = builder.physicalSignal("m", 300.meters) {
            logicalSignal("BAPR", listOf("BAPR"), mapOf(Pair("distant", "true"),Pair("Nf", "false")))
        }
        val signalM = builder.physicalSignal("M", 300.meters) {
            logicalSignal("BAPR", listOf("BAPR"), mapOf(Pair("distant", "false"),Pair("Nf", "true")))
        }
        val signaln = builder.physicalSignal("n", 300.meters) {
            logicalSignal("BAPR", listOf("BAL"), mapOf(Pair("distant", "true"),Pair("Nf", "false")))
        }
        val signalN = builder.physicalSignal("N", 300.meters) {
            logicalSignal("BAL", listOf("BAL"), mapOf(Pair("Nf", "true")))
        }

        // endregion

        // region zone paths
        val zonePathWX = builder.zonePath(detectorW.normal, detectorX.normal, 10.meters) {
            signal(signalm, 6.meters)
            signal(signalM, 8.meters)
        }
        val zonePathXY = builder.zonePath(detectorX.normal, detectorY.normal, 10.meters) {
            signal(signaln, 6.meters)
            signal(signalN, 8.meters)
        }
        val zonePathYZ = builder.zonePath(detectorY.normal, detectorZ.normal, 10.meters)

        // endregion

        // region routes
        // create a route from W to Z
        builder.route("W-Z") {
            zonePath(zonePathWX) // zone B
            zonePath(zonePathXY) // zone C
            zonePath(zonePathYZ) // zone D
        }
        // endregion
        val infra = builder.build()
        // endregion

        val sigSystemManager = SigSystemManagerImpl()
        sigSystemManager.addSignalingSystem(BAL)
        sigSystemManager.addSignalingSystem(BAPR)
        sigSystemManager.addSignalDriver(BALtoBAL)
        sigSystemManager.addSignalDriver(BAPRtoBAPR)
        sigSystemManager.addSignalDriver(BAPRtoBAL)
        val simulator = SignalingSimulatorImpl(sigSystemManager)
        val loadedSignalInfra = simulator.loadSignals(infra)
        val blockInfra = simulator.buildBlocks(infra, loadedSignalInfra)
        val fullPath = mutableStaticIdxArrayListOf<Block>()
        fullPath.add(blockInfra.getBlocksAt(detectorW.normal).first())
        fullPath.add(blockInfra.getBlocksAt(detectorX.normal).first())
        fullPath.add(blockInfra.getBlocksAt(detectorY.normal).first())
        val zoneStates = mutableListOf(ZoneStatus.CLEAR, ZoneStatus.CLEAR, ZoneStatus.INCOMPATIBLE)
        val res = simulator.evaluate(infra, loadedSignalInfra, blockInfra, fullPath, 0, fullPath.size, zoneStates)
        val logicalSignals = listOf(signalm, signalM, signaln, signalN).map{loadedSignalInfra.getLogicalSignals(it).first()}
        val expectedAspects = listOf("VL", "VL", "A", "C")
        asserSignalListAspectEquals(expectedAspects, res, logicalSignals)
    }

    private fun asserSignalListAspectEquals(expectedAspects: List<String>, actualAspects: IdxMap<LogicalSignalId, SigState>, signals: List<LogicalSignalId>) {
        for ((aspect, signal) in expectedAspects.zip(signals)) {
            assertEquals(aspect, actualAspects[signal]!!.getEnum("aspect"))
        }
    }
}
