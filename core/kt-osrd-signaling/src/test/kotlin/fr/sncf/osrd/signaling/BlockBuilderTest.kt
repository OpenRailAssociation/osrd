package fr.sncf.osrd.signaling

import fr.sncf.osrd.signaling.impl.DumbBALSigSystemManager
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.api.SignalDriver
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilder
import fr.sncf.osrd.sim_infra.impl.blockInfraBuilder
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdxSpace
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import java.lang.RuntimeException
import kotlin.test.Test
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.milliseconds

class BlockBuilderTest {
    @Test
    fun testBlockBuilder() {
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
        val signalV = builder.physicalSignal("Y", 300.meters) {
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

        val simulator = SignalingSimulatorImpl(DumbBALSigSystemManager)
        val loadedSignalInfra = simulator.loadSignals(infra)
        val blockInfra = simulator.buildBlocks(infra, loadedSignalInfra)

        val testResultBlockInfra = blockInfraBuilder(loadedSignalInfra, infra) {
            block(true, false, mutableStaticIdxArrayListOf(zonePathUV), infra.getLogicalSignals(signalV))
            block(false, true, mutableStaticIdxArrayListOf(zonePathVY, zonePathYZ), infra.getLogicalSignals(signalV))
            block(true, false, mutableStaticIdxArrayListOf(zonePathWX), infra.getLogicalSignals(signalX))
            block(false, true, mutableStaticIdxArrayListOf(zonePathXY, zonePathYZ), infra.getLogicalSignals(signalX))
        }

        assertTrue(blockInfraEquals(blockInfra, testResultBlockInfra))
    }

    data class BlockDescriptor(val path: StaticIdxList<ZonePath>, val signals: StaticIdxList<LogicalSignal>)

    private fun blockInfraToSet(infra: BlockInfra): MutableSet<BlockDescriptor> {
        val res: MutableSet<BlockDescriptor> = mutableSetOf()
        for (blockId in infra.blocks) {
            res.add(BlockDescriptor(infra.getBlockPath(blockId), infra.getBlockSignals(blockId)))
        }
        return res
    }

    private fun blockInfraEquals(a: BlockInfra, b: BlockInfra): Boolean {
        val setA = blockInfraToSet(a)
        val setB = blockInfraToSet(b)
        return setA == setB
    }
}
