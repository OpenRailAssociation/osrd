package fr.sncf.osrd.utils.indexing

interface Arena<IndexT> : BaseArena<IndexT>

interface MutableArena<IndexT> : MutableBaseArena<IndexT> {
    fun allocate(): DynIdx<IndexT>
    fun toArena(): Arena<IndexT>
}

class ArenaImpl<IndexT> internal constructor(
    slotGenerations: UIntArray,
    useMap: BooleanArray,
    slotForwardLinks: IntArray,
    usedHead: Int
) : BaseArenaImpl<IndexT>(slotGenerations, useMap, slotForwardLinks, usedHead), Arena<IndexT> {
}

class MutableArenaImpl<IndexT>(initSize: Int) : MutableBaseArenaImpl<IndexT>(initSize), MutableArena<IndexT> {
    override fun allocate(): DynIdx<IndexT> {
        return allocateIndex()
    }

    override fun toArena(): Arena<IndexT> {
        return ArenaImpl(
            slotGenerations.copyOf(),
            useMap.copyOf(),
            slotForwardLinks.copyOf(),
            usedHead,
        )
    }
}

fun <IndexT> MutableArena(initSize: Int): MutableArena<IndexT> = MutableArenaImpl(initSize)
