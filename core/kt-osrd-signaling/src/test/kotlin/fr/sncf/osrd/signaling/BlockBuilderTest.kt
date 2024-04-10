package fr.sncf.osrd.signaling

import fr.sncf.osrd.signaling.impl.MockSigSystemManager
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.blockInfraBuilder
import fr.sncf.osrd.sim_infra.impl.rawInfraBuilder
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.*
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
        //             S
        //  <-- reverse     normal -->

        // region build the test infrastructure
        val builder = rawInfraBuilder()
        // region switches
        val switch =
            builder.movableElement("S", delay = 10L.milliseconds) {
                config("xy", Pair(TrackNodePortId(0u), TrackNodePortId(1u)))
                config("vy", Pair(TrackNodePortId(0u), TrackNodePortId(2u)))
            }
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
            builder.physicalSignal("Y", 300.meters) {
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

        val simulator =
            SignalingSimulatorImpl(
                MockSigSystemManager(
                    "BAL",
                    SigSettingsSchema { flag("Nf") },
                    SigParametersSchema { flag("jaune_cli") }
                )
            )
        val loadedSignalInfra = simulator.loadSignals(infra)
        val blockInfra = simulator.buildBlocks(infra, loadedSignalInfra)

        val testResultBlockInfra =
            blockInfraBuilder(loadedSignalInfra, infra) {
                // TODO: check the distances are correct too
                block(
                    true,
                    false,
                    mutableStaticIdxArrayListOf(zonePathUV),
                    infra.getLogicalSignals(signalV),
                    mutableOffsetArrayListOf()
                )
                block(
                    false,
                    true,
                    mutableStaticIdxArrayListOf(zonePathVY, zonePathYZ),
                    infra.getLogicalSignals(signalV),
                    mutableOffsetArrayListOf()
                )
                block(
                    true,
                    false,
                    mutableStaticIdxArrayListOf(zonePathWX),
                    infra.getLogicalSignals(signalX),
                    mutableOffsetArrayListOf()
                )
                block(
                    false,
                    true,
                    mutableStaticIdxArrayListOf(zonePathXY, zonePathYZ),
                    infra.getLogicalSignals(signalX),
                    mutableOffsetArrayListOf()
                )
            }

        assertTrue(blockInfraEquals(blockInfra, testResultBlockInfra))
    }

    data class BlockDescriptor(
        val path: StaticIdxList<ZonePath>,
        val signals: StaticIdxList<LogicalSignal>
    )

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
