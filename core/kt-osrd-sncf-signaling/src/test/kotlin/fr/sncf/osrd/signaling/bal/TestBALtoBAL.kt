package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.RawInfraFromRjsBuilderImpl
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticPool
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.ZERO

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
        //             S
        //  <-- reverse     normal -->

        // region build the test infrastructure
        val builder = RawInfraFromRjsBuilderImpl()
        // region switches
        val switch = builder.node("S", ZERO, StaticPool(), StaticPool())
        // endregion

        // region zones
        val zoneA = builder.zone(listOf())
        val zoneB = builder.zone(listOf())
        val zoneC = builder.zone(listOf(switch))
        val zoneD = builder.zone(listOf())

        val detectorU = builder.detector("U")
        builder.setNextZone(detectorU.increasing, zoneA)
        val detectorV = builder.detector("V")
        builder.setNextZone(detectorV.increasing, zoneC)
        builder.setNextZone(detectorV.decreasing, zoneA)
        val detectorW = builder.detector("W")
        builder.setNextZone(detectorW.increasing, zoneB)
        val detectorX = builder.detector("X")
        builder.setNextZone(detectorX.increasing, zoneC)
        builder.setNextZone(detectorX.decreasing, zoneB)
        val detectorY = builder.detector("Y")
        builder.setNextZone(detectorY.increasing, zoneD)
        builder.setNextZone(detectorY.decreasing, zoneC)
        val detectorZ = builder.detector("Z")
        builder.setNextZone(detectorZ.decreasing, zoneD)
        // endregion

        // region signals
        val parameters = RawSignalParameters(mapOf(Pair("jaune_cli", "false")), mapOf())

        val signalX =
            builder.physicalSignal("X", 300.meters) {
                logicalSignal("BAL", listOf("BAL"), mapOf(Pair("Nf", "true")), parameters)
            }
        val signalV =
            builder.physicalSignal("V", 300.meters) {
                logicalSignal("BAL", listOf("BAL"), mapOf(Pair("Nf", "true")), parameters)
            }
        // endregion

        // region zone paths
        val zonePathWX =
            builder.zonePath(detectorW.increasing, detectorX.increasing, Length(10.meters)) {
                signal(signalX, Offset(8.meters))
            }
        val zonePathXY =
            builder.zonePath(detectorX.increasing, detectorY.increasing, Length(10.meters)) {
                movableElement(switch, StaticIdx(0u), Offset(5.meters))
            }
        val zonePathYZ =
            builder.zonePath(detectorY.increasing, detectorZ.increasing, Length(10.meters))
        val zonePathUV =
            builder.zonePath(detectorU.increasing, detectorV.increasing, Length(10.meters)) {
                signal(signalV, Offset(8.meters))
            }
        val zonePathVY =
            builder.zonePath(detectorV.increasing, detectorY.increasing, Length(10.meters)) {
                movableElement(switch, StaticIdx(1u), Offset(5.meters))
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
        fullPath.add(blockInfra.getBlocksStartingAtDetector(detectorU.increasing).first())
        fullPath.add(blockInfra.getBlocksStartingAtDetector(detectorV.increasing).first())
        val zoneStates = mutableListOf(ZoneStatus.CLEAR, ZoneStatus.CLEAR, ZoneStatus.CLEAR)
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
        assertEquals(
            "A",
            res[loadedSignalInfra.getLogicalSignals(signalV).first()]!!.getEnum("aspect")
        )
    }
}
