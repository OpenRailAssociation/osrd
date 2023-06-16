package fr.sncf.osrd.fast_collections.generator.collections

import fr.sncf.osrd.fast_collections.generator.*
import com.google.devtools.ksp.processing.Dependencies
import com.google.devtools.ksp.symbol.KSFile
import java.util.*


private fun CollectionItemType.generateArraySortedSet(context: GeneratorContext, currentFile: KSFile) {
    val simpleName = type.simpleName
    val decSimpleName = simpleName.replaceFirstChar { it.lowercase(Locale.getDefault()) }
    val paramsDecl = type.paramsDecl
    val paramsUse = type.paramsUse
    val paramsStar = type.paramsStar
    val fileName = "${simpleName}SortedSet"
    val bufferType = "Mutable${simpleName}Array${paramsUse}"
    val storageType = storageType!!
    val primitiveZero = storageType.primitiveZero()
    val toPrimitive = storageType.toPrimitive
    val wrapperZero = storageType.fromPrimitive(primitiveZero)
    val file = context.codeGenerator.createNewFile(Dependencies(true, currentFile), generatedPackage, fileName)
    file.appendText("""
            @file:OptIn(ExperimentalUnsignedTypes::class)

            /** GENERATED CODE */

            package $generatedPackage

            import fr.sncf.osrd.fast_collections.growCapacity
            import ${type.qualifiedName}

            /** GENERATED CODE */
            @Suppress("INAPPLICABLE_JVM_NAME")
            class Mutable${simpleName}ArraySet${paramsDecl} private constructor(
                private var usedElements: Int,
                private var buffer: ${bufferType},
            ) : Mutable${simpleName}SortedSet${paramsUse}, Comparable<${simpleName}SortedSet${paramsUse}> {
                public constructor(data: ${bufferType}) : this(data.size, data)
                public constructor(capacity: Int) : this(0, ${bufferType}(capacity) { $wrapperZero })
                public constructor() : this(${DEFAULT_CAPACITY})

                override val size get() = usedElements

                override fun iterator(): Iterator<$type> {
                    return object : Iterator<$type> {
                        var i = 0
                        override fun hasNext(): Boolean {
                            return i < size
                        }

                        override fun next(): $type = if (i < size) {
                            getAtIndex(i++)
                        } else {
                            throw NoSuchElementException(i.toString())
                        }
                    }
                }

                private val capacity: Int get() = buffer.size

                private fun ensureBufferSpace(expectedAdditions: Int) {
                    val requiredCapacity = usedElements + expectedAdditions
                    if (requiredCapacity > capacity) {
                        val newCapacity = growCapacity(capacity, usedElements, expectedAdditions)
                        val newBuffer = $bufferType(newCapacity) { $wrapperZero }
                        for (i in 0 until capacity) {
                            newBuffer[i] = buffer[i]
                        }
                        buffer = newBuffer
                    }
                }

                fun ensureCapacity(expectedElements: Int) {
                    if (expectedElements > capacity) {
                        ensureBufferSpace(expectedElements - usedElements)
                    }
                }

                private fun removeAt(index: Int): $type {
                    assert(index < usedElements)
                    val oldValue = buffer[index]
                    for (i in index until usedElements)
                        buffer[i] = buffer[i + 1]
                    usedElements--
                    return oldValue
                }
                
                override fun remove(value: $type): Boolean {
                    val searchResult = binarySearch(value, 0, usedElements)
                    // no need to remove anything if the item was not found
                    if (searchResult < 0)
                        return false
            
                    for (i in searchResult until usedElements - 1)
                        buffer[i] = buffer[i + 1]
                    usedElements--
                    return true
                }

                override fun contains(value: $type): Boolean {
                    return binarySearch(value) >= 0
                }

                private fun binarySearch(value: $type, fromIndex: Int, toIndex: Int): Int {
                    var low = fromIndex
                    var high = toIndex - 1

                    while (low <= high) {
                        val mid = (low + high) ushr 1
                        val midVal = buffer[mid]
                        val cmp = ${toPrimitive("midVal")}.compareTo(${toPrimitive("value")})

                        if (cmp < 0)
                            low = mid + 1
                        else if (cmp > 0)
                            high = mid - 1
                        else
                            return mid
                    }
                    return -(low + 1)
                }

                private fun binarySearch(value: $type): Int {
                    return binarySearch(value, 0, buffer.size)
                }

                private fun internalAdd(newElement: $type): Boolean {
                    val searchResult = binarySearch(newElement, 0, usedElements)
                    // no need to add anything if the item was found
                    if (searchResult >= 0)
                        return false

                    // when the position isn't found, binarySearch returns -(insertion point) - 1
                    val insertionPoint = -(searchResult + 1)

                    for (i in (insertionPoint until usedElements).reversed())
                        buffer[i + 1] = buffer[i]
                    buffer[insertionPoint] = newElement
                    usedElements++
                    return true
                }

                override fun add(element: $type): Boolean {
                    ensureBufferSpace(1)
                    val initialSize = size
                    internalAdd(element)
                    return size != initialSize
                }

                override fun add(elemA: $type, elemB: $type) {
                    ensureBufferSpace(2)
                    internalAdd(elemA)
                    internalAdd(elemB)
                }

                override fun add(elemA: $type, elemB: $type, elemC: $type) {
                    ensureBufferSpace(3)
                    internalAdd(elemA)
                    internalAdd(elemB)
                    internalAdd(elemC)
                }

                override fun addAll(elements: Collection<$type>): Boolean {
                    ensureBufferSpace(elements.size)
                    for (item in elements)
                        internalAdd(item)
                    return true
                }

                override fun addAll(iterable: Iterable<$type>): Boolean {
                    for (item in iterable)
                        add(item)
                    return true
                }

                @JvmName("getAtIndex")
                override fun getAtIndex(index: Int): $type {
                    assert(index < usedElements)
                    return buffer[index]
                }

                private fun unsafeCompareTo(other: ${simpleName}SortedSet${paramsStar}): Int {
                    val sizeCmp = size - other.size
                    if (sizeCmp != 0)
                        return sizeCmp
                    for (i in 0 until size) {
                        val elemCmp = ${toPrimitive("this.getAtIndex(i)")}.compareTo(${toPrimitive("other.getAtIndex(i)")})
                        if (elemCmp != 0)
                            return elemCmp
                    }
                    return 0
                }

                override fun compareTo(other: ${simpleName}SortedSet${paramsUse}): Int {
                    return unsafeCompareTo(other)
                }

                override fun hashCode(): Int {
                    var h = 1
                    for (i in 0 until size) {
                        h = 31 * h + buffer[i].hashCode()
                    }
                    return h
                }

                override fun equals(other: Any?): Boolean {
                    if (other !is ${simpleName}SortedSet${type.paramsStar})
                        return false
                    return this.unsafeCompareTo(other) == 0
                }

                override fun toString(): String {
                    val builder = StringBuilder(2 + usedElements * 6)
                    builder.append('{')
                    for (i in 0 until usedElements) {
                        if (i != 0)
                            builder.append(", ")
                        builder.append(buffer[i].toString())
                    }         
                    builder.append('}')
                    return builder.toString()
                }

                fun clone(): Mutable${simpleName}ArraySet${paramsUse} {
                    return Mutable${simpleName}ArraySet${paramsUse}(usedElements, buffer.copyOf())
                }

                fun readOnlyClone(): ${simpleName}ArraySet${paramsUse} {
                    return ${simpleName}ArraySet${paramsUse}(buffer.copyOf(usedElements))
                }
            }

            fun ${paramsDecl} mutable${simpleName}ArraySetOf(): Mutable${simpleName}ArraySet${paramsUse} {
                val res = Mutable${simpleName}ArraySet${paramsUse}()
                return res
            }

            fun ${paramsDecl} mutable${simpleName}ArraySetOf(a: $type): Mutable${simpleName}ArraySet${paramsUse} {
                val res = Mutable${simpleName}ArraySet${paramsUse}(1)
                res.add(a)
                return res
            }

            fun ${paramsDecl} mutable${simpleName}ArraySetOf(a: $type, b: $type): Mutable${simpleName}ArraySet${paramsUse} {
                val res = Mutable${simpleName}ArraySet${paramsUse}(2)
                res.add(a)
                res.add(b)
                return res
            }

            fun ${paramsDecl} mutable${simpleName}ArraySetOf(a: $type, b: $type, c: $type): Mutable${simpleName}ArraySet${paramsUse} {
                val res = Mutable${simpleName}ArraySet${paramsUse}(3)
                res.add(a)
                res.add(b)
                res.add(c)
                return res
            }

            /** GENERATED CODE */
            class ${simpleName}ArraySet${paramsDecl} public constructor(
                private var buffer: ${bufferType},
            ) : ${simpleName}SortedSet${paramsUse}, Comparable<${simpleName}SortedSet${paramsUse}> {
                override val size get() = buffer.size

                override fun iterator(): Iterator<$type> {
                    return object : Iterator<$type> {
                        var i = 0
                        override fun hasNext(): Boolean {
                            return i < size
                        }

                        override fun next(): $type = if (i < size) {
                            getAtIndex(i++)
                        } else {
                            throw NoSuchElementException(i.toString())
                        }
                    }
                }

                override fun contains(value: $type): Boolean {
                    return binarySearch(value) >= 0
                }

                private fun binarySearch(value: $type, fromIndex: Int, toIndex: Int): Int {
                    var low = fromIndex
                    var high = toIndex - 1

                    while (low <= high) {
                        val mid = (low + high) ushr 1
                        val midVal = buffer[mid]
                        val cmp = ${toPrimitive("midVal")}.compareTo(${toPrimitive("value")})

                        if (cmp < 0)
                            low = mid + 1
                        else if (cmp > 0)
                            high = mid - 1
                        else
                            return mid
                    }
                    return -(low + 1)
                }

                private fun binarySearch(value: $type): Int {
                    return binarySearch(value, 0, buffer.size)
                }

                override fun getAtIndex(index: Int): $type {
                    return buffer[index]
                }

                private fun unsafeCompareTo(other: ${simpleName}SortedSet${paramsStar}): Int {
                    val sizeCmp = size - other.size
                    if (sizeCmp != 0)
                        return sizeCmp
                    for (i in 0 until size) {
                        val elemCmp = ${toPrimitive("this.getAtIndex(i)")}.compareTo(${toPrimitive("other.getAtIndex(i)")})
                        if (elemCmp != 0)
                            return elemCmp
                    }
                    return 0
                }

                override fun compareTo(other: ${simpleName}SortedSet${paramsUse}): Int {
                    return unsafeCompareTo(other)
                }

                override fun hashCode(): Int {
                    var h = 1
                    for (i in 0 until size) {
                        h = 31 * h + buffer[i].hashCode()
                    }
                    return h
                }

                override fun equals(other: Any?): Boolean {
                    if (other !is ${simpleName}SortedSet${type.paramsStar})
                        return false
                    return this.unsafeCompareTo(other) == 0
                }

                override fun toString(): String {
                    val builder = StringBuilder(2 + buffer.size * 6)
                    builder.append('{')
                    for (i in 0 until buffer.size) {
                        if (i != 0)
                            builder.append(", ")
                        builder.append(buffer[i].toString())
                    }
                    builder.append('}')
                    return builder.toString()
                }

                fun clone(): ${simpleName}ArraySet${paramsUse} {
                    return ${simpleName}ArraySet(buffer.copyOf())
                }

                fun mutableClone(): Mutable${simpleName}ArraySet${paramsUse} {
                    return Mutable${simpleName}ArraySet(buffer.copyOf())
                }

                inline fun update(function: Mutable${simpleName}ArraySet${paramsUse}.() -> Unit): ${simpleName}ArraySet${paramsUse} {
                    val updated = mutableClone()
                    updated.function()
                    return updated.readOnlyClone()
                }
            }

            fun ${paramsDecl} ${decSimpleName}ArraySetOf(): ${simpleName}ArraySet${paramsUse} {
                val res = Mutable${simpleName}ArraySet${paramsUse}()
                return res.readOnlyClone()
            }

            fun ${paramsDecl} ${decSimpleName}ArraySetOf(a: $type): ${simpleName}ArraySet${paramsUse} {
                val res = Mutable${simpleName}ArraySet${paramsUse}(1)
                res.add(a)
                return res.readOnlyClone()
            }

            fun ${paramsDecl} ${decSimpleName}ArraySetOf(a: $type, b: $type): ${simpleName}ArraySet${paramsUse} {
                val res = Mutable${simpleName}ArraySet${paramsUse}(2)
                res.add(a)
                res.add(b)
                return res.readOnlyClone()
            }

            fun ${paramsDecl} ${decSimpleName}ArraySetOf(a: $type, b: $type, c: $type): ${simpleName}ArraySet${paramsUse} {
                val res = Mutable${simpleName}ArraySet${paramsUse}(3)
                res.add(a)
                res.add(b)
                res.add(c)
                return res.readOnlyClone()
            }
        """.trimIndent())
    file.close()
}

class ArraySortedSetGenerator {
    companion object : CollectionGenerator {
        override val generatorId = "ArraySortedSet"
        override val dependencies = arrayOf("Interfaces")

        override fun generate(context: GeneratorContext, currentFile: KSFile, itemType: CollectionItemType) {
            itemType.generateArraySortedSet(context, currentFile)
        }
    }
}
