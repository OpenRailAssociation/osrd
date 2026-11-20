package fr.sncf.osrd.trainsim

/**
 * A simple cache.
 *
 * If a key is not present, it is computed and returned. It differs from a Map in the sense that it
 * is meant to store a single value. This class is meant to cache curves and train states to avoid
 * recomputing them when changing the context (i.e. curves when vMaxFactor changes when computing
 * margins).
 */
class SingleEntryCache<K, T : Any> {
    private var keyValue: Pair<K, T>? = null

    fun get(key: K, compute: () -> T): T {
        val keyValue = this.keyValue
        if (keyValue != null && keyValue.first == key) return keyValue.second
        return compute().also {
            this.keyValue = key to it
        }
    }
}
