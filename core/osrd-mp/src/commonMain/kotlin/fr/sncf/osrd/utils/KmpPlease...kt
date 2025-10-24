package fr.sncf.osrd.utils

import kotlin.math.min

fun LongArray.binarySearch(element: Long): Int {
    var low = 0
    var high = size - 1

    while (low <= high) {
        val mid = (low + high) ushr 1
        val midVal = get(mid)
        val cmp = midVal compareTo element

        if (cmp < 0) {
            low = mid + 1
        } else if (cmp > 0) {
            high = mid - 1
        } else {
            return mid
        }
    }

    return -low - 1
}

fun Double.toString(decimals: Int): String {
    val s = toString()

    if (decimals <= 0) {
        return s
    }

    val dot = s.indexOf('.')
    return if (dot < 0) {
        "$s.".padEnd(s.count() + 1 + decimals, '0')
    } else {
        val endIndex = min(s.count(), dot + 1 + decimals)
        s.substring(startIndex = 0, endIndex).padEnd(dot + 1 + decimals, '0')
    }
}
