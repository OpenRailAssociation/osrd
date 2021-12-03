package fr.sncf.osrd.railjson.schema.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

/** This class represents a link between two track sections */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSTrackSectionLink implements Identified {
    /** The navigability between the two track sections. In most cases it's BOTH way. */
    public String id;
    public ApplicableDirection navigability;
    public RJSTrackEndpoint src;
    public RJSTrackEndpoint dst;

    /**
     * Create a serialized track section link
     * @param navigability how this link can be used
     * @param src the beginning of the link
     * @param dst end end of the link
     */
    public RJSTrackSectionLink(
            String id,
            ApplicableDirection navigability,
            RJSTrackEndpoint src,
            RJSTrackEndpoint dst
    ) {
        this.id = id;
        this.navigability = navigability;
        this.src = src;
        this.dst = dst;
    }

    @Override
    public String getID() {
        return id;
    }
}
