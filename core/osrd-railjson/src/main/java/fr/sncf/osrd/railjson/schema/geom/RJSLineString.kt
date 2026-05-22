package fr.sncf.osrd.railjson.schema.geom

class RJSLineString(var type: String, var coordinates: List<List<Double>>) {
    companion object {
        /** Instantiates a line string from xs and ys coordinates */
        fun make(xs: List<Double>, ys: List<Double>): RJSLineString {
            assert(xs.size == ys.size)
            val res = mutableListOf<List<Double>>()
            for (i in xs.indices) {
                res.add(listOf(xs.get(i), ys.get(i)))
            }
            return RJSLineString("LineString", res)
        }
    }
}
