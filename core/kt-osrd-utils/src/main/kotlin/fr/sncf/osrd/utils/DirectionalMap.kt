package fr.sncf.osrd.utils

/** Simple utility class to store a pair of values, each linked to a direction */
class DirectionalMap<T>(
    private val forwards: T,
    private val backwards: T,
) {
    fun get(dir: Direction): T {
        return when (dir) {
            Direction.INCREASING -> forwards
            Direction.DECREASING -> backwards
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is DirectionalMap<*>) return false
        if (forwards != other.forwards) return false
        if (backwards != other.backwards) return false
        return true
    }
}
