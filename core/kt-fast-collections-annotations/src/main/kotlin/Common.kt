package fr.sncf.osrd.fast_collections

private const val MAX_ARRAY_LENGTH = Int.MAX_VALUE.toLong() -  /* aligned array header + slack */32

/** Minimum grow count. */
private const val MIN_GROW_COUNT = 10L

/** Maximum grow count (unbounded). */
private const val MAX_GROW_COUNT = MAX_ARRAY_LENGTH

fun growCapacity(currentCapacity: Int, currentSize: Int, expectedAdditions: Int): Int {
    // compute the added capacity
    val addedCapacity = (currentCapacity.toLong() + currentCapacity.toLong() / 2).coerceIn(MIN_GROW_COUNT, MAX_GROW_COUNT)

    var newCapacity = addedCapacity + currentCapacity;
    if (newCapacity > MAX_ARRAY_LENGTH)
        newCapacity = MAX_ARRAY_LENGTH

    val neededCapacity = currentSize.toLong() + expectedAdditions.toLong()
    if (newCapacity < neededCapacity)
        newCapacity = neededCapacity

    if (newCapacity > MAX_ARRAY_LENGTH)
        throw RuntimeException("reached maximum array size")
    return newCapacity.toInt()
}
