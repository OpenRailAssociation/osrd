package fr.sncf.osrd.railjson.schema.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;

/** This class represents a link between two track sections */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSTrackSectionLink implements Identified {
    public String id;
    public RJSTrackEndpoint src;
    public RJSTrackEndpoint dst;

    /**
     * Create a serialized track section link
     * @param src the beginning of the link
     * @param dst end end of the link
     */
    public RJSTrackSectionLink(
            String id,
            RJSTrackEndpoint src,
            RJSTrackEndpoint dst
    ) {
        this.id = id;
        this.src = src;
        this.dst = dst;
    }

    @Override
    public String getID() {
        return id;
    }
}
