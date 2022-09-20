package fr.sncf.osrd.fast_collections

import kotlin.reflect.KClass

@Target(AnnotationTarget.FILE)
@Retention(AnnotationRetention.SOURCE)
@Repeatable
annotation class PrimitiveWrapperCollections(
    val wrapper: KClass<*>,
    val primitive: KClass<*>,
    val fromPrimitive: String,
    val toPrimitive: String,
    val collections: Array<String>,
)

@Target(AnnotationTarget.FILE)
@Retention(AnnotationRetention.SOURCE)
@Repeatable
annotation class PrimitiveCollections(
    val primitive: KClass<*>,
    val collections: Array<String>,
)
