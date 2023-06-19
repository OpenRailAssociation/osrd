@file:PrimitiveWrapperCollections(
    wrapper = StaticIdx::class,
    primitive = UInt::class,
    fromPrimitive = "StaticIdx(%s)",
    toPrimitive = "%s.index",
    collections = ["Array", "ArrayList", "ArraySortedSet"],
)

package fr.sncf.osrd.utils.indexing

import fr.sncf.osrd.fast_collections.PrimitiveWrapperCollections
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Endpoint

/** The type-safe index. The index type can be an abstract token,
 * such as an empty sealed interface. */
@JvmInline
value class StaticIdx<T>(override val index: UInt) : NumIdx

@JvmInline
value class OptStaticIdx<T>(private val data: UInt) {

    constructor() : this(UInt.MAX_VALUE)

    val isNone: Boolean get () = data == UInt.MAX_VALUE

    fun asIndex(): StaticIdx<T> {
        assert(!isNone)
        return StaticIdx(data)
    }

    fun <U> map(onSome: (StaticIdx<T>) -> U, onNone: () -> U): U {
        return if (isNone) {
            onNone()
        } else {
            onSome(asIndex())
        }
    }
}

@JvmInline
value class EndpointStaticIdx<T>(val data: UInt) : NumIdx {
    public constructor(value: StaticIdx<T>, endpoint: Endpoint) : this(
        (value.index shl 1) or when (endpoint) {
            Endpoint.START -> 0u
            Endpoint.END -> 1u
        })

    val value: StaticIdx<T> get() = StaticIdx(data shr 1)
    val endpoint: Endpoint
        get() = when ((data and 1u) != 0u) {
            false -> Endpoint.START
            true -> Endpoint.END
        }

    val opposite: DirStaticIdx<T> get() = DirStaticIdx(data xor 1u)
    override val index get() = data
}


@JvmInline
value class OptDirStaticIdx<T>(private val data: UInt) {
    constructor() : this(UInt.MAX_VALUE)
    constructor(value: StaticIdx<T>, dir: Direction) : this(DirStaticIdx(value, dir).data)
    val isNone: Boolean get () = data == UInt.MAX_VALUE

    private fun asIndex(): DirStaticIdx<T> {
        assert(!isNone)
        return DirStaticIdx(data)
    }

    fun <U> map(onSome: (DirStaticIdx<T>) -> U, onNone: () -> U): U {
        return if (isNone) {
            onNone()
        } else {
            onSome(asIndex())
        }
    }
}


@JvmInline
value class OptEndpointStaticIdx<T>(private val data: UInt) {

    constructor() : this(UInt.MAX_VALUE)

    val isNone: Boolean get () = data == UInt.MAX_VALUE

    private fun asIndex(): EndpointStaticIdx<T> {
        assert(!isNone)
        return EndpointStaticIdx(data)
    }

    fun <U> map(onSome: (EndpointStaticIdx<T>) -> U, onNone: () -> U): U {
        return if (isNone) {
            onNone()
        } else {
            onSome(asIndex())
        }
    }
}

@JvmInline
value class StaticPool<IndexT, ValueT>(private val items: MutableList<ValueT>) : StaticIdxIterable<IndexT> {
    constructor() : this(mutableListOf())

    val size: UInt get() = items.size.toUInt()

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
        return StaticIdxSpace(size)
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