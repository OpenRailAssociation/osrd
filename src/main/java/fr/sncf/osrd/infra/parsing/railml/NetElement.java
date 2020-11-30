package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.util.FloatCompare;
import fr.sncf.osrd.util.MutPair;
import org.dom4j.Node;

import java.util.HashMap;
import java.util.Map;

class NetElement {
    final TopoEdge topoEdge;
    final Map<String, Double> lrsDeltas = new HashMap<>();

    NetElement(TopoEdge topoEdge, Node netElement) {
        this.topoEdge = topoEdge;

        var lrsMap = new HashMap<String, MutPair<Double, Double>>();

        for (var intrinsicCoordinate: netElement.selectNodes("associatedPositioningSystem/intrinsicCoordinate")) {
            var intrinsicCoord = Double.valueOf(intrinsicCoordinate.valueOf("@intrinsicCoord"));
            assert FloatCompare.eq(intrinsicCoord, 0) || FloatCompare.eq(intrinsicCoord, 1);
            var positioningSystemRef = intrinsicCoordinate.valueOf("linearCoordinate/@positioningSystemRef");
            if (positioningSystemRef.isEmpty())
                continue;
            var measure = Double.valueOf(intrinsicCoordinate.valueOf("linearCoordinate/@measure"));
            lrsMap.putIfAbsent(positioningSystemRef, new MutPair<>(Double.NaN, Double.NaN));
            if (FloatCompare.eq(intrinsicCoord, 0))
                lrsMap.get(positioningSystemRef).first = measure;
            else
                lrsMap.get(positioningSystemRef).second = measure;
        }

        for (var entry : lrsMap.entrySet()) {
            var range = entry.getValue();
            assert FloatCompare.eq(range.second - range.first, topoEdge.length);
            lrsDeltas.put(entry.getKey(), range.first);
        }
    }
}
