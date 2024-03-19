package fr.sncf.osrd.api

fun getSignalingSystemsTransitions(infra: FullInfra): Map<Pair<String, String>, Int> {
    val res = mutableMapOf<Pair<String, String>, Int>()
    val blockInfra = infra.blockInfra
    val loadedSignalInfra = infra.loadedSignalInfra
    val signalingSimulator = infra.signalingSimulator
    for (block in blockInfra.blocks) {
        val signals = blockInfra.getBlockSignals(block)
        val signalingSystems = signals.map { loadedSignalInfra.getSignalingSystem(it) }
            .map { signalingSimulator.sigModuleManager.getSignalingSystemName(it) }
        for ((first, second) in signalingSystems.windowed(2)) {
            val key = Pair(first, second)
            res[key] = res.getOrDefault(key, 0) + 1
        }
    }
    return res
}

fun getSignalingSystemsTransitions(infra: FullInfra): Map<Pair<String, String>, Int> {
    val res = mutableMapOf<Pair<String, String>, Int>()
    val blockInfra = infra.blockInfra
    val loadedSignalInfra = infra.loadedSignalInfra
    val signalingSimulator = infra.signalingSimulator
    for (block in blockInfra.blocks) {
        val signals = blockInfra.getBlockSignals(block)
        val signalingSystems = signals.map { loadedSignalInfra.getSignalingSystem(it) }
            .map { signalingSimulator.sigModuleManager.getSignalingSystemName(it) }
        for ((first, second) in signalingSystems.windowed(2)) {
            val key = Pair(first, second)
            res[key] = res.getOrDefault(key, 0) + 1
        }
    }
    return res
}
