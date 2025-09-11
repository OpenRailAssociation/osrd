package fr.sncf.osrd.utils

import java.nio.file.Files
import kotlin.io.path.Path
import kotlin.io.path.exists
import kotlin.io.path.readBytes
import kotlin.io.path.writeBytes
import kotlin.time.measureTime
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.cbor.Cbor
import kotlinx.serialization.modules.SerializersModule

/**
 * If a cache folder has been set, get the cached data if present, otherwise generate it and write a
 * new file. Directly calls the generator function if no cache folder has been set.
 */
@OptIn(ExperimentalSerializationApi::class)
fun <T> withLocalCache(
    cacheFolder: String?,
    filename: String?,
    serializer: KSerializer<T>,
    module: SerializersModule = Cbor.serializersModule,
    generateData: () -> T,
): T {
    if (cacheFolder == null || filename == null) return generateData()
    val folder = Path(cacheFolder)
    Files.createDirectories(folder)
    val file = folder.resolve(filename)
    val cbor = Cbor { serializersModule = module }

    if (file.exists()) {
        val res: T
        val time = measureTime {
            val bytes = file.readBytes()
            res = cbor.decodeFromByteArray(serializer, bytes)
        }
        println("Loaded data from $file in $time")
        return res
    } else {
        val data = generateData.invoke()
        val time = measureTime {
            val bytes = cbor.encodeToByteArray(serializer, data)
            file.writeBytes(bytes)
        }
        println("Saved data to $file in $time")
        return data
    }
}
