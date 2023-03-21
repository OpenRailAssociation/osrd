package fr.sncf.osrd.api

import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.bal.*
import fr.sncf.osrd.signaling.bapr.BAPR
import fr.sncf.osrd.signaling.bapr.BAPRtoBAL
import fr.sncf.osrd.signaling.bapr.BAPRtoBAPR
import fr.sncf.osrd.signaling.impl.SigSystemManagerImpl
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl

/**
 * Configure the signaling simulator for all the supported signaling systems
 * Mainly useful because we can't do it directly from java due to compiler issues
 * */
fun makeSignalingSimulator() : SignalingSimulator {
    val sigSystemManager = SigSystemManagerImpl()
    sigSystemManager.addSignalingSystem(BAL)
    sigSystemManager.addSignalingSystem(BAPR)
    sigSystemManager.addSignalingSystem(TVM)

    sigSystemManager.addSignalDriver(BALtoBAL)
    sigSystemManager.addSignalDriver(BALtoBAPR)
    sigSystemManager.addSignalDriver(BAPRtoBAPR)
    sigSystemManager.addSignalDriver(BAPRtoBAL)
    sigSystemManager.addSignalDriver(TVMtoTVM)
    sigSystemManager.addSignalDriver(TVMtoBAL)
    sigSystemManager.addSignalDriver(BALtoTVM)

    return SignalingSimulatorImpl(sigSystemManager)
}