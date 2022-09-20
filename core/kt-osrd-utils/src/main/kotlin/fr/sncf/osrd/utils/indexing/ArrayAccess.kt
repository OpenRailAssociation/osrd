package fr.sncf.osrd.utils.indexing

operator fun <T> Array<T>.get(index: UInt) = this[index.toInt()]
operator fun <T> List<T>.get(index: UInt) = this[index.toInt()]
operator fun IntArray.get(index: UInt) = this[index.toInt()]
operator fun UIntArray.get(index: UInt) = this[index.toInt()]
operator fun LongArray.get(index: UInt) = this[index.toInt()]
operator fun DoubleArray.get(index: UInt) = this[index.toInt()]
operator fun FloatArray.get(index: UInt) = this[index.toInt()]
operator fun <T> ArrayList<T>.set(index: UInt, value: T) {
    this[index.toInt()] = value
}
