package fr.sncf.osrd.utils

import java.io.ByteArrayOutputStream
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

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

/** ZIP compression */
fun ByteArray.compressToZip(innerFilename: String): ByteArray {
    val outputStream = ByteArrayOutputStream(this.size)
    ZipOutputStream(outputStream).use {
        val entry = ZipEntry(innerFilename)
        it.putNextEntry(entry)
        it.write(this)
    }
    return outputStream.toByteArray()
}
