package fr.sncf.osrd.railjson.schema.common.graph

/** Encodes an end, an endpoint, the tip of an edge. */
enum class EdgeEndpoint(val id: Int) {
    BEGIN(0),
    END(1),
}
