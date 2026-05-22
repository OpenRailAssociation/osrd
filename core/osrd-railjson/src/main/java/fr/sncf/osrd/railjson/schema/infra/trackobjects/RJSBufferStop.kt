package fr.sncf.osrd.railjson.schema.infra.trackobjects

class RJSBufferStop(
    override val id: String,
    override val position: Double,
    override val track: String,
) : RJSRouteWaypoint
