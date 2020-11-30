package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.topological.StopBlock;
import fr.sncf.osrd.util.FloatCompare;
import fr.sncf.osrd.util.Pair;
import fr.sncf.osrd.util.XmlNamespaceCleaner;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.io.SAXReader;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class RailMLParser {
    private final String inputPath;
    private final Map<String, NetRelation> netRelationsMap = new HashMap<>();
    private final Map<String, NetElement> netElementMap = new HashMap<>();
    /* a map from each end of each net element to a component */
    private final Map<Pair<String, Boolean>, Integer> neComponents = new HashMap<>();
    private final ArrayList<Integer> componentIndexes = new ArrayList<>();

    public RailMLParser(String inputPath) {
        this.inputPath = inputPath;
    }

    /**
     * Initialises a new infrastructure from a RailML file.
     * @return the parsed infrastructure
     */
    public Infra parse() {
        Document document = null;
        try {
            document = new SAXReader().read(inputPath);
        } catch (DocumentException e) {
            e.printStackTrace();
            return null;
        }
        document.accept(new XmlNamespaceCleaner());

        parseNetRelations(document);
        detectNodes();

        var infra = new Infra();
        parseNetElements(document, infra);
        parseBufferStops(document, infra);
        return infra;
    }

    private void detectNodes() {
        /* a parenthood map of connected components */
        ArrayList<Integer> tmpComponents = new ArrayList<>();
        for (var netRelation : netRelationsMap.values()) {
            var keyA = new Pair<>(netRelation.elementA, netRelation.atZeroOnA);
            var keyB = new Pair<>(netRelation.elementB, netRelation.atZeroOnB);
            int componentA = neComponents.getOrDefault(keyA, -1);
            int componentB = neComponents.getOrDefault(keyB, -1);
            if (componentA == -1 && componentB == -1) {
                var newComponent = tmpComponents.size();
                // -1 means no parent
                tmpComponents.add(-1);
                neComponents.put(keyA, newComponent);
                neComponents.put(keyB, newComponent);
            } else if (componentA == -1) {
                neComponents.put(keyA, componentB);
            } else if (componentB == -1) {
                neComponents.put(keyB, componentA);
            } else {
                if (componentB < componentA)
                    tmpComponents.set(componentA, componentB);
                else
                    tmpComponents.set(componentB, componentA);
            }
        }

        // resolve the chain of merged components
        for (int i = 0; i < tmpComponents.size(); i++) {
            int rootComponent = i;
            while (tmpComponents.get(rootComponent) != -1)
                rootComponent = tmpComponents.get(rootComponent);
            tmpComponents.set(i, rootComponent);
        }

        // assign unique identifier to connected components
        int numberOfComponents = 0;
        for (int i = 0; i < tmpComponents.size(); i++) {
            // if the component is a root, assign a number
            if (tmpComponents.get(i) == i) {
                componentIndexes.add(numberOfComponents);
                numberOfComponents++;
            } else {
                componentIndexes.add(-1);
            }
        }

        // link the intermediate components to their root component
        for (int i = 0; i < tmpComponents.size(); i++) {
            var rootIndex = tmpComponents.get(i);
            if (rootIndex == -1)
                continue;
            var newRootIndex = componentIndexes.get(rootIndex);
            componentIndexes.set(i, newRootIndex);
        }

        // at this point:
        //  - numberOfComponents contains the number of connected components
        //  - componentIndexes.get(neComponents.get(...)) gets the component index for some network element endpoint
    }

    private void parseNetRelations(Document document) {
        for (var netRelation : document.selectNodes("/railML/infrastructure/topology/netRelations/netRelation")) {
            var navigability = netRelation.valueOf("@navigability");
            assert navigability.equals("None") || navigability.equals("Both");
            if (navigability.equals("None"))
                continue;

            var id = netRelation.valueOf("@id");

            var positionOnA = netRelation.valueOf("@positionOnA");
            assert positionOnA.equals("0") || positionOnA.equals("1");
            var elementA = netRelation.valueOf("elementA/@ref");

            var positionOnB = netRelation.valueOf("@positionOnB");
            assert positionOnB.equals("0") || positionOnB.equals("1");
            var elementB = netRelation.valueOf("elementB/@ref");

            netRelationsMap.put(id, new NetRelation(id, positionOnA, elementA, positionOnB, elementB));
        }
    }

    private int getNodeIndex(String netElementId, boolean atZero) {
        int index = neComponents.getOrDefault(new Pair<>(netElementId, atZero), -1);
        if (index != -1)
            return componentIndexes.get(index);
        componentIndexes.add(componentIndexes.size());
        return componentIndexes.size() - 1;
    }

    private void parseNetElements(Document document, Infra infra) {
        var xpath = "/railML/infrastructure/topology/netElements/netElement";
        for (var netElement : document.selectNodes(xpath)) {
            var lengthStr = netElement.valueOf("@length");
            if (lengthStr.isEmpty())
                continue;

            double length = Double.parseDouble(lengthStr);
            var id = netElement.valueOf("@id");

            int startNodeIndex = getNodeIndex(id, true);
            int endNodeIndex = getNodeIndex(id, false);
            var topoEdge = infra.makeTopoLink(startNodeIndex, endNodeIndex, id, length);
            netElementMap.put(id, new NetElement(topoEdge, netElement));
        }
    }

    private void parseBufferStops(Document document, Infra infra) {
        var xpath = "/railML/infrastructure/functionalInfrastructure/bufferStops/bufferStop";
        for (var bufferStop : document.selectNodes(xpath)) {
            var id = bufferStop.valueOf("@id");
            var netElementId = bufferStop.valueOf("spotLocation/@netElementRef");
            var pos = Double.valueOf(bufferStop.valueOf("spotLocation/@pos"));

            var topoEdge = infra.topoEdgeMap.get(netElementId);
            assert FloatCompare.eq(pos, 0.0) || FloatCompare.eq(pos, topoEdge.length);

            StopBlock stopBlock = new StopBlock(id, topoEdge);
            if (FloatCompare.eq(pos, 0.0))
                stopBlock.setIndex(topoEdge.startNode);
            else
                stopBlock.setIndex(topoEdge.endNode);
        }
    }
}
