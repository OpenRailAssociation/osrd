package fr.sncf.osrd.fast_collections.generator.collections

import com.google.devtools.ksp.processing.Dependencies
import com.google.devtools.ksp.symbol.KSFile
import fr.sncf.osrd.fast_collections.generator.*
import java.util.*

private fun CollectionItemType.generateArray(context: GeneratorContext, currentFile: KSFile) {
    val simpleName = type.simpleName
    val decSimpleName = simpleName.replaceFirstChar { it.lowercase(Locale.getDefault()) }
    val paramsDecl = type.paramsDecl
    val paramsUse = type.paramsUse
    val fileName = "${simpleName}Array"
    val storageType = storageType!!
    val bufferType = storageType.primitiveArray
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

            import ${type.qualifiedName}

            // regular lambda types are compiled to a generic Function<In, Out> type, which boxes
            // its arguments and return value. It's a significant performance bug.
            fun interface ${simpleName}ArrayInitializer${paramsDecl} {
                fun call(idx: Int): $type
            }

            @JvmInline
            value class Mutable${simpleName}Array${paramsDecl}(private val data: $bufferType) {
                public constructor(size: Int, init: ${simpleName}ArrayInitializer${paramsUse})
                    : this($bufferType(size) { i -> ${storageType.toPrimitive("init.call(i)")} })

                val size get() = data.size

                fun asPrimitiveArray(): $bufferType {
                    return data
                }

                operator fun get(index: Int): $type {
                    return ${storageType.fromPrimitive("data[index]")}
                }

                operator fun get(index: UInt): $type {
                    return get(index.toInt())
                }

                operator fun set(index: Int, value: $type) {
                    data[index] = ${storageType.toPrimitive("value")}
                }

                operator fun set(index: UInt, value: $type) {
                    set(index.toInt(), value)
                }

                /**
                 * Array must be sorted.
                 * If the array contains the value, return its index.
                 * Otherwise returns -(insertion offset) - 1, where insertion offset is
                 * where to insert the new value to keep the array sorted.
                 */
                fun binarySearch(
                    value: $type,
                    comparator: ${simpleName}Comparator${paramsUse},
                    fromIndex: Int,
                    toIndex: Int,
                ): Int {
                    var low = fromIndex
                    var high = toIndex - 1

                    while (low <= high) {
                        val mid = (low + high) ushr 1
                        val midVal = data[mid]
                        val cmp = comparator.compare(${storageType.fromPrimitive("midVal")}, value)

                        if (cmp < 0)
                            low = mid + 1
                        else if (cmp > 0)
                            high = mid - 1
                        else
                            return mid
                    }
                    return -(low + 1)
                }

                /**
                 * Array must be sorted.
                 * If the array contains the value, return its index.
                 * Otherwise returns -(insertion offset) - 1, where insertion offset is
                 * where to insert the new value to keep the array sorted.
                 */
                fun binarySearch(value: $type, comparator: ${simpleName}Comparator${paramsUse}): Int {
                    return binarySearch(value, comparator, 0, data.size)
                }

                /** Creates an iterator over the elements of the array. */
                operator fun iterator(): Iterator<$type> {
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

                fun clone(): Mutable${simpleName}Array${paramsUse} {
                    return copyOf()
                }

                fun copyOf(): Mutable${simpleName}Array${paramsUse} {
                    return Mutable${simpleName}Array${paramsUse}(data.copyOf())
                }

                fun copyOf(size: Int): Mutable${simpleName}Array${paramsUse} {
                    return Mutable${simpleName}Array${paramsUse}(data.copyOf(size))
                }

                fun immutableCopyOf(): ${simpleName}Array${paramsUse} {
                    return ${simpleName}Array${paramsUse}(data.copyOf())
                }

                fun immutableCopyOf(size: Int): ${simpleName}Array${paramsUse} {
                    return ${simpleName}Array${paramsUse}(data.copyOf(size))
                }
            }

            fun ${paramsDecl} mutable${simpleName}Array(a: $type): Mutable${simpleName}Array${paramsUse} {
                val data = $bufferType(1)
                data[0] = ${storageType.toPrimitive("a")}
                return Mutable${simpleName}Array(data)
            }

            fun ${paramsDecl} mutable${simpleName}Array(a: $type, b: $type): Mutable${simpleName}Array${paramsUse} {
                val data = $bufferType(2)
                data[0] = ${storageType.toPrimitive("a")}
                data[1] = ${storageType.toPrimitive("b")}
                return Mutable${simpleName}Array(data)
            }

            fun ${paramsDecl} mutable${simpleName}Array(a: $type, b: $type, c: $type): Mutable${simpleName}Array${paramsUse} {
                val data = $bufferType(3)
                data[0] = ${storageType.toPrimitive("a")}
                data[1] = ${storageType.toPrimitive("b")}
                data[2] = ${storageType.toPrimitive("c")}
                return Mutable${simpleName}Array(data)
            }

            /** GENERATED CODE */

            @JvmInline
            value class ${simpleName}Array${paramsDecl}(private val data: ${bufferType}) {
                val size get() = data.size

                operator fun get(index: Int): $type {
                    return ${storageType.fromPrimitive("data[index]")}
                }

                operator fun get(index: UInt): $type {
                    return get(index.toInt())
                }

                fun clone(): ${simpleName}Array${paramsUse} {
                    return ${simpleName}Array${paramsUse}(data.copyOf())
                }

                fun copyOf(): ${simpleName}Array${paramsUse} {
                    return clone()
                }

                fun copyOf(size: Int): ${simpleName}Array${paramsUse} {
                    return ${simpleName}Array${paramsUse}(data.copyOf(size))
                }
                fun binarySearch(
                    value: $type,
                    comparator: ${simpleName}Comparator${paramsUse},
                    fromIndex: Int,
                    toIndex: Int,
                ): Int {
                    var low = fromIndex
                    var high = toIndex - 1

                    while (low <= high) {
                        val mid = (low + high) ushr 1
                        val midVal = data[mid]
                        val cmp = comparator.compare(${storageType.fromPrimitive("midVal")}, value)

                        if (cmp < 0)
                            low = mid + 1
                        else if (cmp > 0)
                            high = mid - 1
                        else
                            return mid
                    }
                    return -(low + 1)
                }

                fun binarySearch(value: $type, comparator: ${simpleName}Comparator${paramsUse}): Int {
                    return binarySearch(value, comparator, 0, data.size)
                }

                /** Creates an iterator over the elements of the array. */
                operator fun iterator(): Iterator<$type> {
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
            }

            fun ${paramsDecl} ${decSimpleName}ArrayOf(a: $type): ${simpleName}Array${paramsUse} {
                val data = $bufferType(1)
                data[0] = ${storageType.toPrimitive("a")}
                return ${simpleName}Array(data)
            }

            fun ${paramsDecl} ${decSimpleName}ArrayOf(a: $type, b: $type): ${simpleName}Array${paramsUse} {
                val data = $bufferType(2)
                data[0] = ${storageType.toPrimitive("a")}
                data[1] = ${storageType.toPrimitive("b")}
                return ${simpleName}Array(data)
            }

            fun ${paramsDecl} ${decSimpleName}ArrayOf(a: $type, b: $type, c: $type): ${simpleName}Array${paramsUse} {
                val data = $bufferType(3)
                data[0] = ${storageType.toPrimitive("a")}
                data[1] = ${storageType.toPrimitive("b")}
                data[2] = ${storageType.toPrimitive("c")}
                return ${simpleName}Array(data)
            }
        """
            .trimIndent()
    )
    file.close()
}

class ArrayGenerator {
    companion object : CollectionGenerator {
        override val generatorId = "Array"
        override val dependencies = arrayOf("Interfaces")

        override fun generate(
            context: GeneratorContext,
            currentFile: KSFile,
            itemType: CollectionItemType,
        ) {
            itemType.generateArray(context, currentFile)
        }
    }
}
