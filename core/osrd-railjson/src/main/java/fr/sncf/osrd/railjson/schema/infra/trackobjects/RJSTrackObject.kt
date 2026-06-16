package fr.sncf.osrd.railjson.schema.infra.trackobjects

/** An object on an RJSTrackSection. It's meant to be referenced from the section itself. */
interface RJSTrackObject {
    /** Position from the beginning of the RJSTrackSection */
    val position: Double

    /** RJSTrackSection identifier */
    val track: String
}
