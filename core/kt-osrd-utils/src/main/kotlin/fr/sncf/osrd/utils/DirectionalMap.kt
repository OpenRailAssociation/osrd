package fr.sncf.osrd.utils

import kotlinx.serialization.Serializable

/** Simple utility class to store a pair of values, each linked to a direction */
@Serializable
data class DirectionalMap<T>(private val forwards: T, private val backwards: T) {
    fun get(dir: Direction): T {
        return when (dir) {
            Direction.INCREASING -> forwards
            Direction.DECREASING -> backwards
        }
    }
}
