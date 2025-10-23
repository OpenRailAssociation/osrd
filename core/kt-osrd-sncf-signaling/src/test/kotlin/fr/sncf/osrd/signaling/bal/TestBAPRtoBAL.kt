package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.path.implementations.buildTrainPathFromBlocks
import fr.sncf.osrd.railjson.builder.begin
import fr.sncf.osrd.railjson.builder.buildParseRJSInfra
import fr.sncf.osrd.railjson.builder.end
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.START_TO_STOP
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.bapr.BAPR
import fr.sncf.osrd.signaling.bapr.BAPRtoBAL
import fr.sncf.osrd.signaling.bapr.BAPRtoBAPR
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.increasing
import kotlin.test.Test
import kotlin.test.assertEquals

class TestBAPRtoBAL {
    @Test
    fun testBAPRtoBAL() {
        // All "I" mark the location of detectors, which delimit zones.
        // w   m M x  n  N y       z
        // I---A---I---B---I---C---I
        //
        // m, n: BAPR distant
        // M: BAPR
        // N: BAL

        val infra = buildParseRJSInfra {
            val track = trackSection("track", 30.0)
            val detectorW = detector("W", track.begin)
            val detectorX = detector("X", track.at(10.0))
            val detectorY = detector("Y", track.at(20.0))
            val detectorZ = detector("Z", track.end)

            route("W-Z", detectorW, START_TO_STOP, detectorZ)

            defaultSightDistance = 300.0
            physicalSignal("m", track.at(6.0), START_TO_STOP) {
                logicalSignal("BAPR") {
                    nextSignalingSystem("BAPR")
                    setting("distant", "true")
                    setting("Nf", "false")
                }
            }
            physicalSignal("M", track.at(8.0), START_TO_STOP) {
                logicalSignal("BAPR") {
                    nextSignalingSystem("BAPR")
                    setting("distant", "false")
                    setting("Nf", "true")
                }
            }
            physicalSignal("n", track.at(16.0), START_TO_STOP) {
                logicalSignal("BAPR") {
                    nextSignalingSystem("BAL")
                    setting("distant", "true")
                    setting("Nf", "false")
                }
            }
            physicalSignal("N", track.at(18.0), START_TO_STOP) {
                logicalSignal("BAL") {
                    nextSignalingSystem("BAL")
                    setting("Nf", "true")
                    defaultParameter("jaune_cli", "false")
                }
            }
        }

        val detectors = infra.detectors.associateBy { infra.getDetectorName(it) }
        val detW = detectors["W"]!!
        val detX = detectors["X"]!!
        val detY = detectors["Y"]!!
        val signals = infra.physicalSignals.associateBy { infra.getPhysicalSignalName(it) }
        val signalm = signals["m"]!!
        val signalM = signals["M"]!!
        val signaln = signals["n"]!!
        val signalN = signals["N"]!!

        val sigSystemManager = SigSystemManagerImpl()
        sigSystemManager.addSignalingSystem(BAPR, 0.50)
        sigSystemManager.addSignalingSystem(BAL, 0.40)
        sigSystemManager.addSignalDriver(BALtoBAL)
        sigSystemManager.addSignalDriver(BAPRtoBAPR)
        sigSystemManager.addSignalDriver(BAPRtoBAL)
        val simulator = SignalingSimulatorImpl(sigSystemManager)
        val loadedSignalInfra = simulator.loadSignals(infra)
        val blockInfra = simulator.buildBlocks(infra, loadedSignalInfra)
        val blocks =
            listOf(
                blockInfra.getBlocksStartingAtDetector(detW.increasing).first(),
                blockInfra.getBlocksStartingAtDetector(detX.increasing).first(),
                blockInfra.getBlocksStartingAtDetector(detY.increasing).first(),
            )
        val zoneStates = mutableListOf(ZoneStatus.CLEAR, ZoneStatus.CLEAR, ZoneStatus.INCOMPATIBLE)
        val trainPath =
            buildTrainPathFromBlocks(infra, blockInfra, blocks, routeNames = listOf("W-Z"))
        val res =
            simulator.evaluate(
                infra,
                loadedSignalInfra,
                blockInfra,
                trainPath,
                zoneStates,
                ZoneStatus.INCOMPATIBLE,
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
        signals: List<LogicalSignalId>,
    ) {
        for ((aspect, signal) in expectedAspects.zip(signals)) {
            assertEquals(aspect, actualAspects[signal]!!.getEnum("aspect"))
        }
    }
}
