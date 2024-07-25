package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.railjson.builder.begin
import fr.sncf.osrd.railjson.builder.buildParseRJSInfra
import fr.sncf.osrd.railjson.builder.end
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import kotlin.test.Test
import kotlin.test.assertEquals

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
        val infra = buildParseRJSInfra {
            val lowerLeftTrack = trackSection("lower_left", 15.0)
            val upperLeftTrack = trackSection("upper_left", 15.0)
            val rightTrack = trackSection("right", 15.0)
            val switch =
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
            physicalSignal("X", lowerLeftTrack.at(7.0), EdgeDirection.STOP_TO_START) {
                logicalSignal(logicalSignalTemplate)
            }

            physicalSignal("V", upperLeftTrack.at(7.0), EdgeDirection.STOP_TO_START) {
                logicalSignal(logicalSignalTemplate)
            }

            route("U-Z", detU, EdgeDirection.STOP_TO_START, detZ) {
                addTrackNodeDirection(switch, "A_B2")
            }
            route("W-Z", detW, EdgeDirection.STOP_TO_START, detZ) {
                addReleaseDetector(detY)
                addTrackNodeDirection(switch, "A_B1")
            }
        }

        val detectors = infra.detectors.associateBy { infra.getDetectorName(it) }
        val detU = detectors["U"]!!
        val detV = detectors["V"]!!
        val signals = infra.physicalSignals.associateBy { infra.getPhysicalSignalName(it) }
        val signalV = signals["V"]!!

        val sigSystemManager = SigSystemManagerImpl()
        sigSystemManager.addSignalingSystem(BAL)
        sigSystemManager.addSignalDriver(BALtoBAL)
        val simulator = SignalingSimulatorImpl(sigSystemManager)
        val loadedSignalInfra = simulator.loadSignals(infra)
        val blockInfra = simulator.buildBlocks(infra, loadedSignalInfra)
        val fullPath = mutableStaticIdxArrayListOf<Block>()
        fullPath.add(blockInfra.getBlocksStartingAtDetector(detU.decreasing).first())
        fullPath.add(blockInfra.getBlocksStartingAtDetector(detV.decreasing).first())
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
