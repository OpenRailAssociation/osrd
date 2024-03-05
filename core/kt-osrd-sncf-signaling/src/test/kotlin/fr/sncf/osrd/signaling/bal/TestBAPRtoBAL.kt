package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.bapr.BAPR
import fr.sncf.osrd.signaling.bapr.BAPRtoBAL
import fr.sncf.osrd.signaling.bapr.BAPRtoBAPR
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilder
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
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
        builder.setNextZone(detectorW.increasing, zoneA)
        val detectorX = builder.detector("X")
        builder.setNextZone(detectorX.increasing, zoneB)
        builder.setNextZone(detectorX.decreasing, zoneA)
        val detectorY = builder.detector("Y")
        builder.setNextZone(detectorY.increasing, zoneC)
        builder.setNextZone(detectorY.decreasing, zoneB)
        val detectorZ = builder.detector("Z")
        builder.setNextZone(detectorZ.decreasing, zoneC)
        // endregion

        // region signals
        val signalm =
            builder.physicalSignal("m", 300.meters) {
                logicalSignal(
                    "BAPR",
                    listOf("BAPR"),
                    mapOf(Pair("distant", "true"), Pair("Nf", "false"))
                )
            }
        val signalM =
            builder.physicalSignal("M", 300.meters) {
                logicalSignal(
                    "BAPR",
                    listOf("BAPR"),
                    mapOf(Pair("distant", "false"), Pair("Nf", "true"))
                )
            }
        val signaln =
            builder.physicalSignal("n", 300.meters) {
                logicalSignal(
                    "BAPR",
                    listOf("BAL"),
                    mapOf(Pair("distant", "true"), Pair("Nf", "false"))
                )
            }
        val signalN =
            builder.physicalSignal("N", 300.meters) {
                logicalSignal("BAL", listOf("BAL"), mapOf(Pair("Nf", "true")))
            }

        // endregion

        // region zone paths
        val zonePathWX =
            builder.zonePath(detectorW.increasing, detectorX.increasing, Length(10.meters)) {
                signal(signalm, Offset(6.meters))
                signal(signalM, Offset(8.meters))
            }
        val zonePathXY =
            builder.zonePath(detectorX.increasing, detectorY.increasing, Length(10.meters)) {
                signal(signaln, Offset(6.meters))
                signal(signalN, Offset(8.meters))
            }
        val zonePathYZ =
            builder.zonePath(detectorY.increasing, detectorZ.increasing, Length(10.meters))

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
        fullPath.add(blockInfra.getBlocksStartingAtDetector(detectorW.increasing).first())
        fullPath.add(blockInfra.getBlocksStartingAtDetector(detectorX.increasing).first())
        fullPath.add(blockInfra.getBlocksStartingAtDetector(detectorY.increasing).first())
        val zoneStates = mutableListOf(ZoneStatus.CLEAR, ZoneStatus.CLEAR, ZoneStatus.INCOMPATIBLE)
        val res =
            simulator.evaluate(
                infra,
                loadedSignalInfra,
                blockInfra,
                fullPath,
                fullPath.size,
                zoneStates,
                ZoneStatus.INCOMPATIBLE
            )
        val logicalSignals =
            listOf(signalm, signalM, signaln, signalN).map {
                loadedSignalInfra.getLogicalSignals(it).first()
            }
        val expectedAspects = listOf("VL", "VL", "A", "C")
        asserSignalListAspectEquals(expectedAspects, res, logicalSignals)
    }

    private fun asserSignalListAspectEquals(
        expectedAspects: List<String>,
        actualAspects: Map<LogicalSignalId, SigState>,
        signals: List<LogicalSignalId>
    ) {
        for ((aspect, signal) in expectedAspects.zip(signals)) {
            assertEquals(aspect, actualAspects[signal]!!.getEnum("aspect"))
        }
    }
}
