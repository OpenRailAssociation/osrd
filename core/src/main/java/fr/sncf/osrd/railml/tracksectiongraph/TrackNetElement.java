package fr.sncf.osrd.railml.tracksectiongraph;

import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import org.dom4j.Element;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class TrackNetElement extends NetElement {
    public final List<NetRelation> beginNetRelation;
    public final List<NetRelation> endNetRelation;

    /** Return the list of NetRelation at the given endpoint */
    public List<NetRelation> getEndpointRelations(EdgeEndpoint endpoint) {
        if (endpoint == EdgeEndpoint.BEGIN)
            return beginNetRelation;
        return endNetRelation;
    }

    /** Representation of a track section */
    public TrackNetElement(
            int index,
            String id,
            Map<String, Double> lrsStartOffsets,
            double length,
            List<NetRelation> beginNetRelation,
            List<NetRelation> endNetRelation) {
        super(index, length, id, lrsStartOffsets);
        this.beginNetRelation = beginNetRelation;
        this.endNetRelation = endNetRelation;
    }

    /** Parse a TrackNetElement from railML */
    public static TrackNetElement parse(
            int index,
            String id,
            Element netElement,
            double length
    ) {
        return new TrackNetElement(
                index,
                id,
                NetElement.parsePositioningSystem(netElement),
                length,
                new ArrayList<>(),
                new ArrayList<>());
    }

    /** Finds a the unique location of the netElement in the given LRS */
    public double resolveSingle(String lrsId, double measure) {
        // if this netElement isn't positioned in this LRS, return an empty list
        var lrsStartOffset = lrsStartOffsets.get(lrsId);
        if (lrsStartOffset == null)
            return Double.NaN;

        // compute the given position in the edge
        double position = measure - lrsStartOffset;

        // return if the given lrs location isn't on the edge
        if (position < 0 || position > length)
            return Double.NaN;

        return position;
    }


    @Override
    public void resolve(SpotLocationCallback callback, String lrsId, double measure) {
        var position = resolveSingle(lrsId, measure);
        if (Double.isNaN(position))
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
