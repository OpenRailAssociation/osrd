package fr.sncf.osrd.fast_collections.generator

import com.google.devtools.ksp.processing.*
import com.google.devtools.ksp.symbol.*
import com.google.devtools.ksp.validate

const val ANNOTATION_PACKAGE = "fr.sncf.osrd.fast_collections"
const val ANNOTATION_SIMPLE_NAME = "PrimitiveWrapperCollections"
const val ANNOTATION_QUALIFIED_NAME = "${ANNOTATION_PACKAGE}.${ANNOTATION_SIMPLE_NAME}"

fun addGenerator(generators: MutableSet<CollectionGenerator>, generatorId: String) {
    val generator = GENERATORS[generatorId] ?: throw RuntimeException("unknown generator: $generatorId")
    if (generators.add(generator)) {
        for (dependency in generator.dependencies)
            addGenerator(generators, dependency)
    }
}

fun getArrayType(primitive: KSDeclaration): String {
    val primitiveQName = primitive.qualifiedName!!.asString()
    when (primitiveQName) {
        "kotlin.Int" -> return "IntArray"
        "kotlin.UInt" -> return "UIntArray"
        "kotlin.Long" -> return "LongArray"
        "kotlin.ULong" -> return "ULongArray"
    }
    throw NotImplementedError("unsupported primitive type: $primitiveQName")
}


fun generateCollections(
    context: GeneratorContext,
    currentFile: KSFile,
    // compiler's version of UInt::class
    primitiveTypeDecl: KSDeclaration,
    // compiler's version of UIntWrapper::class
    wrapperTypeDecl: KSDeclaration,
    toPrimitive: (String) -> String,
    fromPrimitive: (String) -> String,
    collections: List<String>,
) {

    val generators: MutableSet<CollectionGenerator> = hashSetOf()
    for (collection in collections)
        addGenerator(generators, collection)

    // parse the type of the wrapper class to generate collections for
    val wrapperType = GeneratorType(
        wrapperTypeDecl.packageName.asString(),
        wrapperTypeDecl.simpleName.getShortName(),
        wrapperTypeDecl.typeParameters.map {
            // TODO: implement type bounds
            TypeParameter(it.name.getShortName(), listOf())
        }.toList()
    )

    // parse the type of the underlying storage array
    val storageType = StorageType(
        primitive = primitiveTypeDecl.simpleName.asString(),
        primitiveArray = getArrayType(primitiveTypeDecl),
        toPrimitive = toPrimitive,
        fromPrimitive = fromPrimitive,
    )

    val generatedPackage = currentFile.packageName.asString()
    val itemType = CollectionItemType(
        wrapperType,
        generatedPackage,
        storageType,
    )

    for (generator in generators)
        generator.generate(context, currentFile, itemType)

    // context.generateArrayWrapper(currentFile, primitiveType, wrapperType, toPrimitive, fromPrimitive)
}

private class WrapperSymbolProcessor(val context: GeneratorContext) : SymbolProcessor {
    override fun process(resolver: Resolver): List<KSAnnotated> {
        val symbols = resolver.getSymbolsWithAnnotation(ANNOTATION_QUALIFIED_NAME)
        val invalidSymbols = arrayListOf<KSAnnotated>()
        for (symbol in symbols) {
            if (!symbol.validate()) {
                invalidSymbols.add(symbol)
                continue
            }
            val file = symbol as KSFile
            for (annotation in file.annotations) {
                if (annotation.shortName.getShortName() != ANNOTATION_SIMPLE_NAME)
                    continue

                val wrapperType = (annotation.arguments[0].value as KSType).declaration
                val primitiveType = (annotation.arguments[1].value as KSType).declaration

                val rawFromPrimitive = annotation.arguments[2]
                val rawToPrimitive = annotation.arguments[3]
                val fromPrimitive = rawFromPrimitive.value as String
                val toPrimitive = rawToPrimitive.value as String
                val toPrimitiveFun: (String) -> String = { toPrimitive.format(it) }
                val fromPrimitiveFun: (String) -> String = { fromPrimitive.format(it) }
                val collections = (annotation.arguments[4].value as List<*>).map { it as String }.toList()
                generateCollections(context, file, primitiveType, wrapperType, toPrimitiveFun, fromPrimitiveFun, collections)
            }
        }
        return invalidSymbols
    }
}

class PrimitiveWrapperCollectionsProcessorProvider : SymbolProcessorProvider {
    override fun create(
        environment: SymbolProcessorEnvironment
    ): SymbolProcessor {
        val context = GeneratorContext(environment.codeGenerator, environment.logger)
        return WrapperSymbolProcessor(context)
    }
}
