package fr.sncf.osrd.infra.parsing.railml;

import org.dom4j.Element;
import java.util.Map;

public final class TrackNetElement extends NetElement {
    double length;

    public TrackNetElement(
            String id,
            Map<String, Double> lrsStartOffsets,
            double length
    ) {
        super(id, lrsStartOffsets);
        this.length = length;
    }

    public static TrackNetElement parse(
            String id,
            Element netElement,
            double length
    ) {
        return new TrackNetElement(id, NetElement.parsePositioningSystem(netElement), length);
    }


    @Override
    public void resolve(SpotLocationCallback callback, String lrsId, double measure) {
        // if this netElement isn't positioned in this LRS, return an empty list
        var lrsStartOffset = lrsStartOffsets.get(lrsId);
        if (lrsStartOffset == null)
            return;

        // compute the given position in the edge
        double position = measure - lrsStartOffset;

        // return if the given lrs location isn't on the edge
        if (position < 0 || position > length)
            return;

        // return the location on the edge if it is valid
        callback.acceptLocation(this, position);
    }

    @Override
    public void resolve(RangeLocationCallback callback, String lrsId, double begin, double end) {
        assert begin <= end;

        // if its a micro netElement, check if there is an overlapping lrs range

        // no TopoEdges span this netElement if it's not referenced in this lrs
        var lrsStartOffset = lrsStartOffsets.get(lrsId);
        if (lrsStartOffset == null)
            return;

        // check if the netElement is in the given range
        double positionBegin = begin - lrsStartOffset;
        double positionEnd = end - lrsStartOffset;
        if (positionBegin > length || positionEnd < 0)
            return;

        // clamp
        if (positionBegin < 0)
            positionBegin = 0;
        if (positionEnd > length)
            positionEnd = length;

        callback.acceptLocation(this, positionBegin, positionEnd);
    }
}
