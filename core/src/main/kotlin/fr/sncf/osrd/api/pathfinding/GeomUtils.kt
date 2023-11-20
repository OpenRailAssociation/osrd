package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.railjson.schema.geom.RJSLineString

fun toRJSLineString(lineString: LineString): RJSLineString {
    val coordinates = ArrayList<List<Double>>()
    for (p in lineString.points)
        coordinates.add(listOf(p.x, p.y))
    return RJSLineString("LineString", coordinates)
}
