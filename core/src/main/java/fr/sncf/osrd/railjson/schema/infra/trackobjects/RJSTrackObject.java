package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

/** An object on a RJSTrackSection. It's meant to be referenced from the section itself. */
@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSTrackObject {
    /** Position from the beginning of the RJSTrackSection */
    public double position;
    public RJSObjectRef<RJSTrackSection> track;
}
