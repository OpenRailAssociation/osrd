package fr.sncf.osrd.fast_collections.generator.collections

import com.google.devtools.ksp.processing.Dependencies
import com.google.devtools.ksp.symbol.KSFile
import fr.sncf.osrd.fast_collections.generator.CollectionGenerator
import fr.sncf.osrd.fast_collections.generator.CollectionItemType
import fr.sncf.osrd.fast_collections.generator.GeneratorContext
import fr.sncf.osrd.fast_collections.generator.appendText

private fun CollectionItemType.generateRingBuffer(context: GeneratorContext, currentFile: KSFile) {
    val simpleName = type.simpleName
    val paramsDecl = type.paramsDecl
    val paramsUse = type.paramsUse
    val fileName = "${simpleName}RingBuffer"
    val bufferType = "Mutable${simpleName}Array${paramsUse}"
    val storageType = storageType!!
    val primitiveZero = storageType.primitiveZero()
    val wrapperZero = storageType.fromPrimitive(primitiveZero)
    val file =
        context.codeGenerator.createNewFile(
            Dependencies(true, currentFile),
            generatedPackage,
            fileName,
        )
    file.appendText(
        """
            @file:OptIn(ExperimentalUnsignedTypes::class)

            /** GENERATED CODE */

            package $generatedPackage

            import fr.sncf.osrd.fast_collections.growCapacity
            import ${type.qualifiedName}

            /** GENERATED CODE */
            class Mutable${simpleName}RingBuffer${paramsDecl} private constructor(
                private var _size: Int,
                private var offset: Int,
                private var startIndex: Int,
                private var buffer: ${bufferType},
            ) : Iterable<$type> {
                private constructor(_size: Int, data: ${bufferType}) : this(_size, 0, 0, data)
                public constructor(data: $bufferType) : this(data.size, data)
                public constructor(capacity: Int) : this(0, $bufferType(capacity) { $wrapperZero })
                public constructor() : this(${DEFAULT_CAPACITY})

                val size get() = _size

                fun isEmpty() = size == 0
                fun isNotEmpty() = size != 0

                val beginIndex get() = if (isEmpty()) -1 else startIndex
                val endIndex get() = if (isEmpty()) -1 else startIndex + size

                /** GENERATED CODE */
                override fun iterator(): Iterator<$type> {
                    return object : Iterator<$type> {
                        var i = startIndex
                        override fun hasNext(): Boolean {
                            return i < startIndex + size
                        }

                        override fun next(): $type = if (i < startIndex + size) {
                            get(i++)
                        } else {
                            throw NoSuchElementException(i.toString())
                        }
                    }
                }

                private val capacity: Int get() = buffer.size

                /** GENERATED CODE */
                private fun ensureBufferSpace(expectedAdditions: Int) {
                    val requiredCapacity = size + expectedAdditions
                    if (requiredCapacity > capacity) {
                        val newCapacity = growCapacity(capacity, size, expectedAdditions)
                        val newBuffer = $bufferType(newCapacity) { $wrapperZero }
                        for (i in 0 until size) {
                            newBuffer[i] = buffer[(offset + i).mod(capacity)]
                        }
                        offset = 0
                        buffer = newBuffer
                    }
                }

                /** GENERATED CODE */
                fun ensureCapacity(expectedElements: Int) {
                    if (expectedElements > capacity) {
                        ensureBufferSpace(expectedElements - size)
                    }
                }

                /** GENERATED CODE */
                fun addBack(element: $type): Int {
                    ensureBufferSpace(1)
                    buffer[(offset + _size++).mod(capacity)] = element
                    return startIndex + size - 1
                }

                /** GENERATED CODE */
                fun addBack(elemA: $type, elemB: $type) {
                    ensureBufferSpace(2)
                    buffer[(offset + _size++).mod(capacity)] = elemA
                    buffer[(offset + _size++).mod(capacity)] = elemB
                }

                /** GENERATED CODE */
                fun addBack(elemA: $type, elemB: $type, elemC: $type) {
                    ensureBufferSpace(3)
                    buffer[(offset + _size++).mod(capacity)] = elemA
                    buffer[(offset + _size++).mod(capacity)] = elemB
                    buffer[(offset + _size++).mod(capacity)] = elemC
                }

                /** GENERATED CODE */
                fun addBackAll(elements: Collection<$type>): Boolean {
                    ensureBufferSpace(elements.size)
                    for (item in elements)
                        buffer[(offset + _size++).mod(capacity)] = item
                    return true
                }

                /** GENERATED CODE */
                fun addBackAll(iterable: Iterable<$type>): Boolean {
                    for (item in iterable)
                        addBack(item)
                    return true
                }
                
                /** GENERATED CODE */
                fun addFront(element: $type): Int {
                    if (size == 0) {
                        return addBack(element)
                    }
                    ensureBufferSpace(1)
                    offset = (offset-1).mod(capacity)
                    buffer[offset] = element
                    startIndex--
                    _size++
                    return startIndex
                }


                /** GENERATED CODE */
                operator fun get(index: Int): $type {
                    val true_index = index - startIndex
                    assert(true_index >= 0)
                    assert(true_index < size)
                    return buffer[(offset + true_index).mod(capacity)]
                }

                /** GENERATED CODE */
                operator fun set(index: Int, element: $type): $type {
                    val true_index = index - startIndex
                    assert(true_index < size)
                    val oldValue = buffer[(offset + true_index).mod(capacity)]
                    buffer[(offset + true_index).mod(capacity)] = element
                    return oldValue
                }

                /** GENERATED CODE */
                fun removeBack(): $type {
                    assert(_size-- > 0)
                    return buffer[(offset + size).mod(capacity)]
                }

                /** GENERATED CODE */
                fun removeFront(): $type {
                    assert(_size-- > 0)
                    startIndex++
                    val oldValue = buffer[offset.mod(capacity)]
                    offset = (offset + 1).mod(capacity)
                    return oldValue
                }

                /** GENERATED CODE */
                fun removeFrontUntil(cutoffIndex: Int) {
                    val removedCount = cutoffIndex - startIndex
                    if (removedCount == 0)
                        return
                    assert(removedCount > 0)
                    assert(removedCount <= size)
                    _size -= removedCount
                    startIndex += removedCount
                    offset = (offset + removedCount).mod(capacity)
                }

                /** GENERATED CODE */
                fun clone() : Mutable${simpleName}RingBuffer${paramsUse} {
                    return Mutable${simpleName}RingBuffer${paramsUse}(size, buffer.copyOf())
                }

                /** GENERATED CODE */
                override fun toString(): String {
                    return joinToString(prefix = "[", separator = ", ", postfix = "]")
                }
            }

            /** GENERATED CODE */
            fun ${paramsDecl} mutable${simpleName}RingBufferOf(): Mutable${simpleName}RingBuffer${paramsUse} {
                return Mutable${simpleName}RingBuffer${paramsUse}()
            }

            /** GENERATED CODE */
            fun ${paramsDecl} mutable${simpleName}RingBufferOf(a: $type): Mutable${simpleName}RingBuffer${paramsUse} {
                val res = Mutable${simpleName}RingBuffer${paramsUse}(1)
                res.addBack(a)
                return res
            }

            /** GENERATED CODE */
            fun ${paramsDecl} mutable${simpleName}RingBufferOf(a: $type, b: $type): Mutable${simpleName}RingBuffer${paramsUse} {
                val res = Mutable${simpleName}RingBuffer${paramsUse}(2)
                res.addBack(a)
                res.addBack(b)
                return res
            }

            /** GENERATED CODE */
            fun ${paramsDecl} mutable${simpleName}RingBufferOf(a: $type, b: $type, c: $type): Mutable${simpleName}RingBuffer${paramsUse} {
                val res = Mutable${simpleName}RingBuffer${paramsUse}(3)
                res.addBack(a)
                res.addBack(b)
                res.addBack(c)
                return res
            }
        """
            .trimIndent()
    )
    file.close()
}

class RingBufferGenerator {
    companion object : CollectionGenerator {
        override val generatorId = "RingBuffer"
        override val dependencies = arrayOf("Interfaces")

        override fun generate(
            context: GeneratorContext,
            currentFile: KSFile,
            itemType: CollectionItemType,
        ) {
            itemType.generateRingBuffer(context, currentFile)
        }
    }
}
