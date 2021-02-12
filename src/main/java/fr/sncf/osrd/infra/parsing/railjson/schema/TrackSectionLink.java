package fr.sncf.osrd.infra.parsing.railjson.schema;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class TrackSectionLink {
    public final Navigability navigability;
    public final TrackSection.EndpointID begin;
    public final TrackSection.EndpointID end;

    /**
     * Create a serialized track section link
     * @param navigability how this link can be used
     * @param begin the beginning of the link
     * @param end end end of the link
     */
    public TrackSectionLink(
            Navigability navigability,
            TrackSection.EndpointID begin,
            TrackSection.EndpointID end
    ) {
        this.navigability = navigability;
        this.begin = begin;
        this.end = end;
    }
}
