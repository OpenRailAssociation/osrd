package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.signaling.tvm300.TVM300
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.rawInfraBuilder
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals

class TestTVM300toBAL {
    @Test
    fun testTVM300toBAL() {
        // All "I" mark the location of detectors, which delimit zones.
        // w     M x     N y       z
        // I---A---I---B---I---C---I
        //
        //  <-- reverse     normal -->
        // M: TVM300
        // N: BAL

        // region build the test infrastructure
        val builder = rawInfraBuilder()

        // region zones
        val zoneA = builder.zone(listOf())
        val zoneB = builder.zone(listOf())
        val zoneC = builder.zone(listOf())

        val detectorW = builder.detector("w")
        builder.setNextZone(detectorW.increasing, zoneA)
        val detectorX = builder.detector("x")
        builder.setNextZone(detectorX.increasing, zoneB)
        builder.setNextZone(detectorX.decreasing, zoneA)
        val detectorY = builder.detector("y")
        builder.setNextZone(detectorY.increasing, zoneC)
        builder.setNextZone(detectorY.decreasing, zoneB)
        val detectorZ = builder.detector("z")
        builder.setNextZone(detectorZ.decreasing, zoneC)
        // endregion

        // region signals
        val balParameters = RawSignalParameters(mapOf(Pair("jaune_cli", "false")), mapOf())
        val tvmParameters = RawSignalParameters(mapOf(), mapOf())
        val signalM =
            builder.physicalSignal("M", 0.meters, StaticIdx(0u), Offset(0.meters)) {
                logicalSignal(
                    "TVM300",
                    listOf("BAL"),
                    mapOf(
                        Pair("Nf", "true"),
                    ),
                    tvmParameters
                )
            }
        val signalN =
            builder.physicalSignal("N", 300.meters, StaticIdx(0u), Offset(0.meters)) {
                logicalSignal("BAL", listOf("BAL"), mapOf(Pair("Nf", "true")), balParameters)
            }

        // endregion

        // region zone paths
        val zonePathWX =
            builder.zonePath(detectorW.increasing, detectorX.increasing, Length(10.meters)) {
                signal(signalM, Offset(8.meters))
            }
        val zonePathXY =
            builder.zonePath(detectorX.increasing, detectorY.increasing, Length(10.meters)) {
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
        sigSystemManager.addSignalingSystem(TVM300)
        sigSystemManager.addSignalDriver(BALtoTVM300)
        sigSystemManager.addSignalDriver(BALtoBAL)
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
                listOf(), // we don't use parameters here
                fullPath.size,
                zoneStates,
                ZoneStatus.INCOMPATIBLE
            )
        val logicalSignals =
            listOf(signalM, signalN).map { loadedSignalInfra.getLogicalSignals(it).first() }
        val expectedAspects = listOf("000", "C")
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
