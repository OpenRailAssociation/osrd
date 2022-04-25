package fr.sncf.osrd.sim

import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3
import fr.sncf.osrd.railjson.parser.RJSParser
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch




fun main(args: Array<String>) {
    val rjsInfra = RJSParser.parseRailJSONFromFile(args[0])
    val infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, setOf(BAL3()))

    runSimulation(0) {
        val exampleSignal = DynSimpleSignal(arrayOf(), mapOf())
        val infra = DynInfraImpl()

        launch { exampleSignal.evaluate(infra) }
        print("hello world")
    }
}