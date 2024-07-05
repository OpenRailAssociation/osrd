package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.reporting.exceptions.OSRDError

sealed interface SigField {
    val name: String
    val hasDefault: Boolean
    val encodedDefault: Int

    fun encode(value: String): Int

    fun decode(data: Int): String
}

data class SigEnumField(override val name: String, val values: List<String>, val default: String?) :
    SigField {
    override val hasDefault
        get() = default != null

    override val encodedDefault
        get() = encode(default!!)

    override fun encode(value: String): Int {
        val index = values.indexOf(value)
        if (index == -1) throw OSRDError.newSigSchemaUnknownFieldError(value)
        return index
    }

    override fun decode(data: Int): String {
        return values[data]
    }
}

data class SigFlagField(override val name: String, val default: Boolean?) : SigField {
    override val hasDefault
        get() = default != null

    override val encodedDefault
        get() = encodeBool(default!!)

    private fun encodeBool(value: Boolean): Int {
        return when (value) {
            true -> 1
            false -> 0
        }
    }

    fun decodeBool(value: Int): Boolean {
        return when (value) {
            1 -> true
            0 -> false
            else -> throw OSRDError.newSigSchemaInvalidFieldError(value, "expected true or false")
        }
    }

    override fun encode(value: String): Int {
        return encodeBool(
            when (value) {
                "true" -> true
                "false" -> false
                else ->
                    throw OSRDError.newSigSchemaInvalidFieldError(value, "expected true or false")
            }
        )
    }

    override fun decode(data: Int): String {
        if (data == 0) return "false"
        return "true"
    }
}

private fun sigSchemaFields(init: SigSchemaBuilder.() -> Unit): List<SigField> {
    val res = mutableListOf<SigField>()
    val builder =
        object : SigSchemaBuilder {
            override fun enum(name: String, values: List<String>, default: String?) {
                res.add(SigEnumField(name, values, default))
            }

            override fun flag(name: String, default: Boolean?) {
                res.add(SigFlagField(name, default))
            }
        }
    builder.init()
    return res
}

class SigSchema<MarkerT>(
    /** A list of fields, sorted by name */
    fields: List<SigField>,
) {
    val sortedFields = fields.sortedBy { it.name }
    val fields
        get() = sortedFields

    private val fieldIndexMap: Map<String, Int>

    constructor(init: SigSchemaBuilder.() -> Unit) : this(sigSchemaFields(init))

    init {
        val newMap = mutableMapOf<String, Int>()
        for (i in sortedFields.indices) newMap[sortedFields[i].name] = i
        fieldIndexMap = newMap
    }

    fun find(fieldName: String): Int {
        return fieldIndexMap[fieldName] ?: -1
    }

    operator fun invoke(init: SigDataBuilder.() -> Unit): SigData<MarkerT> {
        val initializedFields = BooleanArray(sortedFields.size)
        val data = IntArray(sortedFields.size)

        val builder =
            object : SigDataBuilder {
                override fun value(name: String, value: String) {
                    val fieldIndex =
                        fieldIndexMap[name] ?: throw OSRDError.newSigSchemaUnknownFieldError(name)
                    val field = sortedFields[fieldIndex]
                    data[fieldIndex] = field.encode(value)
                    initializedFields[fieldIndex] = true
                }
            }
        builder.init()

        for (fieldIndex in sortedFields.indices) {
            if (initializedFields[fieldIndex]) continue
            val field = sortedFields[fieldIndex]
            if (!field.hasDefault)
                throw OSRDError.newSigSchemaInvalidFieldError(field.name, "uninitialized field")
            data[fieldIndex] = field.encodedDefault
        }
        return SigData(this, data)
    }

    operator fun invoke(values: Map<String, String>): SigData<MarkerT> {
        return this { for (entry in values.entries) value(entry.key, entry.value) }
    }
}

interface SigSchemaBuilder {
    fun enum(name: String, values: List<String>, default: String?)

    fun flag(name: String, default: Boolean?)

    fun flag(name: String) {
        flag(name, null)
    }

    fun enum(name: String, values: List<String>) {
        enum(name, values, null)
    }
}

interface SigDataBuilder {
    fun value(name: String, value: String)
}

data class SigData<MarkerT>(val schema: SigSchema<MarkerT>, private val data: IntArray) {
    fun getFlag(fieldName: String): Boolean {
        val fieldIndex = schema.find(fieldName)
        if (fieldIndex == -1) throw OSRDError.newSigSchemaUnknownFieldError(fieldName)
        val field = schema.sortedFields[fieldIndex]
        if (field !is SigFlagField)
            throw OSRDError.newSigSchemaInvalidFieldError(fieldName, "expected a flag")
        return field.decodeBool(data[fieldIndex])
    }

    fun getEnum(fieldName: String): String {
        val fieldIndex = schema.find(fieldName)
        if (fieldIndex == -1) throw OSRDError.newSigSchemaUnknownFieldError(fieldName)
        val field = schema.sortedFields[fieldIndex]
        if (field !is SigEnumField)
            throw OSRDError.newSigSchemaInvalidFieldError(fieldName, "expected an enum")
        return field.decode(data[fieldIndex])
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as SigData<*>

        if (schema != other.schema) return false
        if (!data.contentEquals(other.data)) return false
        return true
    }

    override fun hashCode(): Int {
        var result = schema.hashCode()
        result = 31 * result + data.contentHashCode()
        return result
    }
}
