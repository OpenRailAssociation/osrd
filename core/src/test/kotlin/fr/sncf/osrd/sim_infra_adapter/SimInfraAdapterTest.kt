package fr.sncf.osrd.sim_infra_adapter

import fr.sncf.osrd.Helpers
import kotlin.test.Test

class RawInfraAdapterTest {
    @Test
    fun smokeAdaptTinyInfra() {
        val rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json")
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        adaptSimInfra(oldInfra)
    }
}
