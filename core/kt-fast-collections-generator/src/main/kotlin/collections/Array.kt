package fr.sncf.osrd.fast_collections.generator.collections

import fr.sncf.osrd.fast_collections.generator.*
import com.google.devtools.ksp.processing.Dependencies
import com.google.devtools.ksp.symbol.KSFile
import java.util.*

private fun CollectionItemType.generateArray(context: GeneratorContext, currentFile: KSFile) {
    val simpleName = type.simpleName
    val decSimpleName = simpleName.replaceFirstChar { it.lowercase(Locale.getDefault()) }
    val paramsDecl = type.paramsDecl
    val paramsUse = type.paramsUse
    val fileName = "${simpleName}Array"
    val storageType = storageType!!
    val bufferType = storageType.primitiveArray
    val file = context.codeGenerator.createNewFile(Dependencies(true, currentFile), generatedPackage, fileName)
    file.appendText("""
            @file:OptIn(ExperimentalUnsignedTypes::class)

            /** GENERATED CODE */

            package $generatedPackage

            import ${type.qualifiedName}

            @JvmInline
            value class Mutable${simpleName}Array${paramsDecl}(private val data: $bufferType) {
                public constructor(size: Int, init: (Int) -> $type) : this($bufferType(size) { i -> ${storageType.toPrimitive("init(i)")} })

                val size get() = data.size

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
                    return Mutable${simpleName}Array${paramsUse}(data.copyOf())
                }

                fun copyOf(): Mutable${simpleName}Array${paramsUse} {
                    return clone()
                }

                fun copyOf(size: Int): Mutable${simpleName}Array${paramsUse} {
                    return Mutable${simpleName}Array${paramsUse}(data.copyOf(size))
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
        """.trimIndent())
    file.close()
}


class ArrayGenerator {
    companion object : CollectionGenerator {
        override val generatorId = "Array"
        override val dependencies = arrayOf("Interfaces")

        override fun generate(context: GeneratorContext, currentFile: KSFile, itemType: CollectionItemType) {
            itemType.generateArray(context, currentFile)
        }
    }
}
