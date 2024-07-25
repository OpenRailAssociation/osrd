package fr.sncf.osrd.signaling

import fr.sncf.osrd.railjson.builder.begin
import fr.sncf.osrd.railjson.builder.buildParseRJSInfra
import fr.sncf.osrd.railjson.builder.end
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.STOP_TO_START
import fr.sncf.osrd.signaling.impl.MockSigSystemManager
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.blockInfraBuilder
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.*
import kotlin.test.Test
import kotlin.test.assertTrue

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

        val infra = buildParseRJSInfra {
            val lowerLeftTrack = trackSection("lower_left", 15.0)
            val upperLeftTrack = trackSection("upper_left", 15.0)
            val rightTrack = trackSection("right", 15.0)
            val trackNode =
                pointSwitch("S", rightTrack.begin, lowerLeftTrack.begin, upperLeftTrack.begin, 0.01)
            val detU = bufferStop("U", upperLeftTrack.end)
            detector("V", upperLeftTrack.at(5.0))
            val detW = bufferStop("W", lowerLeftTrack.end)
            detector("X", lowerLeftTrack.at(5.0))
            val detY = detector("Y", rightTrack.at(5.0))
            val detZ = bufferStop("Z", rightTrack.end)

            val logicalSignalTemplate =
                logicalSignal("BAL") {
                    nextSignalingSystem("BAL")
                    setting("Nf", "true")
                    defaultParameter("jaune_cli", "false")
                }

            defaultSightDistance = 300.0
            physicalSignal("X", lowerLeftTrack.at(7.0), STOP_TO_START) {
                logicalSignal(logicalSignalTemplate)
            }

            physicalSignal("V", upperLeftTrack.at(7.0), STOP_TO_START) {
                logicalSignal(logicalSignalTemplate)
            }

            route("U-Z", detU, STOP_TO_START, detZ) { addTrackNodeDirection(trackNode, "A_B2") }
            route("W-Z", detW, STOP_TO_START, detZ) {
                addReleaseDetector(detY)
                addTrackNodeDirection(trackNode, "A_B1")
            }
        }

        val signals = infra.physicalSignals.associateBy { infra.getPhysicalSignalName(it) }
        val signalX = signals["X"]!!
        val signalV = signals["V"]!!
        val trackNode = infra.trackNodes[0]
        val trackNodeConfigs =
            infra.getTrackNodeConfigs(trackNode).associateBy {
                infra.getTrackNodeConfigName(trackNode, it)
            }
        val trackNodeLower = trackNodeConfigs["A_B1"]!!
        val trackNodeUpper = trackNodeConfigs["A_B2"]!!
        val detectors = infra.detectors.associateBy { infra.getDetectorName(it) }
        val detU = detectors["U"]!!
        val detV = detectors["V"]!!
        val detW = detectors["W"]!!
        val detX = detectors["X"]!!
        val detY = detectors["Y"]!!
        val detZ = detectors["Z"]!!
        val zonePathUV = infra.findZonePath(detU.decreasing, detV.decreasing)!!
        val zonePathWX = infra.findZonePath(detW.decreasing, detX.decreasing)!!
        val zonePathYZ = infra.findZonePath(detY.increasing, detZ.increasing)!!
        val zonePathVY =
            infra.findZonePath(
                detV.decreasing,
                detY.increasing,
                mutableStaticIdxArrayListOf(trackNode),
                mutableStaticIdxArrayListOf(trackNodeUpper)
            )!!
        val zonePathXY =
            infra.findZonePath(
                detX.decreasing,
                detY.increasing,
                mutableStaticIdxArrayListOf(trackNode),
                mutableStaticIdxArrayListOf(trackNodeLower)
            )!!

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
