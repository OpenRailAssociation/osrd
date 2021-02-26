package fr.sncf.osrd.railml;

import org.dom4j.Element;
import org.dom4j.Node;

import java.util.ArrayList;
import java.util.Map;

public final class GroupNetElement extends NetElement {
    final ArrayList<NetElement> children;

    public GroupNetElement(
            String id,
            Map<String, Double> lrsMap,
            ArrayList<NetElement> children
    ) {
        super(-1, Double.NaN, id, lrsMap);
        this.children = children;
    }

    static GroupNetElement parse(String id, Element netElement, Map<String, NetElement> netElements) {
        return new GroupNetElement(
                id,
                NetElement.parsePositioningSystem(netElement),
                parseChildren(netElement, netElements)
        );
    }

    private static ArrayList<NetElement> parseChildren(Node netElement, Map<String, NetElement> netElementMap) {
        var children = new ArrayList<NetElement>();
        for (var elementPartNode : netElement.selectNodes("elementCollectionUnordered/elementPart")) {
            var elementPart = (Element) elementPartNode;
            var ref = elementPart.attributeValue("ref");
            children.add(netElementMap.get(ref));
        }
        return children;
    }

    @Override
    public void resolve(SpotLocationCallback callback, String lrsId, double measure) {
        for (var child : children)
            child.resolve(callback, lrsId, measure);
    }

    @Override
    public void resolve(RangeLocationCallback callback, String lrsId, double begin, double end) {
        for (var child : children)
            child.resolve(callback, lrsId, begin, end);
    }
}
