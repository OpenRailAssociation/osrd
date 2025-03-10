package fr.sncf.osrd.utils

import com.google.common.hash.BloomFilter
import com.google.common.hash.Funnel
import com.google.common.hash.Funnels
import fr.sncf.osrd.utils.indexing.StaticIdx

/** Create a bloom filter with the given expected insertions and false positive rate. */
inline fun <reified T> emptyBloomFilter(
    expectedInsertions: Int,
    falsePositiveRate: Double,
    funnel: Funnel<T> = defaultFunnelProvider(),
): BloomFilter<T> {
    return BloomFilter.create(funnel, expectedInsertions, falsePositiveRate)
}

/**
 * Create a funnel for the right underlying type. Avoids propagating that added complexity to the
 * rest of the code.
 */
@Suppress("UNCHECKED_CAST") // We know the return type match the `when` type
inline fun <reified T> defaultFunnelProvider(): Funnel<T> {
    return when (T::class) {
        String::class -> Funnels.stringFunnel(Charsets.UTF_8) as Funnel<T>
        Int::class -> Funnels.integerFunnel() as Funnel<T>
        Long::class -> Funnels.longFunnel() as Funnel<T>
        StaticIdx::class -> Funnel { obj, into -> into.putInt((obj as StaticIdx<*>).index.toInt()) }
        else -> throw IllegalArgumentException("No default funnel for type ${T::class}.")
    }
}
