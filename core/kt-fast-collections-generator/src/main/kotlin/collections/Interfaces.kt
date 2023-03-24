package fr.sncf.osrd.fast_collections.generator.collections

import fr.sncf.osrd.fast_collections.generator.*
import com.google.devtools.ksp.processing.Dependencies
import com.google.devtools.ksp.symbol.KSFile
import java.util.*


private fun CollectionItemType.generateInterfaces(context: GeneratorContext, currentFile: KSFile) {
    val simpleName = type.simpleName
    val paramsDecl = type.paramsDecl
    val paramsUse = type.paramsUse
    val fileName = "${simpleName}CollectionInterfaces"
    val file = context.codeGenerator.createNewFile(Dependencies(true, currentFile), generatedPackage, fileName)
    file.appendText("""
            @file:OptIn(ExperimentalUnsignedTypes::class)

            /** GENERATED CODE */

            package $generatedPackage

            import ${type.qualifiedName}

            /** GENERATED CODE */
            interface ${simpleName}Collection${paramsDecl} : Iterable<${type}> {
                val size: Int
            }

            /** GENERATED CODE */
            interface ${simpleName}List${paramsDecl} : ${simpleName}Collection${paramsUse} {
                operator fun get(index: Int): $type
                fun clone(): Mutable${simpleName}List${paramsUse}
                fun reversed() : Mutable${simpleName}ArrayList${paramsUse}
            }

            /** GENERATED CODE */
            interface Mutable${simpleName}List${paramsDecl} : ${simpleName}List${paramsUse} {
                fun ensureCapacity(expectedElements: Int)
                fun add(element: ${type}): Boolean
                fun add(elemA: ${type}, elemB: ${type})
                fun add(elemA: ${type}, elemB: ${type}, elemC: ${type})
                fun addAll(elements: Collection<${type}>): Boolean
                fun addAll(iterable: Iterable<${type}>): Boolean
                fun insert(index: Int, elem: ${type})
                fun set(index: Int, element: ${type}): $type
                fun remove(index: Int): $type
            }

            /** GENERATED CODE */
            interface ${simpleName}SortedSet${paramsDecl} : ${simpleName}Collection${paramsUse} {
                operator fun contains(value: ${type}): Boolean
                fun getAtIndex(index: Int): $type
            }

            /** GENERATED CODE */
            interface Mutable${simpleName}SortedSet${paramsDecl} : ${simpleName}SortedSet${paramsDecl} {
                fun add(element: ${type}): Boolean
                fun add(elemA: ${type}, elemB: ${type})
                fun add(elemA: ${type}, elemB: ${type}, elemC: ${type})
                fun addAll(elements: Collection<${type}>): Boolean
                fun addAll(iterable: Iterable<${type}>): Boolean
                fun remove(value: ${type}): Boolean
            }
        """.trimIndent())
    file.close()
}

class InterfacesGenerator {
    companion object : CollectionGenerator {
        override val generatorId = "Interfaces"
        /// A list of generators that should also run
        override val dependencies: Array<String> = arrayOf()
        override fun generate(context: GeneratorContext, currentFile: KSFile, itemType: CollectionItemType) {
            itemType.generateInterfaces(context, currentFile)
        }
    }
}
