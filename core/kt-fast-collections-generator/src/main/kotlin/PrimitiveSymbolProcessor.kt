package fr.sncf.osrd.fast_collections.generator

import com.google.devtools.ksp.processing.*
import com.google.devtools.ksp.symbol.*
import com.google.devtools.ksp.validate

private const val ANNOTATION_PACKAGE = "fr.sncf.osrd.fast_collections"
private const val ANNOTATION_SIMPLE_NAME = "PrimitiveCollections"
private const val ANNOTATION_QUALIFIED_NAME = "${ANNOTATION_PACKAGE}.${ANNOTATION_SIMPLE_NAME}"

private class PrimitiveSymbolProcessor(val context: GeneratorContext) : SymbolProcessor {
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
                if (annotation.shortName.getShortName() != ANNOTATION_SIMPLE_NAME) continue

                val primitiveType = (annotation.arguments[0].value as KSType).declaration

                val fromPrimitive = "(%s)"
                val toPrimitive = "(%s)"
                val toPrimitiveFun: (String) -> String = { toPrimitive.format(it) }
                val fromPrimitiveFun: (String) -> String = { fromPrimitive.format(it) }
                val collections = (annotation.arguments[1].value as List<*>).map { it as String }
                generateCollections(
                    context,
                    file,
                    primitiveType,
                    primitiveType,
                    toPrimitiveFun,
                    fromPrimitiveFun,
                    collections,
                )
            }
        }
        return invalidSymbols
    }
}

class PrimitiveCollectionsProcessorProvider : SymbolProcessorProvider {
    override fun create(environment: SymbolProcessorEnvironment): SymbolProcessor {
        val context = GeneratorContext(environment.codeGenerator, environment.logger)
        return PrimitiveSymbolProcessor(context)
    }
}
