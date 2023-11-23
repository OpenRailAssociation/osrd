package fr.sncf.osrd.fast_collections.generator.collections

import fr.sncf.osrd.fast_collections.generator.*
import com.google.devtools.ksp.processing.Dependencies
import com.google.devtools.ksp.symbol.KSFile


const val DEFAULT_CAPACITY = 4

private fun CollectionItemType.generateArrayList(context: GeneratorContext, currentFile: KSFile) {
    val simpleName = type.simpleName
    val paramsDecl = type.paramsDecl
    val paramsUse = type.paramsUse
    val paramsStar = type.paramsStar
    val fileName = "${simpleName}ArrayList"
    val bufferType = "Mutable${simpleName}Array${paramsUse}"
    val itemListType = "${simpleName}List${paramsUse}"
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
            class Mutable${simpleName}ArrayList${paramsDecl} private constructor(
                private var usedElements: Int,
                private var buffer: ${bufferType},
            ) : Mutable$itemListType, Comparable<$itemListType> {
                public constructor(data: $bufferType) : this(data.size, data)
                public constructor(capacity: Int) : this(0, $bufferType(capacity) { $wrapperZero })
                public constructor() : this(${DEFAULT_CAPACITY})

                override val size get() = usedElements
                fun isEmpty() = size == 0
                fun isNotEmpty() = size != 0

                /** GENERATED CODE */
                override fun iterator(): Iterator<$type> {
                    return object : Iterator<$type> {
                        var i = 0
                        override fun hasNext(): Boolean {
                            return i < size
                        }

                        override fun next(): $type = if (i < size) {
                            get(i++)
                        } else {
                            throw NoSuchElementException(i.toString())
                        }
                    }
                }

                private val capacity: Int get() = buffer.size

                /** GENERATED CODE */
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

                /** GENERATED CODE */
                override fun ensureCapacity(expectedElements: Int) {
                    if (expectedElements > capacity) {
                        ensureBufferSpace(expectedElements - usedElements)
                    }
                }

                /** GENERATED CODE */
                @JvmName("add")
                override fun add(element: $type): Boolean {
                    ensureBufferSpace(1)
                    buffer[usedElements++] = element
                    return true
                }

                /** GENERATED CODE */
                override fun add(elemA: $type, elemB: $type) {
                    ensureBufferSpace(2)
                    buffer[usedElements++] = elemA
                    buffer[usedElements++] = elemB
                }

                /** GENERATED CODE */
                override fun add(elemA: $type, elemB: $type, elemC: $type) {
                    ensureBufferSpace(3)
                    buffer[usedElements++] = elemA
                    buffer[usedElements++] = elemB
                    buffer[usedElements++] = elemC
                }

                /** GENERATED CODE */
                override fun addAll(elements: Collection<$type>): Boolean {
                    ensureBufferSpace(elements.size)
                    for (item in elements)
                        buffer[usedElements++] = item
                    return true
                }

                /** GENERATED CODE */
                override fun addAll(iterable: Iterable<$type>): Boolean {
                    for (item in iterable)
                        add(item)
                    return true
                }

                /** GENERATED CODE */
                override fun insert(index: Int, elem: $type) {
                    ensureBufferSpace(1)
                    for (i in (index + 1 until size + 1).reversed())
                        buffer[i] = buffer[i - 1]
                    buffer[index] = elem
                    usedElements++
                }

                /** GENERATED CODE */
                override operator fun get(index: Int): $type {
                    assert(index < usedElements)
                    return buffer[index]
                }

                /** GENERATED CODE */
                override operator fun set(index: Int, element: $type): $type {
                    assert(index < usedElements)
                    val oldValue = buffer[index]
                    buffer[index] = element
                    return oldValue
                }

                /** GENERATED CODE */
                override fun remove(index: Int): $type {
                    assert(index < usedElements)
                    val oldValue = buffer[index]
                    for (i in index until usedElements - 1)
                        buffer[i] = buffer[i + 1]
                    usedElements--
                    return oldValue
                }

                /** GENERATED CODE */
                fun toMutableArray() : Mutable${simpleName}Array${paramsUse} {
                    return buffer.copyOf(usedElements)
                }

                /** GENERATED CODE */
                fun toArray() : ${simpleName}Array${paramsUse} {
                    return buffer.immutableCopyOf(usedElements)
                }

                /** GENERATED CODE */
                override fun clone() : Mutable${simpleName}ArrayList${paramsUse} {
                    return Mutable${simpleName}ArrayList${paramsUse}(usedElements, buffer.copyOf())
                }

                /** GENERATED CODE */
                override fun reversed() : Mutable${simpleName}ArrayList${paramsUse} {
                    val new = Mutable${simpleName}ArrayList${paramsUse}()
                    for (i in 0 until usedElements) {
                        new.add(buffer[usedElements - i - 1])
                    }
                    return new
                }

                /** GENERATED CODE */
                private fun unsafeCompareTo(other: ${simpleName}List${paramsStar}): Int {
                    val sizeCmp = size.compareTo(other.size)
                    if (sizeCmp != 0)
                        return sizeCmp
                    for (i in 0 until size) {
                        val elemCmp = ${toPrimitive("this[i]")}.compareTo(${toPrimitive("other[i]")})
                        if (elemCmp != 0)
                            return elemCmp
                    }
                    return 0
                }

                /** GENERATED CODE */
                override fun compareTo(other: $itemListType): Int {
                    return unsafeCompareTo(other)
                }

                /** GENERATED CODE */
                override fun hashCode(): Int {
                    var h = 1
                    for (i in 0 until size) {
                        h = 31 * h + buffer[i].hashCode()
                    }
                    return h
                }

                /** GENERATED CODE */
                override fun equals(other: Any?): Boolean {
                    if (other !is ${simpleName}List${type.paramsStar})
                        return false
                    return this.unsafeCompareTo(other) == 0
                }

                /** GENERATED CODE */
                override fun toString(): String {
                    return joinToString(prefix = "[", separator = ", ", postfix = "]")
                }

                /** GENERATED CODE */
                fun clear() {
                    usedElements = 0
                }
            }

            /** GENERATED CODE */
            fun ${paramsDecl} mutable${simpleName}ArrayListOf(): Mutable${simpleName}ArrayList${paramsUse} {
                return Mutable${simpleName}ArrayList${paramsUse}()
            }

            /** GENERATED CODE */
            fun ${paramsDecl} mutable${simpleName}ArrayListOf(a: $type): Mutable${simpleName}ArrayList${paramsUse} {
                val res = Mutable${simpleName}ArrayList${paramsUse}(1)
                res.add(a)
                return res
            }

            /** GENERATED CODE */
            fun ${paramsDecl} mutable${simpleName}ArrayListOf(a: $type, b: $type): Mutable${simpleName}ArrayList${paramsUse} {
                val res = Mutable${simpleName}ArrayList${paramsUse}(2)
                res.add(a)
                res.add(b)
                return res
            }

            /** GENERATED CODE */
            fun ${paramsDecl} mutable${simpleName}ArrayListOf(a: $type, b: $type, c: $type): Mutable${simpleName}ArrayList${paramsUse} {
                val res = Mutable${simpleName}ArrayList${paramsUse}(3)
                res.add(a)
                res.add(b)
                res.add(c)
                return res
            }
        """.trimIndent())
    file.close()
}

class ArrayListGenerator {
    companion object : CollectionGenerator {
        override val generatorId = "ArrayList"
        override val dependencies = arrayOf("Interfaces")

        override fun generate(context: GeneratorContext, currentFile: KSFile, itemType: CollectionItemType) {
            itemType.generateArrayList(context, currentFile)
        }
    }
}
