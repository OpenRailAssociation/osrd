package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.SpeedSection;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.topological.NoOpNode;
import fr.sncf.osrd.infra.topological.StopBlock;
import fr.sncf.osrd.infra.topological.Switch;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.util.*;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.Node;
import org.dom4j.io.SAXReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public final class RailMLParser {
    static final Logger logger = LoggerFactory.getLogger(RailMLParser.class);

    private final String inputPath;
    /* a map from each end of each net element to a per edge end unique identifier */
    private final Map<Pair<String, EdgeEndpoint>, Integer> edgeEndpointIDs = new HashMap<>();
    private int numberOfNodes = 0;
    /* a map from edge endpoints ID to node ID*/
    private final ArrayList<Integer> edgeEndpointToNode = new ArrayList<>();

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

        // parse the description level of netElements
        var descLevels = parseNetworks(document);

        // parse all net relations in the document (relations between pieces of track)
        var netRelations = parseNetRelations(descLevels, document);

        // deduce the nodes from net relations
        // TODO: move away from class attributes
        detectNodes(netRelations);

        var infra = new Infra();
        infra.topoGraph.resizeNodes(numberOfNodes);

        // parse pieces of track
        final var netElementMap = parseNetElements(descLevels, document, infra);

        // we need to connect the TopoEdges as instructed by the netRelations, otherwise pathfinding wont work
        // (we would have pieces of track connecting nodes, but no way to move from track to track)
        for (var netRelation : netRelations.values()) {
            var netElementA = netElementMap.get(netRelation.elementA);
            var netElementB = netElementMap.get(netRelation.elementB);
            var edgeA = netElementA.topoEdge;
            var edgeB = netElementB.topoEdge;
            // both netElements must be micro
            if (edgeA == null || edgeB == null)
                continue;

            TopoEdge.linkEdges(edgeA, netRelation.positionOnA, edgeB, netRelation.positionOnB);
        }

        parseBufferStops(document, infra);
        parseSwitchIS(document, infra);
        fillWithNoOpNode(infra);

        parseOperationalPoint(netElementMap, document, infra);
        parseSpeedSection(netElementMap, document);

        return infra;
    }

    private Map<String, DescriptionLevel> parseNetworks(Document document) {
        var descLevels = new HashMap<String, DescriptionLevel>();
        for (var level : document.selectNodes("/railML/infrastructure/topology/networks/network/level")) {
            var descriptionLevel = DescriptionLevel.getValue(level.valueOf("@descriptionLevel"));
            for (var networkResource : level.selectNodes("networkResource")) {
                descLevels.put(networkResource.valueOf("@ref"), descriptionLevel);
            }
        }
        return descLevels;
    }

    private void detectNodes(Map<String, NetRelation> netRelations) {
        /* a parenthood map of connected components */
        var uf = new UnionFind();
        for (var netRelation : netRelations.values()) {
            var keyA = new Pair<>(netRelation.elementA, netRelation.positionOnA);
            var keyB = new Pair<>(netRelation.elementB, netRelation.positionOnB);
            // get the group ID, or create one if none is found
            int groupA = edgeEndpointIDs.getOrDefault(keyA, -1);
            if (groupA == -1) {
                groupA = uf.newGroup();
                edgeEndpointIDs.put(keyA, groupA);
            }

            int groupB = edgeEndpointIDs.getOrDefault(keyB, -1);
            if (groupB == -1) {
                groupB = uf.newGroup();
                edgeEndpointIDs.put(keyB, groupB);
            }

            uf.union(groupA, groupB);
        }

        edgeEndpointToNode.clear();
        numberOfNodes = uf.minimize(edgeEndpointToNode);

        // at this point:
        //  - numberOfNodes contains the number of connected components
        //  - componentIndexes.get(neComponents.get(...)) gets the component index for some network element endpoint
    }

    private Map<String, NetRelation> parseNetRelations(Map<String, DescriptionLevel> descLevels, Document document) {
        var netRelations = new HashMap<String, NetRelation>();

        for (var netRelation : document.selectNodes("/railML/infrastructure/topology/netRelations/netRelation")) {
            var navigability = netRelation.valueOf("@navigability");
            assert navigability.equals("None") || navigability.equals("Both");
            if (navigability.equals("None"))
                continue;

            var id = netRelation.valueOf("@id");
            if (descLevels.get(id) != DescriptionLevel.MICRO)
                continue;

            var positionOnA = netRelation.valueOf("@positionOnA");
            var elementA = netRelation.valueOf("elementA/@ref");

            var positionOnB = netRelation.valueOf("@positionOnB");
            var elementB = netRelation.valueOf("elementB/@ref");

            netRelations.put(id, new NetRelation(id, positionOnA, elementA, positionOnB, elementB));
        }
        return netRelations;
    }

    private int getNodeIndex(String netElementId, EdgeEndpoint position, Infra infra) {
        var key = new Pair<>(netElementId, position);
        int index = edgeEndpointIDs.getOrDefault(key, -1);
        if (index != -1)
            return edgeEndpointToNode.get(index);

        var newNodeId = numberOfNodes;
        edgeEndpointIDs.put(key, edgeEndpointToNode.size());
        edgeEndpointToNode.add(newNodeId);
        ++numberOfNodes;
        infra.topoGraph.resizeNodes(numberOfNodes);
        return newNodeId;
    }

    /**
     * Parse pieces of tracks, linking those to nodes.
     * Nodes were detected using a connected component algorithm.
     */
    private Map<String, NetElement> parseNetElements(
            Map<String, DescriptionLevel> descLevels,
            Document document,
            Infra infra
    ) {
        var netElementMap = new HashMap<String, NetElement>();
        var xpath = "/railML/infrastructure/topology/netElements/netElement";
        var netElements = document.selectNodes(xpath);

        for (var netElement : netElements) {
            var id = netElement.valueOf("@id");
            if (descLevels.get(id) != DescriptionLevel.MICRO)
                continue;

            // create the edge corresponding to the track section
            var lengthStr = netElement.valueOf("@length");
            double length = Double.parseDouble(lengthStr);
            int startNodeIndex = getNodeIndex(id, EdgeEndpoint.START, infra);
            int endNodeIndex = getNodeIndex(id, EdgeEndpoint.END, infra);
            var topoEdge = infra.makeTopoEdge(startNodeIndex, endNodeIndex, id, length);

            netElementMap.put(id, NetElement.parseMicro(netElement, topoEdge));
        }

        // we need to create meso elements after creating micro elements, so those already are registered
        for (var netElement : netElements) {
            var id = netElement.valueOf("@id");
            if (descLevels.get(id) != DescriptionLevel.MESO)
                continue;
            netElementMap.put(id, NetElement.parseMacroOrMeso(netElement, netElementMap));
        }

        // we need to create macro elements after creating meso elements, so those already are registered
        for (var netElement : netElements) {
            var id = netElement.valueOf("@id");
            if (descLevels.get(id) != DescriptionLevel.MACRO)
                continue;
            netElementMap.put(id, NetElement.parseMacroOrMeso(netElement, netElementMap));
        }
        return netElementMap;
    }

    private void parseBufferStops(Document document, Infra infra) {
        var xpath = "/railML/infrastructure/functionalInfrastructure/bufferStops/bufferStop";
        for (var bufferStop : document.selectNodes(xpath)) {
            var id = bufferStop.valueOf("@id");
            var netElementId = bufferStop.valueOf("spotLocation/@netElementRef");
            double pos = Double.parseDouble(bufferStop.valueOf("spotLocation/@pos"));

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
            double pos = Double.parseDouble(switchIS.valueOf("spotLocation/@pos"));
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

    private void parseOperationalPoint(Map<String, NetElement> netElementMap, Document document, Infra infra) {
        var xpath = "/railML/infrastructure/functionalInfrastructure/operationalPoints/operationalPoint";

        Map<String, PointSequence.Builder<OperationalPoint>> builders = new HashMap<>();

        for (var operationalPoint : document.selectNodes(xpath)) {
            var id = operationalPoint.valueOf("@id");
            var name = operationalPoint.valueOf("name/@name");
            var netElementRef = operationalPoint.valueOf("spotLocation/@netElementRef");
            var netElement = netElementMap.get(netElementRef);
            var lrsId = operationalPoint.valueOf("spotLocation/linearCoordinate/@positioningSystemRef");
            double measure = Double.parseDouble(operationalPoint.valueOf("spotLocation/linearCoordinate/@measure"));

            var locations = netElement.mapToTopo(lrsId, measure);
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

    private void parseSpeedSection(
            Map<String, NetElement> netElementMap,
            Document document
    ) throws InvalidInfraException {
        // iterate over all the speed section, which is a continuous set of tracks with a speed limit
        var xpath = "/railML/infrastructure/functionalInfrastructure/speeds/speedSection";
        for (var speedSectionNode : document.selectNodes(xpath)) {
            double speed = Double.parseDouble(speedSectionNode.valueOf("@maxSpeed"));

            // convert to from km/h to m/s
            speed /= 3.6;

            var linearLocation = speedSectionNode.selectSingleNode("linearLocation");

            // parse the direction of the speed limit
            var directionString = linearLocation.valueOf("@applicationDirection");
            EdgeDirection direction;
            if (directionString.equals("normal")) {
                direction = EdgeDirection.START_TO_STOP;
            } else if (directionString.equals("reverse")) {
                direction = EdgeDirection.STOP_TO_START;
            } else
                throw new InvalidInfraException("invalid applicationDirection");

            // whether there are static signals warning about this limit
            var isSignalized = Boolean.parseBoolean(speedSectionNode.valueOf("@isSignalized"));

            logger.trace("created a speed section with speed {}", speed);
            var speedSection = new SpeedSection(isSignalized, speed);

            // find the elements the speed limit applies to
            for (var associatedNetElement : linearLocation.selectNodes("associatedNetElement"))
                parseSpeedSectionNetElement(netElementMap, direction, speedSection, associatedNetElement);
        }
    }

    void parseSpeedSectionNetElement(
            Map<String, NetElement> netElementMap,
            EdgeDirection direction,
            SpeedSection speedSection,
            Node netElementNode
    ) throws InvalidInfraException {
        // parse the LRS
        var lrsBegin = netElementNode.valueOf("linearCoordinateBegin/@positioningSystemRef");
        var lrsEnd = netElementNode.valueOf("linearCoordinateEnd/@positioningSystemRef");
        if (!lrsBegin.equals(lrsEnd))
            throw new InvalidInfraException("linearCoordinateBegin and linearCoordinateEnd aren't in the same LRS");

        // depending on the direction of the speed limit, the low and high lrs range values aren't the same
        double minMeasure;
        double maxMeasure;
        {
            double measureBegin = Double.parseDouble(netElementNode.valueOf("linearCoordinateBegin/@measure"));
            double measureEnd = Double.parseDouble(netElementNode.valueOf("linearCoordinateEnd/@measure"));
            if (direction == EdgeDirection.START_TO_STOP) {
                minMeasure = measureBegin;
                maxMeasure = measureEnd;
            } else {
                minMeasure = measureEnd;
                maxMeasure = measureBegin;
            }
        }

        var netElementRef = netElementNode.valueOf("@netElementRef");
        logger.trace("adding speed limit on netElement {}", netElementRef);
        var netElement = netElementMap.get(netElementRef);

        // find the TopoEdges the netElement spans over, and add the speed limit
        for (var place : netElement.mapToTopo(lrsBegin, minMeasure, maxMeasure)) {
            logger.trace("added speedSection on ({}, {}) from {} to {}",
                    place.value.id, direction, minMeasure, maxMeasure);

            // add the limit
            var rangeLimit = new RangeValue<>(place.begin, place.end, speedSection);
            TopoEdge.getSpeedSections(place.value, direction).add(rangeLimit);
        }
    }
}
