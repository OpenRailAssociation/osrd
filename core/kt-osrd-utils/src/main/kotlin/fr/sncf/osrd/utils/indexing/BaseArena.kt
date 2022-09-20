package fr.sncf.osrd.utils.indexing

interface BaseArena<IndexT> : DynIdxIterable<IndexT> {
    fun isValid(id: DynIdx<IndexT>): Boolean
    fun isEmpty(): Boolean
    val size: Int
}

interface MutableBaseArena<IndexT> : BaseArena<IndexT> {
    fun release(id: DynIdx<IndexT>)
}

/**
 * An arena is a data structure which allows efficiently allocating slots.
 * Each allocation returns an identifier, which is required to release it.
 * You can tell from the identifier if the corresponding slot allocation is still valid.
 */
open class BaseArenaImpl<IndexT> protected constructor(
    /** A lookup table which contains the number of time each slot was allocated */
    protected val slotGenerations: UIntArray,
    /** A lookup table of whether the slot is used */
    protected val useMap: BooleanArray,
    /**
     * A lookup table of next item indexes. Can be used for both the free and used list depending on slot state.
     * The tail of the list holds the -1 special value.
     */
    protected val slotForwardLinks: IntArray,
    /** The head of the used slot list (used for forward iteration) */
    protected val usedHead: Int,
) : BaseArena<IndexT> {
    constructor(initSize: Int) : this(
        slotGenerations = UIntArray(initSize),
        useMap = BooleanArray(initSize),
        slotForwardLinks = IntArray(initSize),
        usedHead = -1,
    ) {
        slotForwardLinks[initSize - 1] = -1
        for (i in 0 until initSize - 1)
            slotForwardLinks[i] = i + 1
    }

    /** Returns the number of used slots */
    override val size get() = useMap.sumOf { val res: Int = if (it) 1 else 0; res }

    /** Returns whether there are no used slots */
    override fun isEmpty(): Boolean {
        return size == 0
    }

    /** Returns the total number of slots the arena hold without having to grow */
    val capacity get() = slotGenerations.size

    /** Check whether some identifier is still valid */
    override fun isValid(id: DynIdx<IndexT>): Boolean {
        val slotIndex = id.index.toInt()
        val slotGeneration = id.generation
        // the slot index must belong to the arena
        if (slotIndex < 0 || slotIndex >= capacity)
            return false
        // the generation must not be obsolete
        if (slotGenerations[slotIndex] != slotGeneration)
            return false
        // the slot must actually be in use
        return useMap[slotIndex]
    }

    override fun iterator(): DynIdxIterator<IndexT> {
        return object : DynIdxIterator<IndexT> {
            var cur = usedHead

            override fun hasNext(): Boolean {
                return cur != -1
            }

            override fun next(): DynIdx<IndexT> {
                val id = DynIdx<IndexT>(cur.toUInt(), slotGenerations[cur])
                cur = slotForwardLinks[cur]
                return id
            }
        }
    }
}


/**
 * An arena is a data structure which allows efficiently allocating slots.
 * Each allocation returns an identifier, which is required to release it.
 * You can tell from the identifier if the corresponding slot allocation is still valid.
 */
open class MutableBaseArenaImpl<IndexT> protected constructor(
    /** A lookup table which contains the number of time each slot was allocated */
    protected var slotGenerations: UIntArray,
    /** A lookup table of whether the slot is used */
    protected var useMap: BooleanArray,
    /**
     * A lookup table of next item indexes. Can be used for both the free and used list depending on slot state.
     * The tail of the list holds the -1 special value.
     */
    protected var slotForwardLinks: IntArray,
    /**
     * A lookup table of previous item indexes. It is only used for occupied slots, set to -1 for free slots.
     * The tail of the list holds the -1 special value.
     */
    protected var slotBackwardLinks: IntArray,
    /** The number of free slots (the length of the free list) */
    protected var freeCount: Int,
    /** The head of the free slot list */
    protected var freeHead: Int,
    /** The head of the used slot list (used for forward iteration) */
    protected var usedHead: Int,
    /** The tail of the used slot list (used for backward iteration) */
    protected var usedTail: Int,
) : MutableBaseArena<IndexT> {
    constructor(initSize: Int) : this(
        slotGenerations = UIntArray(initSize),
        useMap = BooleanArray(initSize),
        slotForwardLinks = IntArray(initSize),
        slotBackwardLinks = IntArray(initSize),
        freeCount = initSize,
        freeHead = 0,
        usedHead = -1,
        usedTail = -1,
    ) {
        slotForwardLinks[initSize - 1] = -1
        for (i in 0 until initSize - 1)
            slotForwardLinks[i] = i + 1
        slotBackwardLinks.fill(-1)
    }

    /** Returns the number of used slots */
    override val size get() = capacity - freeCount

    /** Returns whether there are no used slots */
    override fun isEmpty(): Boolean {
        return capacity == freeCount
    }

    /** Returns the total number of slots the arena hold without having to grow */
    val capacity get() = slotGenerations.size

    private fun growToCapacity(newCapacity: Int) {
        assert(newCapacity > capacity) { "cannot grow to a smaller or identical size" }
        val oldSize = slotGenerations.size

        // extend the slot generations array. newly created slots generations are initialized to zero
        val newSlotGenerations = slotGenerations.copyOf(newCapacity)
        val newUseMap = useMap.copyOf(newCapacity)

        // the backward links of the new items are initialized to -1, as the backward link is unused by free slots
        val newBackwardLinks = slotBackwardLinks.copyOf(newCapacity)
        newBackwardLinks.fill(-1, oldSize)

        // make a linked list of the newly created free slots
        val newForwardLinks = slotForwardLinks.copyOf(newCapacity)
        for (i in oldSize until newCapacity - 1)
            newForwardLinks[i] = i + 1
        newForwardLinks[newCapacity - 1] = freeHead

        slotGenerations = newSlotGenerations
        useMap = newUseMap
        slotBackwardLinks = newBackwardLinks
        slotForwardLinks = newForwardLinks
        freeCount += newCapacity - oldSize
        freeHead = oldSize

        onGrow(oldSize, newCapacity)
    }

    /** A hook called on slot table growth */
    protected open fun onGrow(oldCapacity: Int, newCapacity: Int) {
    }

    private fun requireFreeSlots(requiredCount: Int) {
        val missingSlotCount = requiredCount - freeCount
        if (missingSlotCount <= 0)
            return

        growToCapacity((capacity + missingSlotCount) * 2)
        assert(freeCount >= requiredCount)
    }

    /** Allocate a slot */
    protected fun allocateIndex(): DynIdx<IndexT> {
        // ensure there's at least 1 free slot
        requireFreeSlots(1)

        // take a slot from the free list
        val slotIndex = freeHead
        freeHead = slotForwardLinks[slotIndex]
        slotForwardLinks[slotIndex] = -1
        freeCount -= 1

        // add the slot to the head of the used list
        slotForwardLinks[slotIndex] = usedHead
        slotBackwardLinks[slotIndex] = -1

        if (usedHead != -1)
            slotBackwardLinks[usedHead] = slotIndex
        usedHead = slotIndex

        if (usedTail == -1)
            usedTail = slotIndex

        // mark the slot as used
        useMap[slotIndex] = true

        val id = DynIdx<IndexT>(slotIndex.toUInt(), slotGenerations[slotIndex])
        onAllocate(id)
        return id
    }

    /** A hook called on slot allocation */
    protected open fun onAllocate(id: DynIdx<IndexT>) {
    }

    /** Check whether some identifier is still valid */
    override fun isValid(id: DynIdx<IndexT>): Boolean {
        val slotIndex = id.index.toInt()
        val slotGeneration = id.generation
        // the slot index must belong to the arena
        if (slotIndex < 0 || slotIndex >= capacity)
            return false
        // the generation must not be obsolete
        if (slotGenerations[slotIndex] != slotGeneration)
            return false
        // the slot must actually be in use
        return useMap[slotIndex]
    }

    /** Release a slot using its identifier */
    override fun release(id: DynIdx<IndexT>) {
        if (!isValid(id))
            throw RuntimeException("invalid DynIdx")

        val slotIndex = id.index.toInt()
        val slotGeneration = id.generation

        // remove the slot from the used list
        // unlink the forward edge
        if (slotBackwardLinks[slotIndex] == -1) {
            assert(slotIndex == usedHead)
            usedHead = slotForwardLinks[slotIndex]
        }
        else
            slotForwardLinks[slotBackwardLinks[slotIndex]] = slotForwardLinks[slotIndex]

        // unlink the backward edge
        if (slotForwardLinks[slotIndex] == -1) {
            assert(slotIndex == usedTail)
            usedTail = slotBackwardLinks[slotIndex]
        }
        else
            slotBackwardLinks[slotForwardLinks[slotIndex]] = slotBackwardLinks[slotIndex]

        slotForwardLinks[slotIndex] = -1
        slotBackwardLinks[slotIndex] = -1

        // add the slot to the free list
        slotForwardLinks[slotIndex] = freeHead
        freeHead = slotIndex

        // increase the number of free slots
        freeCount += 1

        // bump the generation
        slotGenerations[slotIndex] = slotGeneration + 1u

        // update the use map
        useMap[slotIndex] = false
        onRelease(id)
    }

    /** A hook called on slot release */
    protected open fun onRelease(id: DynIdx<IndexT>) {
    }

    override fun iterator(): DynIdxIterator<IndexT> {
        return object : DynIdxIterator<IndexT> {
            var cur = usedHead

            override fun hasNext(): Boolean {
                return cur != -1
            }

            override fun next(): DynIdx<IndexT> {
                val id = DynIdx<IndexT>(cur.toUInt(), slotGenerations[cur])
                cur = slotForwardLinks[cur]
                return id
            }
        }
    }
}
