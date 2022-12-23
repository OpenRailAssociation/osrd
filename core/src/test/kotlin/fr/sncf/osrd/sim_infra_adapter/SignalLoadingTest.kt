package fr.sncf.osrd.sim_infra_adapter

import fr.sncf.osrd.Helpers
import fr.sncf.osrd.signaling.impl.MockSigSystemManager
import fr.sncf.osrd.signaling.impl.SignalingSimulatorImpl
import fr.sncf.osrd.sim_infra.api.SigSettingsSchema
import kotlin.test.Test

class SignalLoadingTest {
    private val balSigSystemManager = MockSigSystemManager("BAL", SigSettingsSchema { flag("Nf") })

    @Test
    fun smokeLoadSignalTinyInfra() {
        val rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json")
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)

        val simulator = SignalingSimulatorImpl(balSigSystemManager)
        val loadedSignalInfra = simulator.loadSignals(infra)
        simulator.buildBlocks(infra, loadedSignalInfra)
    }

    @Test
    fun smokeLoadSignalSmallInfra() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)

        val simulator = SignalingSimulatorImpl(balSigSystemManager)
        val loadedSignalInfra = simulator.loadSignals(infra)
        simulator.buildBlocks(infra, loadedSignalInfra)
    }
}
