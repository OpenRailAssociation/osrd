package fr.sncf.osrd.fast_collections.generator

import fr.sncf.osrd.fast_collections.generator.collections.*
import com.google.devtools.ksp.processing.CodeGenerator
import com.google.devtools.ksp.processing.KSPLogger
import com.google.devtools.ksp.symbol.KSFile
import java.io.OutputStream

class GeneratorContext(
    val codeGenerator: CodeGenerator,
    val logger: KSPLogger,
)

class TypeParameter(val name: String, val bounds: List<GeneratorType>)

class GeneratorType(
    // org.test.package
    val packagePath: String,
    // UIntWrapper
    val simpleName: String,
    // listOf(T)
    val parameters: List<TypeParameter>,
) {
    // "org.test.package.UIntWrapper"
    val qualifiedName get() = "${packagePath}.${simpleName}"

    // "<T>" if parameters, "" otherwise
    val paramsUse: String

    // "<*>" if parameters, "" otherwise
    val paramsStar: String

    // "<T: Bound>" if parameters, "" otherwise
    val paramsDecl: String

    // "UIntWrapper<T>" if parameters, "UIntWrapper" otherwise
    val name: String

    init {
        if (parameters.isNotEmpty()) {
            paramsUse = parameters.joinToString(prefix = "<", separator = ", ", postfix = ">") { it.name }
            // TODO: support type bounds
            paramsDecl = paramsUse
            paramsStar = parameters.joinToString(prefix = "<", separator = ", ", postfix = ">") { "*" }
        } else {
            paramsUse = ""
            paramsDecl = ""
            paramsStar = ""
        }
        name = "${simpleName}${paramsUse}"
    }

    override fun toString(): String {
        return name
    }
}

class StorageType(
    // the primitive type the wrapper relies on
    val primitive: String,
    // the primitive array type UIntArray the wrapper relies on
    val primitiveArray: String,
    // how to convert from the primitive type
    val toPrimitive: (String) -> String,
    // how to convert to the primitive type
    val fromPrimitive: (String) -> String,
) {
    fun primitiveZero(): String {
        when (primitive) {
            "Int" -> return "0"
            "UInt" -> return "0u"
            "Long" -> return "0L"
            "ULong" -> return "0uL"
        }
        throw RuntimeException("unknown primitive type")
    }
}

/// A wrapper type over a primitive type
class CollectionItemType(
    // the type of the item to generate the collection for
    val type: GeneratorType,
    // the target package path for generated collections
    val generatedPackage: String,
    // metadata about the primitive type used to store collection items,
    // or null if it is a primitive type
    val storageType: StorageType?
)


fun OutputStream.appendText(str: String) {
    this.write(str.toByteArray())
}


interface CollectionGenerator {
    // name of the collection generator
    val generatorId: String
    val dependencies: Array<String>

    // generate a custom collection for some wrapper type
    fun generate(
        context: GeneratorContext,
        currentFile: KSFile,
        itemType: CollectionItemType,
    )
}

val GENERATORS = mapOf<String, CollectionGenerator>(
    Pair("Interfaces", InterfacesGenerator),
    Pair("Array", ArrayGenerator),
    Pair("ArrayList", ArrayListGenerator),
    Pair("ArraySortedSet", ArraySortedSetGenerator),
)
