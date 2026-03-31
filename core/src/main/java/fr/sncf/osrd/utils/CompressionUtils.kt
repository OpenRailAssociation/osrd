package fr.sncf.osrd.utils

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonWriter
import java.io.ByteArrayOutputStream
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import okio.buffer
import okio.sink

/** GZIP compression */
fun ByteArray.compress(): ByteArray {
    val outputStream = ByteArrayOutputStream(this.size)
    GZIPOutputStream(outputStream).use { it.write(this) }
    return outputStream.toByteArray()
}

/** GZIP decompression */
fun ByteArray.decompress(): ByteArray {
    return GZIPInputStream(this.inputStream()).use { it.readBytes() }
}

/** GZIP compression of json data, skipping the String intermediate copy. */
fun <T> JsonAdapter<T>.compress(data: T): ByteArray {
    val outputStream = ByteArrayOutputStream()
    GZIPOutputStream(outputStream).use {
        val sink = it.sink().buffer()
        val writer = JsonWriter.of(sink)
        this.toJson(writer, data)
        writer.flush()
    }
    return outputStream.toByteArray()
}
