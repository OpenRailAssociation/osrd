package fr.sncf.osrd.utils

fun Long.toGroupedString() = toString().reversed().chunked(3).joinToString("_").reversed()
