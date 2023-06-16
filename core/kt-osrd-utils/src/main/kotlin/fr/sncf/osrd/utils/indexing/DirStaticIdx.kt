@file:PrimitiveWrapperCollections(
    wrapper = DirStaticIdx::class,
    primitive = UInt::class,
    fromPrimitive = "DirStaticIdx(%s)",
    toPrimitive = "%s.index",
    collections = ["Array", "ArrayList", "ArraySortedSet"],
)

package fr.sncf.osrd.utils.indexing

import fr.sncf.osrd.fast_collections.PrimitiveWrapperCollections
import fr.sncf.osrd.utils.Direction

@JvmInline
value class DirStaticIdx<T>(val data: UInt) : NumIdx {
    public constructor(detector: StaticIdx<T>, direction: Direction) : this(
        (detector.index shl 1) or when (direction) {
            Direction.INCREASING -> 0u
            Direction.DECREASING -> 1u
        }
    )

    val value: StaticIdx<T> get() = StaticIdx(data shr 1)
    val direction: Direction
        get() = when ((data and 1u) != 0u) {
            false -> Direction.INCREASING
            true -> Direction.DECREASING
        }

    val opposite: DirStaticIdx<T> get() = DirStaticIdx(data xor 1u)
    override val index get() = data

    override fun toString(): String {
        return String.format("(id=%s, dir=%s)", value.index, direction)
    }
}

@JvmName("toDirection")
fun <T> toDirection(dirStaticIdx: DirStaticIdx<T>): Direction {
    return dirStaticIdx.direction
}

@JvmName("toValue")
fun <T> toValue(dirStaticIdx: DirStaticIdx<T>): StaticIdx<T> {
    return dirStaticIdx.value
}
