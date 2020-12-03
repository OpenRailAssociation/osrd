package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.topological.NoOpNode;
import fr.sncf.osrd.infra.topological.StopBlock;
import fr.sncf.osrd.infra.topological.Switch;
import fr.sncf.osrd.util.*;
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
    private int numberOfComponents = 0;
    private final ArrayList<Integer> componentIndexes = new ArrayList<>();
    private final Map<String, DescriptionLevel> levels = new HashMap<>();

    public RailMLParser(String inputPath) {
        this.inputPath = inputPath;
    }

    /**
     * Initialises a new infrastructure from a RailML file.
     * @return the parsed infrastructure
     */
    public Infra parse() throws InvalidInfraException {
        Document document;
        try {
            document = new SAXReader().read(inputPath);
        } catch (DocumentException e) {
            e.printStackTrace();
            return null;
        }
        document.accept(new XmlNamespaceCleaner());

        parseNetworks(document);
        parseNetRelations(document);
        detectNodes();

        var infra = new Infra();
        infra.topoGraph.resizeNodes(numberOfComponents);

        parseNetElements(document, infra);

        parseBufferStops(document, infra);
        parseSwitchIS(document, infra);
        fillWithNoOpNode(infra);

        parseOperationalPoint(document, infra);
        parseSpeedSection(document);

        return infra;
    }

    private void parseNetworks(Document document) {
        for (var level : document.selectNodes("/railML/infrastructure/topology/networks/network/level")) {
            var descriptionLevel = DescriptionLevel.getValue(level.valueOf("@descriptionLevel"));
            for (var networkResource : level.selectNodes("networkResource")) {
                levels.put(networkResource.valueOf("@ref"), descriptionLevel);
            }
        }
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
                // go up the parenthood chain for both components
                while (tmpComponents.get(componentA) != -1)
                    componentA = tmpComponents.get(componentA);

                while (tmpComponents.get(componentB) != -1)
                    componentB = tmpComponents.get(componentB);

                // merge the root components
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

        numberOfComponents = 0;
        // assign unique identifier to connected components
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
            if (rootIndex == i)
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
            if (levels.get(id) != DescriptionLevel.MICRO)
                continue;

            var positionOnA = netRelation.valueOf("@positionOnA");
            assert positionOnA.equals("0") || positionOnA.equals("1");
            var elementA = netRelation.valueOf("elementA/@ref");

            var positionOnB = netRelation.valueOf("@positionOnB");
            assert positionOnB.equals("0") || positionOnB.equals("1");
            var elementB = netRelation.valueOf("elementB/@ref");

            netRelationsMap.put(id, new NetRelation(id, positionOnA, elementA, positionOnB, elementB));
        }
    }

    private int getNodeIndex(String netElementId, boolean atZero, Infra infra) {
        int index = neComponents.getOrDefault(new Pair<>(netElementId, atZero), -1);
        if (index != -1)
            return componentIndexes.get(index);
        componentIndexes.add(numberOfComponents);
        ++numberOfComponents;
        infra.topoGraph.resizeNodes(numberOfComponents);
        return componentIndexes.size() - 1;
    }

    private void parseNetElements(Document document, Infra infra) {
        var xpath = "/railML/infrastructure/topology/netElements/netElement";
        var netElements = document.selectNodes(xpath);
        for (var netElement : netElements) {
            var id = netElement.valueOf("@id");
            if (levels.get(id) != DescriptionLevel.MICRO)
                continue;

            var lengthStr = netElement.valueOf("@length");
            double length = Double.parseDouble(lengthStr);
            int startNodeIndex = getNodeIndex(id, true, infra);
            int endNodeIndex = getNodeIndex(id, false, infra);
            var topoEdge = infra.makeTopoLink(startNodeIndex, endNodeIndex, id, length);
            netElementMap.put(id, new NetElement(topoEdge, netElement));
        }

        for (var netElement : netElements) {
            var id = netElement.valueOf("@id");
            if (levels.get(id) != DescriptionLevel.MESO)
                continue;
            netElementMap.put(id, new NetElement(netElement, netElementMap));
        }

        for (var netElement : netElements) {
            var id = netElement.valueOf("@id");
            if (levels.get(id) != DescriptionLevel.MACRO)
                continue;
            netElementMap.put(id, new NetElement(netElement, netElementMap));
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
                infra.topoGraph.replaceNode(topoEdge.startNode, stopBlock);
            else
                infra.topoGraph.replaceNode(topoEdge.endNode, stopBlock);
        }
    }

    private void parseSwitchIS(Document document, Infra infra) {
        var xpath = "/railML/infrastructure/functionalInfrastructure/switchesIS/switchIS";
        for (var switchIS :  document.selectNodes(xpath)) {
            var id = switchIS.valueOf("@id");
            var pos = Double.valueOf(switchIS.valueOf("spotLocation/@pos"));
            var netElementRef = switchIS.valueOf("spotLocation/@netElementRef");
            var topoEdge = infra.topoEdgeMap.get(netElementRef);
            assert FloatCompare.eq(pos, 0.0) || FloatCompare.eq(pos, topoEdge.length);

            Switch switchObj = new Switch(id);
            if (FloatCompare.eq(pos, 0.0))
                infra.topoGraph.replaceNode(topoEdge.startNode, switchObj);
            else
                infra.topoGraph.replaceNode(topoEdge.endNode, switchObj);
        }
    }

    private void fillWithNoOpNode(Infra infra) {
        var graph = infra.topoGraph;
        for (var edge : graph.edges) {
            if (graph.nodes.get(edge.startNode) == null) {
                var noOp = new NoOpNode(String.valueOf(edge.startNode));
                infra.topoGraph.replaceNode(edge.startNode, noOp);
            }
            if (graph.nodes.get(edge.endNode) == null) {
                var noOp = new NoOpNode(String.valueOf(edge.endNode));
                infra.topoGraph.replaceNode(edge.endNode, noOp);
            }
        }
    }


    private void parseOperationalPoint(Document document, Infra infra) {
        var xpath = "/railML/infrastructure/functionalInfrastructure/operationalPoints/operationalPoint";

        Map<String, PointSequence.Builder<OperationalPoint>> builders = new HashMap<>();

        for (var operationalPoint : document.selectNodes(xpath)) {
            var id = operationalPoint.valueOf("@id");
            var name = operationalPoint.valueOf("name/@name");
            var netElementRef = operationalPoint.valueOf("spotLocation/@netElementRef");
            var netElement = netElementMap.get(netElementRef);
            var lrsId = operationalPoint.valueOf("spotLocation/linearCoordinate/@positioningSystemRef");
            var measure = Double.valueOf(operationalPoint.valueOf("spotLocation/linearCoordinate/@measure"));

            var locations = netElement.placeOn(lrsId, measure);
            OperationalPoint opObj = new OperationalPoint(id, name);
            infra.register(opObj);
            for (var location : locations) {
                builders.putIfAbsent(location.edge.id, location.edge.operationalPoints.builder());
                var builder = builders.get(location.edge.id);
                builder.add(location.position, opObj);
            }
        }

        for (var builder : builders.values()) {
            builder.build();
        }
    }

    private void parseSpeedSection(Document document) throws InvalidInfraException {
        Map<Pair<String, Boolean>, RangeSequence.Builder<Double>> builders = new HashMap<>();

        var xpath = "/railML/infrastructure/functionalInfrastructure/speed/speedSection";
        for (var speedSection : document.selectNodes(xpath)) {
            var speed = Double.valueOf(speedSection.valueOf("@maxSpeed"));
            for (var associatedNetElement : speedSection.selectNodes("linearLocation/associatedNetElement")) {
                var netElementRef = associatedNetElement.valueOf("@netElementRef");
                var measureBegin = Double.valueOf(associatedNetElement.valueOf("linearCoordinateBegin/@measure"));
                var lrsBegin = associatedNetElement.valueOf("linearCoordinateBegin/@positioningSystemRef");
                var measureEnd = Double.valueOf(associatedNetElement.valueOf("linearCoordinateEnd/@measure"));
                var lrsEnd = associatedNetElement.valueOf("linearCoordinateEnd/@positioningSystemRef");

                assert lrsBegin.equals(lrsEnd);

                var netElement = netElementMap.get(netElementRef);
                for (var place : netElement.placeOn(lrsBegin, measureBegin, measureEnd)) {
                    var forward = new Pair<>(place.value.id, true);
                    builders.putIfAbsent(forward, netElement.topoEdge.speedLimitsForward.builder());
                    builders.get(forward).add(place.begin, place.end, speed);

                    var backward = new Pair<>(place.value.id, false);
                    builders.putIfAbsent(backward, netElement.topoEdge.speedLimitsBackward.builder());
                    builders.get(backward).add(place.begin, place.end, speed);
                }
            }
        }

        for (var builder : builders.values()) {
            builder.build();
        }
    }
}
