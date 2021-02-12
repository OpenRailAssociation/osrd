package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.util.MutPair;
import fr.sncf.osrd.util.RangeValue;
import fr.sncf.osrd.util.TopoLocation;
import org.dom4j.Node;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

final class NetElement {
    final TrackSection trackSection;
    final ArrayList<NetElement> children;

    /** The start position of the netElement in a set of linear reference systems. */
    final Map<String, Double> lrsStartOffsets;

    NetElement(ArrayList<NetElement> children) {
        this.trackSection = null;
        this.lrsStartOffsets = null;
        this.children = children;
    }

    NetElement(TrackSection edge, Map<String, Double> lrsStartOffsets) {
        this.trackSection = edge;
        this.lrsStartOffsets = lrsStartOffsets;
        this.children = null;
    }

    public static NetElement parseMacroOrMeso(Node netElement, Map<String, NetElement> netElementMap) {
        return new NetElement(parseChildren(netElement, netElementMap));
    }

    public static NetElement parseMicro(Node netElement, TrackSection trackSection) {
        var lrsStartOffsets = parseLrs(netElement);
        return new NetElement(trackSection, lrsStartOffsets);
    }

    private static ArrayList<NetElement> parseChildren(Node netElement, Map<String, NetElement> netElementMap) {
        var children = new ArrayList<NetElement>();
        for (var elementPart : netElement.selectNodes("elementCollectionUnordered/elementPart")) {
            var ref = elementPart.valueOf("@ref");
            children.add(netElementMap.get(ref));
        }
        return children;
    }

    private static Map<String, Double> parseLrs(Node netElement) {
        var lrsMap = new HashMap<String, MutPair<Double, Double>>();

        for (var intrinsicCoordinate: netElement.selectNodes("associatedPositioningSystem/intrinsicCoordinate")) {
            var intrinsicCoord = NetRelation.coordParse(intrinsicCoordinate.valueOf("@intrinsicCoord"));
            var positioningSystemRef = intrinsicCoordinate.valueOf("linearCoordinate/@positioningSystemRef");
            if (positioningSystemRef.isEmpty())
                continue;
            var measure = Double.valueOf(intrinsicCoordinate.valueOf("linearCoordinate/@measure"));
            lrsMap.putIfAbsent(positioningSystemRef, new MutPair<>(Double.NaN, Double.NaN));
            if (intrinsicCoord == EdgeEndpoint.START)
                lrsMap.get(positioningSystemRef).first = measure;
            else
                lrsMap.get(positioningSystemRef).second = measure;
        }

        var lrsStartOffsets = new HashMap<String, Double>();
        for (var entry : lrsMap.entrySet()) {
            var range = entry.getValue();
            lrsStartOffsets.put(entry.getKey(), range.first);
        }
        return lrsStartOffsets;
    }

    /**
     * Given a location in a linear positioning system, yields a locations on TopoEdges this maps to.
     * @param lrsId identifier of the linear positioning system
     * @param measure position in the lrs / lps
     * @return a list of positions in TrackSection (TopoLocation) under this netElement.
     */
    public ArrayList<TopoLocation> mapToTopo(String lrsId, double measure) {
        var list = new ArrayList<TopoLocation>();

        // if it's a macro / meso netElement, get the children's TopoEdges
        if (trackSection == null) {
            for (var child : children)
                list.addAll(child.mapToTopo(lrsId, measure));
            return list;
        }

        // if this netElement isn't positioned in this LRS, return an empty list
        var lrsStartOffset = lrsStartOffsets.get(lrsId);
        if (lrsStartOffset == null)
            return list;

        // compute the given position in the edge
        double position = measure - lrsStartOffset;

        // return if the given lrs location isn't on the edge
        if (position < 0 || position > trackSection.length)
            return list;

        // return the location on the edge if it is valid
        list.add(new TopoLocation(trackSection, position));
        return list;
    }

    /**
     * Given a linear positioning system and a range, yields a list of edges TrackSection this spans on.
     * @param lrsId identifier of the linear positioning system
     * @param begin the range start
     * @param end the range end
     * @return a list of range on edges this lrs range spans on under this netElement.
     */
    public ArrayList<RangeValue<TrackSection>> mapToTopo(String lrsId, double begin, double end) {
        assert begin <= end;
        var list = new ArrayList<RangeValue<TrackSection>>();
        // if it's a macro / meso netElement, get the TopoEdges the child netElements span onto
        if (trackSection == null) {
            for (var child : children)
                list.addAll(child.mapToTopo(lrsId, begin, end));
            return list;
        }

        // if its a micro netElement, check if there is an overlapping lrs range

        // no TopoEdges span this netElement if it's not referenced in this lrs
        var lrsStartOffset = lrsStartOffsets.get(lrsId);
        if (lrsStartOffset == null)
            return list;

        // check if the netElement is in the given range
        double positionBegin = begin - lrsStartOffset;
        double positionEnd = end - lrsStartOffset;
        if (positionBegin > trackSection.length || positionEnd < 0)
            return list;

        // clamp
        if (positionBegin < 0)
            positionBegin = 0;
        if (positionEnd > trackSection.length)
            positionEnd = trackSection.length;

        list.add(new RangeValue<>(positionBegin, positionEnd, trackSection));
        return list;
    }
}
