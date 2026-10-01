package fr.sncf.osrd.trainsim

/**
 * A simple cache.
 *
 * If a key is not present, it is computed and returned.
 * It differs from a Map in the sens that it is meant to store a single value. This class is meant to cache
 * curves and train states to avoid recomputing them when changing the context (i.e. curves when vMaxFactor
 * changes when computing margins).
 */
class Cache<K, T: Any> {
    private var key: K? = null
    private var value: T? = null

    fun get(key: K, compute: () -> T): T {
        // SAFETY: value is never null if key is not null
        if (this.key != null && this.key == key) return this.value!!
        return compute().also {
            this.key = key
            this.value = it
        }
    }
}
