package fr.sncf.osrd.utils.indexing

interface ArenaMap<IndexT, ValueT> : BaseArena<IndexT> {
    operator fun get(id: DynIdx<IndexT>): ValueT
    fun update(updater: (MutableArenaMap<IndexT, ValueT>) -> Unit): ArenaMap<IndexT, ValueT>
    fun update(id: DynIdx<IndexT>, updater: (ValueT) -> ValueT): ArenaMap<IndexT, ValueT>
}

interface MutableArenaMap<IndexT, ValueT> : ArenaMap<IndexT, ValueT> {
    operator fun set(id: DynIdx<IndexT>, value: ValueT)
    fun allocate(value: ValueT): DynIdx<IndexT>
    fun release(id: DynIdx<IndexT>)
    fun clone(): MutableArenaMap<IndexT, ValueT>
}


fun <IndexT, ValueT> mutableArenaMap(): MutableArenaMap<IndexT, ValueT> {
    return MutableArenaMapImpl()
}


class MutableArenaMapImpl<IndexT, ValueT> : MutableBaseArenaImpl<IndexT>, MutableArenaMap<IndexT, ValueT> {
    var values: MutableList<ValueT?>

    private constructor(
        slotGenerations: UIntArray,
        useMap: BooleanArray,
        slotForwardLinks: IntArray,
        slotBackwardLinks: IntArray,
        freeCount: Int,
        freeHead: Int,
        usedHead: Int,
        usedTail: Int,
        values: MutableList<ValueT?>,
    ) : super(
        slotGenerations,
        useMap,
        slotForwardLinks,
        slotBackwardLinks,
        freeCount,
        freeHead,
        usedHead,
        usedTail,
    ) {
        this.values = values
    }

    constructor(initSize: Int) : super(initSize) {
        values = mutableListOf()
        for (i in 0 until initSize)
            values.add(null)
    }

    constructor() : this(10)

    override operator fun get(id: DynIdx<IndexT>): ValueT {
        return values[id.index]!!
    }

    override operator fun set(id: DynIdx<IndexT>, value: ValueT) {
        values[id.index.toInt()] = value
    }

    override fun allocate(value: ValueT): DynIdx<IndexT> {
        val id = allocateIndex()
        values[id.index.toInt()] = value
        return id
    }

    override fun onGrow(oldCapacity: Int, newCapacity: Int) {
        val newItems = newCapacity - oldCapacity
        for (i in 0 until newItems)
            values.add(null)
    }

    override fun onRelease(id: DynIdx<IndexT>) {
        values[id.index.toInt()] = null
    }

    private fun <T> cloneWithValues(values: MutableList<T?>): MutableArenaMap<IndexT, T> {
        return MutableArenaMapImpl(
            slotGenerations.copyOf(),
            useMap.copyOf(),
            slotForwardLinks.copyOf(),
            slotBackwardLinks.copyOf(),
            freeCount,
            freeHead,
            usedHead,
            usedTail,
            values
        )
    }

    override fun clone(): MutableArenaMap<IndexT, ValueT> {
        return cloneWithValues(values.toMutableList())
    }

    override fun update(updater: (MutableArenaMap<IndexT, ValueT>) -> Unit): ArenaMap<IndexT, ValueT> {
        val newArena = clone()
        updater(newArena)
        return newArena
    }

    override fun update(id: DynIdx<IndexT>, updater: (ValueT) -> ValueT): ArenaMap<IndexT, ValueT> {
        val newArena = clone()
        newArena[id] = updater(newArena[id])
        return newArena
    }

    fun <NewValueT> map(f: (ValueT) -> NewValueT): MutableArenaMap<IndexT, NewValueT> {
        val newValues = mutableListOf<NewValueT?>()
        for (i in 0 until capacity) {
            if (useMap[i]) {
                newValues.add(f(values[i]!!))
            } else {
                newValues.add(null)
            }
        }
        return cloneWithValues(newValues)
    }

    override fun toString(): String {
        val builder = StringBuilder()
        builder.append("{")
        var isFirst = true
        val it = iterator()
        while (it.hasNext()) {
            val item = it.next()
            if (!isFirst) {
                builder.append(", ")
            }
            builder.append("${item}: ${this[item]}")
            isFirst = false
        }
        builder.append("}")
        return builder.toString()
    }

    override fun hashCode(): Int {
        return slotGenerations.hashCode()
    }
    private sealed interface Workaround

    override fun equals(other: Any?): Boolean {
        if (other !is ArenaMap<*, *>)
            return false
        // the kotlin compiler brain farts without this hint
        @Suppress("UNCHECKED_CAST")
        val castOther = other as ArenaMap<Workaround, *>

        val thisIt = iterator()
        val otherIt = other.iterator()
        while (thisIt.hasNext()) {
            if (!otherIt.hasNext())
                return false
            val thisVal = thisIt.next()
            val otherVal = otherIt.next()
            if (thisVal != otherVal)
                return false
            if (this[thisVal] != other[otherVal])
                return false
        }
        return !otherIt.hasNext()
    }
}
