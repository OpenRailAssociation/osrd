package fr.sncf.osrd.api

import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.SignalingSystemDriver
import fr.sncf.osrd.signaling.bal.*
import fr.sncf.osrd.signaling.bapr.*
import fr.sncf.osrd.signaling.etcs_level2.*
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.signaling.tvm300.*
import fr.sncf.osrd.signaling.tvm430.*

val signalingSystemCost =
    mapOf(BAPR to 0.50, BAL to 0.40, TVM300 to 0.30, TVM430 to 0.20, ETCS_LEVEL2 to 0.10)

fun addSignalingSystem(sigSystemManager: SigSystemManagerImpl, sigSystem: SignalingSystemDriver) {
    assert(signalingSystemCost.containsKey(sigSystem)) {
        "Trying to add a signaling system without cost"
    }
    sigSystemManager.addSignalingSystem(sigSystem, signalingSystemCost[sigSystem]!!)
}

/**
 * Configure the signaling simulator for all the supported signaling systems Mainly useful because
 * we can't do it directly from java due to compiler issues
 */
fun makeSignalingSimulator(): SignalingSimulator {
    val sigSystemManager = SigSystemManagerImpl()
    addSignalingSystem(sigSystemManager, BAL)
    addSignalingSystem(sigSystemManager, BAPR)
    addSignalingSystem(sigSystemManager, TVM300)
    addSignalingSystem(sigSystemManager, TVM430)
    addSignalingSystem(sigSystemManager, ETCS_LEVEL2)

    sigSystemManager.addSignalDriver(BALtoBAL)
    sigSystemManager.addSignalDriver(BALtoBAPR)
    sigSystemManager.addSignalDriver(BALtoTVM300)
    sigSystemManager.addSignalDriver(BALtoTVM430)
    sigSystemManager.addSignalDriver(BALtoETCS_LEVEL2)
    sigSystemManager.addSignalDriver(BAPRtoBAL)
    sigSystemManager.addSignalDriver(BAPRtoBAPR)
    sigSystemManager.addSignalDriver(BAPRtoTVM300)
    sigSystemManager.addSignalDriver(BAPRtoTVM430)
    sigSystemManager.addSignalDriver(BAPRtoETCS_LEVEL2)
    sigSystemManager.addSignalDriver(TVM300toBAL)
    sigSystemManager.addSignalDriver(TVM300toBAPR)
    sigSystemManager.addSignalDriver(TVM300toTVM300)
    sigSystemManager.addSignalDriver(TVM300toTVM430)
    sigSystemManager.addSignalDriver(TVM300toETCS_LEVEL2)
    sigSystemManager.addSignalDriver(TVM430toBAL)
    sigSystemManager.addSignalDriver(TVM430toBAPR)
    sigSystemManager.addSignalDriver(TVM430toTVM300)
    sigSystemManager.addSignalDriver(TVM430toTVM430)
    sigSystemManager.addSignalDriver(TVM430toETCS_LEVEL2)
    sigSystemManager.addSignalDriver(ETCS_LEVEL2toBAL)
    sigSystemManager.addSignalDriver(ETCS_LEVEL2toBAPR)
    sigSystemManager.addSignalDriver(ETCS_LEVEL2toTVM300)
    sigSystemManager.addSignalDriver(ETCS_LEVEL2toTVM430)
    sigSystemManager.addSignalDriver(ETCS_LEVEL2toETCS_LEVEL2)

    return SignalingSimulatorImpl(sigSystemManager)
}
