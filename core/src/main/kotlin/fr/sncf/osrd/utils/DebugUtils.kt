package fr.sncf.osrd.utils

import java.io.BufferedWriter
import java.io.File

/** Small utility class to log values in a csv */
class CSVLogger(filename: String, private val keys: List<String>) {
    private val writer: BufferedWriter = File(filename).bufferedWriter()

    init {
        writer.write(keys.joinToString(";") + "\n")
    }

    /** Log the given entries to the CSV. All keys must appear in the object keys. */
    fun log(entries: Map<String, Any>) {
        assert(entries.keys.all { keys.contains(it) })
        val line = keys.joinToString(separator = ";") { entries.getOrDefault(it, "").toString() }
        writer.write(line + "\n")
    }
}
