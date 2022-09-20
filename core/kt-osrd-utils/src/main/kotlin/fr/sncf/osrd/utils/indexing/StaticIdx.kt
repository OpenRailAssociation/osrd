@file:PrimitiveWrapperCollections(
    wrapper = StaticIdx::class,
    primitive = UInt::class,
    fromPrimitive = "StaticIdx(%s)",
    toPrimitive = "%s.index",
    collections = ["Array", "ArrayList", "ArraySortedSet"],
)

package fr.sncf.osrd.utils.indexing

import fr.sncf.osrd.fast_collections.PrimitiveWrapperCollections

/** The type-safe index. The index type can be an abstract token,
 * such as an empty sealed interface. */
@JvmInline
value class StaticIdx<T>(override val index: UInt) : NumIdx

@JvmInline
value class StaticPool<IndexT, ValueT>(private val items: MutableList<ValueT>) : StaticIdxIterable<IndexT> {
    constructor() : this(mutableListOf())

    val size: Int get() = items.size

    operator fun get(i: StaticIdx<IndexT>): ValueT {
        return items[i.index]
    }

    fun add(value: ValueT): StaticIdx<IndexT> {
        val index = StaticIdx<IndexT>(items.size.toUInt())
        items.add(value)
        return index
    }

    fun view(): StaticPoolView<IndexT, ValueT> {
        return StaticPoolView(items)
    }

    fun space(): StaticIdxSpace<IndexT> {
        return StaticIdxSpace(size.toUInt())
    }

    override fun iterator(): StaticIdxIterator<IndexT> {
        return StaticIdxSpaceIterator(items.size.toUInt())
    }
}


@JvmInline
value class StaticPoolView<IndexT, ValueT> internal constructor(private val items: List<ValueT>) {
    operator fun get(i: StaticIdx<IndexT>): ValueT {
        return items[i.index]
    }
}

interface StaticIdxIterator<IndexT> : Iterator<StaticIdx<IndexT>> {
    override operator fun hasNext(): Boolean
    override operator fun next(): StaticIdx<IndexT>
}

interface StaticIdxIterable<IndexT> : Iterable<StaticIdx<IndexT>> {
    override operator fun iterator(): StaticIdxIterator<IndexT>
}

class StaticIdxSpaceIterator<IndexT>(val size: UInt) : StaticIdxIterator<IndexT>{
    var i = 0u
    override fun hasNext(): Boolean {
        return i < size
    }

    override fun next(): StaticIdx<IndexT> = if (i < size) {
        StaticIdx(i++)
    } else {
        throw NoSuchElementException(i.toString())
    }
}

@JvmInline
value class StaticIdxSpace<IndexT>(val size: UInt) : StaticIdxIterable<IndexT> {
    override fun iterator(): StaticIdxIterator<IndexT> {
        return StaticIdxSpaceIterator(size)
    }

    operator fun get(i: Int): StaticIdx<IndexT> {
        assert(i.toUInt() < size)
        return StaticIdx(i.toUInt())
    }
}

class VirtualStaticPool<IndexT>(private var _size: UInt) : StaticIdxIterable<IndexT> {
    constructor() : this(0u)

    val size: UInt get() = _size

    fun next(): StaticIdx<IndexT> {
        return StaticIdx(_size++)
    }

    override fun iterator(): StaticIdxIterator<IndexT> {
        return StaticIdxSpaceIterator(_size)
    }

    fun space(): StaticIdxSpace<IndexT> {
        return StaticIdxSpace(size)
    }
}
