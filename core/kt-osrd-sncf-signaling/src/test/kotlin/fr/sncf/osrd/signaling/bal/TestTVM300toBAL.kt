package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.path.implementations.buildTrainPathFromBlocks
import fr.sncf.osrd.railjson.builder.begin
import fr.sncf.osrd.railjson.builder.buildParseRJSInfra
import fr.sncf.osrd.railjson.builder.end
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.START_TO_STOP
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.signaling.tvm300.TVM300
import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.increasing
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

        val infra = buildParseRJSInfra {
            val track = trackSection("track", 30.0)
            val detectorW = detector("W", track.begin)
            val detectorX = detector("X", track.at(10.0))
            val detectorY = detector("Y", track.at(20.0))
            val detectorZ = detector("Z", track.end)

            route("W-Z", detectorW, START_TO_STOP, detectorZ)

            defaultSightDistance = 300.0
            // region signals
            physicalSignal("M", track.at(8.0), START_TO_STOP) {
                logicalSignal("TVM300") {
                    nextSignalingSystem("BAL")
                    setting("Nf", "true")
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
        val detectorW = detectors["W"]!!
        val detectorX = detectors["X"]!!
        val detectorY = detectors["Y"]!!
        val signals = infra.physicalSignals.associateBy { infra.getPhysicalSignalName(it) }
        val signalM = signals["M"]!!
        val signalN = signals["N"]!!

        val sigSystemManager = SigSystemManagerImpl()
        sigSystemManager.addSignalingSystem(BAL, 0.40)
        sigSystemManager.addSignalingSystem(TVM300, 0.30)
        sigSystemManager.addSignalDriver(BALtoTVM300)
        sigSystemManager.addSignalDriver(BALtoBAL)
        val simulator = SignalingSimulatorImpl(sigSystemManager)
        val loadedSignalInfra = simulator.loadSignals(infra)
        val blockInfra = simulator.buildBlocks(infra, loadedSignalInfra)
        val blocks =
            listOf(
                blockInfra.getBlocksStartingAtDetector(detectorW.increasing).first(),
                blockInfra.getBlocksStartingAtDetector(detectorX.increasing).first(),
                blockInfra.getBlocksStartingAtDetector(detectorY.increasing).first(),
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
            listOf(signalM, signalN).map { loadedSignalInfra.getLogicalSignals(it).first() }
        val expectedAspects = listOf("000", "C")
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
