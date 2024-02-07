package fr.sncf.osrd.api

import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.bal.*
import fr.sncf.osrd.signaling.bapr.BAPR
import fr.sncf.osrd.signaling.bapr.BAPRtoBAL
import fr.sncf.osrd.signaling.bapr.BAPRtoBAPR
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.signaling.tvm300.*
import fr.sncf.osrd.signaling.tvm430.*

/**
 * Configure the signaling simulator for all the supported signaling systems Mainly useful because
 * we can't do it directly from java due to compiler issues
 */
fun makeSignalingSimulator(): SignalingSimulator {
    val sigSystemManager = SigSystemManagerImpl()
    sigSystemManager.addSignalingSystem(BAL)
    sigSystemManager.addSignalingSystem(BAPR)
    sigSystemManager.addSignalingSystem(TVM300)
    sigSystemManager.addSignalingSystem(TVM430)

    sigSystemManager.addSignalDriver(BALtoBAL)
    sigSystemManager.addSignalDriver(BALtoBAPR)
    sigSystemManager.addSignalDriver(BAPRtoBAPR)
    sigSystemManager.addSignalDriver(BAPRtoBAL)
    sigSystemManager.addSignalDriver(TVM300toTVM300)
    sigSystemManager.addSignalDriver(TVM300toBAL)
    sigSystemManager.addSignalDriver(TVM300toTVM430)
    sigSystemManager.addSignalDriver(BALtoTVM300)
    sigSystemManager.addSignalDriver(TVM430toTVM430)
    sigSystemManager.addSignalDriver(TVM430toBAL)
    sigSystemManager.addSignalDriver(BALtoTVM430)
    sigSystemManager.addSignalDriver(TVM430toTVM300)

    return SignalingSimulatorImpl(sigSystemManager)
}
