package fr.sncf.osrd.infra.parsing.railjson.schema;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSTrackSectionLink {
    public final ApplicableDirections navigability;
    public final RJSTrackSection.EndpointID begin;
    public final RJSTrackSection.EndpointID end;

    /**
     * Create a serialized track section link
     * @param navigability how this link can be used
     * @param begin the beginning of the link
     * @param end end end of the link
     */
    public RJSTrackSectionLink(
            ApplicableDirections navigability,
            RJSTrackSection.EndpointID begin,
            RJSTrackSection.EndpointID end
    ) {
        this.navigability = navigability;
        this.begin = begin;
        this.end = end;
    }
}
