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

            class Mutable${simpleName}ArrayList${paramsDecl} private constructor(
                private var usedElements: Int,
                private var buffer: ${bufferType},
            ) : Mutable$itemListType, Comparable<$itemListType> {
                public constructor(data: $bufferType) : this(data.size, data)
                public constructor(capacity: Int) : this(0, $bufferType(capacity) { $wrapperZero })
                public constructor() : this(${DEFAULT_CAPACITY})

                override val size get() = usedElements

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

                override fun ensureCapacity(expectedElements: Int) {
                    if (expectedElements > capacity) {
                        ensureBufferSpace(expectedElements - usedElements)
                    }
                }

                override fun add(element: $type): Boolean {
                    ensureBufferSpace(1)
                    buffer[usedElements++] = element
                    return true
                }

                override fun add(elemA: $type, elemB: $type) {
                    ensureBufferSpace(2)
                    buffer[usedElements++] = elemA
                    buffer[usedElements++] = elemB
                }

                override fun add(elemA: $type, elemB: $type, elemC: $type) {
                    ensureBufferSpace(3)
                    buffer[usedElements++] = elemA
                    buffer[usedElements++] = elemB
                    buffer[usedElements++] = elemC
                }

                override fun addAll(elements: Collection<$type>): Boolean {
                    ensureBufferSpace(elements.size)
                    for (item in elements)
                        buffer[usedElements++] = item
                    return true
                }

                override fun addAll(iterable: Iterable<$type>): Boolean {
                    for (item in iterable)
                        add(item)
                    return true
                }

                override fun insert(index: Int, elem: $type) {
                    ensureBufferSpace(1)
                    for (i in (index + 1 until size + 1).reversed())
                        buffer[i] = buffer[i - 1]
                    buffer[index] = elem
                    usedElements++
                }

                override operator fun get(index: Int): $type {
                    assert(index < usedElements)
                    return buffer[index]
                }

                override fun set(index: Int, element: $type): $type {
                    assert(index < usedElements)
                    val oldValue = buffer[index]
                    buffer[index] = element
                    return oldValue
                }

                override fun remove(index: Int): $type {
                    assert(index < usedElements)
                    val oldValue = buffer[index]
                    for (i in index until usedElements)
                        buffer[i] = buffer[i + 1]
                    usedElements--
                    return oldValue
                }

                override fun clone() : Mutable${simpleName}ArrayList${paramsUse} {
                    return Mutable${simpleName}ArrayList${paramsUse}(usedElements, buffer.copyOf())
                }

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

                override fun compareTo(other: $itemListType): Int {
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
                    if (other !is ${simpleName}List${type.paramsStar})
                        return false
                    return this.unsafeCompareTo(other) == 0
                }
            }

            fun ${paramsDecl} mutable${simpleName}ArrayListOf(): Mutable${simpleName}ArrayList${paramsUse} {
                return Mutable${simpleName}ArrayList${paramsUse}()
            }
            
            fun ${paramsDecl} mutable${simpleName}ArrayListOf(a: $type): Mutable${simpleName}ArrayList${paramsUse} {
                val res = Mutable${simpleName}ArrayList${paramsUse}(1)
                res.add(a)
                return res
            }

            fun ${paramsDecl} mutable${simpleName}ArrayListOf(a: $type, b: $type): Mutable${simpleName}ArrayList${paramsUse} {
                val res = Mutable${simpleName}ArrayList${paramsUse}(2)
                res.add(a)
                res.add(b)
                return res
            }

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
