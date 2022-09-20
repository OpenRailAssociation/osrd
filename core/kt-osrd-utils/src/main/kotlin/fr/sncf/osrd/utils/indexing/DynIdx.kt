@file:PrimitiveWrapperCollections(
    wrapper = DynIdx::class,
    primitive = ULong::class,
    fromPrimitive = "DynIdx.fromData(%s)",
    toPrimitive = "%s.data",
    collections = ["Array", "ArrayList", "ArraySortedSet"],
)

package fr.sncf.osrd.utils.indexing

import fr.sncf.osrd.fast_collections.PrimitiveWrapperCollections


interface DynIdxIterator<IndexT> : Iterator<DynIdx<IndexT>> {
    override operator fun hasNext(): Boolean
    override operator fun next(): DynIdx<IndexT>
}

interface DynIdxIterable<IndexT> : Iterable<DynIdx<IndexT>> {
    override operator fun iterator(): DynIdxIterator<IndexT>
}


/**
 * A numerical identifier for a given type.
 * It holds both an index and a generation identifier.
 */
@JvmInline
value class DynIdx<T> private constructor(val data: ULong) : NumIdx {
    constructor(index: UInt, generation: UInt) : this(index.toULong() or (generation.toULong() shl UInt.SIZE_BITS))

    constructor(index: UInt) : this(index.toULong())

    companion object {
        @JvmStatic fun <T> fromData(data: ULong): DynIdx<T> {
            return DynIdx(data)
        }

        @JvmStatic fun <T> fromData(data: Long): DynIdx<T> {
            return DynIdx(data.toULong())
        }
    }

    override val index: UInt get() = data.toUInt()
    val generation: UInt get() = (data shr UInt.SIZE_BITS).toUInt()

    override fun toString(): String {
        return "DynIdx(${index}, gen=${generation})"
    }
}
