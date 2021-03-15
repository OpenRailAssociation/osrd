package fr.sncf.osrd.infra.parsing.rsl;

import fr.sncf.osrd.App;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.graph.ApplicableDirections;
import fr.sncf.osrd.infra.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.parsing.railjson.schema.*;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects.RJSBufferStop;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackranges.RJSOperationalPointPart;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackranges.RJSSpeedSectionPart;
import fr.sncf.osrd.util.XmlNamespaceCleaner;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.Element;
import org.dom4j.io.SAXReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;

public final class RslParser {
    /**
     * Initialises a new infrastructure from a Rsl file.
     * @return the parsed infrastructure
     */
    public static RJSRoot parse(String inputPath) throws InvalidInfraException {
        Document document;
        try {
            document = new SAXReader().read(inputPath);
        } catch (DocumentException e) {
            throw new InvalidInfraException("invalid XML", e);
        }

        // remove xml namespace tags, as these prevent using xpath
        document.accept(new XmlNamespaceCleaner());

        // parse all pieces of track
        var edges = Edge.parseEdges(document);

        // create and fill the root RailJSON structure:
        // create the track sections map and the speed sections list
        // create a map of all edges connected to a given node
        var rjsTrackSections = new HashMap<String, RJSTrackSection>();
        var rjsSpeedSections = new ArrayList<RJSSpeedSection>();
        var nodeMap = new HashMap<String, ArrayList<Edge>>();
        for (var edge : edges) {
            rjsTrackSections.put(edge.id, edge);
            speedSectionParse(rjsSpeedSections, rjsTrackSections, edge);
            createNodeMap(nodeMap, edge);
        }

        // create RailJSON switches and track section links
        var rjsTrackSectionLinks = new HashMap<String, RJSTrackSectionLink>();
        var rjsSwitches = switchParse(document, nodeMap, rjsTrackSectionLinks);

        // create track section links for all the nodes not being switches
        for (var entry : nodeMap.entrySet()) {
            var neighbors = entry.getValue();
            if ((neighbors.size() > 2) || (neighbors.size() <= 1))
                continue;
            addTrackSectionLinks(neighbors.get(0), neighbors.get(1),
                    entry.getKey(), rjsTrackSectionLinks);
        }

        var rjsOperationalPoints = timingPointsParse(document, rjsTrackSections, nodeMap);
        var rjsTvdSections = tvdSectionsParse(document, rjsTrackSections, nodeMap);

        return new RJSRoot(
                rjsTrackSections.values(),
                rjsTrackSectionLinks.values(),
                rjsSwitches,
                rjsOperationalPoints,
                rjsTvdSections,
                rjsSpeedSections
        );
    }

    /**
     * Read the block sections from a Rsl file
     * @return the TVD sections list for RJS
     */
    private static ArrayList<RJSTVDSection> tvdSectionsParse(Document document,
                                             HashMap<String, RJSTrackSection> rjsTrackSections,
                                         HashMap<String, ArrayList<Edge>> nodeMap) {
        var rjstvdsections = new ArrayList<RJSTVDSection>();
        var trainDetectorsMap = new HashMap<String,RJSTrainDetector>();

        for (var node : document.selectNodes("/line/blockSections/blocksection")) {
            var blockSectionNode = (Element) node;
            var id = new String(blockSectionNode.attributeValue("uuid") + "_tvd");
            var isBerthingTrack = Boolean.parseBoolean(blockSectionNode.attributeValue("shuntingBlock"));
            // The block section is a list of nodes
            // the train detectors are put at the begin and the end of each block section
            var partNode = blockSectionNode.element("part");
            var nodes = partNode.attributeValue("nodes");
            var nodesId = nodes.split(" ");
            var beginNodeId = nodesId[0];
            var endNodeId = nodesId[nodesId.length-1];
            var trainDetectors = new HashSet<ID<RJSTrainDetector>>();

            tdeParse(nodeMap,trainDetectors,trainDetectorsMap,rjsTrackSections,beginNodeId);
            // check if I need to create a detector for the block section end
            if (trainDetectorsMap.get(endNodeId) == null) {
                tdeParse(nodeMap, trainDetectors, trainDetectorsMap, rjsTrackSections, endNodeId);
            }

            ArrayList<ID<RJSBufferStop>> bufferStops = null;
            rjstvdsections.add(new RJSTVDSection(id, isBerthingTrack, trainDetectors, bufferStops));
        }
        return rjstvdsections;
    }

    /**
     * Create the tde and link to the corresponding track sections
     * */
    private static void tdeParse(HashMap<String, ArrayList<Edge>> nodeMap,
                                 HashSet<ID<RJSTrainDetector>> trainDetectors,
                                 HashMap<String, RJSTrainDetector> trainDetectorsMap,
                                 HashMap<String, RJSTrackSection> rjsTrackSections, String nodeId) {

        // Find the position of beginNode in the edge it is in
        for(var edge : nodeMap.get(nodeId)) {
            var endTdePoint = findEndpoint( edge, nodeId);
            RJSTrainDetector trainDetector;
            if (endTdePoint.endpoint == EdgeEndpoint.BEGIN) {
                trainDetector = new RJSTrainDetector("tde_" + nodeId, ApplicableDirections.BOTH, 0);
            }
            else {
                trainDetector = new RJSTrainDetector("tde_" + nodeId, ApplicableDirections.BOTH, edge.length);
            }
            trainDetectorsMap.put(nodeId,trainDetector);
            trainDetectors.add(new ID<>("tde_"+nodeId));
            // Link tracks sections back to the train detector
            rjsTrackSections.get(edge.id).trainDetectors.add(trainDetector);
        }
    }

    /**
     * Create the speed sections for normal and reverse direction and add to the corresponding track section
     * */
    private static void speedSectionParse(ArrayList<RJSSpeedSection> rjsSpeedSections,
                                           HashMap<String, RJSTrackSection> rjsTrackSections, Edge edge) {
        var ssID = "speed_section_" + edge.id;
        var speedSection = new RJSSpeedSection(ssID, false, edge.getSpeed());
        var speedSectionPart = new RJSSpeedSectionPart(
                ID.from(speedSection), ApplicableDirections.NORMAL, 0, edge.length);
        addSpeedSection(rjsSpeedSections, rjsTrackSections.get(edge.id), speedSection, speedSectionPart);
        // speed limit in the opposite direction
        var ssReverseID = new String("speed_section_" + edge.id + "_reverse");
        var speedSectionReverse = new RJSSpeedSection(ssReverseID, false, edge.getSpeedReverse());
        var speedSectionPartReverse = new RJSSpeedSectionPart(ID.from(speedSectionReverse),
                ApplicableDirections.REVERSE, 0, edge.length);
        addSpeedSection(rjsSpeedSections, rjsTrackSections.get(edge.id), speedSectionReverse, speedSectionPartReverse);
    }

    /**
     * Add the speed section to a list and to the corresponding track section
     * */
    private static void addSpeedSection(ArrayList<RJSSpeedSection> rjsSpeedSections,
                                        RJSTrackSection rjsTrackSection,
             RJSSpeedSection speedSection, RJSSpeedSectionPart speedSectionPart) {
        rjsSpeedSections.add(speedSection);
        rjsTrackSection.speedSections.add(speedSectionPart);
    }

    /**
     * Create the track section link and add to a map
     * */
    private static void addTrackSectionLinks(Edge edge, Edge edge1, String nodeID,
                                             HashMap<String, RJSTrackSectionLink> rjsTrackSectionLinks) {
        var firstTrack = edge;
        var secondTrack = edge1;
        var endPoint = findEndpoint(edge, nodeID);
        if (endPoint.endpoint.equals("BEGIN")) {
            firstTrack = edge1;
            secondTrack = edge;
        }
        var id = String.join("-", firstTrack.getID(), secondTrack.getID());
        var navigability = findLinkNavigability(firstTrack, secondTrack);
        rjsTrackSectionLinks.put(id,
                new RJSTrackSectionLink(navigability, firstTrack.endEndpoint(), secondTrack.beginEndpoint()));
    }

    /**
     * Read the time points from a Rsl file
     * @return the operational points list for RJS
     */
    private static ArrayList<RJSOperationalPoint> timingPointsParse(Document document,
                                                                     HashMap<String, RJSTrackSection> rjsTrackSections,
                                                                     HashMap<String, ArrayList<Edge>> nodeMap) {
        var operationalPoints = new ArrayList<RJSOperationalPoint>();
        for (var node : document.selectNodes("/line/nodes/track")) {
            var trackNode = (Element) node;
            // create the operational point
            if ((trackNode.attributeValue("type").equals("timingPoint"))
                    || (trackNode.attributeValue("type").equals("stopBoardPass"))) {
                var id = trackNode.attributeValue("nodeID");
                var rjsOperationalPoint = new RJSOperationalPoint(id);
                operationalPoints.add(rjsOperationalPoint);

                // link tracks sections back to the operational point
                for (var edge : nodeMap.get(id)) {
                    var endOpPoint = findEndpoint(edge, id);
                    if (endOpPoint.endpoint == EdgeEndpoint.BEGIN) {
                        var opPart = new RJSOperationalPointPart(ID.from(rjsOperationalPoint), 0, 0);
                        edge.operationalPoints.add(opPart);
                        break;
                    }
                }
            }
        }
        return operationalPoints;
    }

    /**
     * Read the switches from a Rsl file
     * @return the switches list for RJS
     */
    private static ArrayList<RJSSwitch> switchParse(Document document, HashMap<String, ArrayList<Edge>> nodeMap,
             HashMap<String, RJSTrackSectionLink> trackSectionLinks) {
        var switches = new ArrayList<RJSSwitch>();

        for (var node : document.selectNodes("/line/nodes/switch")) {
            var switchNode = (Element) node;
            var id = switchNode.attributeValue("nodeID");
            var baseBranchNodeID = switchNode.attributeValue("start");
            var baseTrackSection = findBase(nodeMap, id, baseBranchNodeID);
            var otherTrackSections = findOthers(nodeMap, id, baseTrackSection);
            var base = findEndpoint(baseTrackSection, id);
            var left = findEndpoint(otherTrackSections.get(0), id);
            var right = findEndpoint(otherTrackSections.get(1), id);
            var rjsSwitch = new RJSSwitch(id, base, left, right);
            switches.add(rjsSwitch);

            //create 2 track section links for each switch: base/right, base/left
            addTrackSectionLinks(baseTrackSection, otherTrackSections.get(0), id, trackSectionLinks);
            addTrackSectionLinks(baseTrackSection, otherTrackSections.get(1), id, trackSectionLinks);
        }
        return switches;
    }

    /**
     * Check if one of the tracks sections is not bidirectional
     * @return the navigability of the link
     */
    private static ApplicableDirections findLinkNavigability(Edge section, Edge section1) {
        ApplicableDirections navigability = ApplicableDirections.BOTH;
        if ((!section.isBidirectional()) || (!section1.isBidirectional()))
            navigability = ApplicableDirections.NORMAL;
        return navigability;
    }

    /**
     * Find the two tracks not being the base track of the switch
     */
    private static ArrayList<Edge> findOthers(HashMap<String,
            ArrayList<Edge>> nodeMap, String id, Edge baseTrackSection) {
        ArrayList<Edge> others = new ArrayList<>();
        for (var edge : nodeMap.get(id)) {
            if (!edge.equals(baseTrackSection))
                others.add(edge);
        }
        return others;
    }

    /**
     * Find the base track of the switch
     */
    private static Edge findBase(HashMap<String, ArrayList<Edge>> nodeMap, String id, String baseBranchNodeID) {
        Edge baseEdge = null;
        for (var edge : nodeMap.get(id)) {
            if (edge.getEndNodeID().equals(baseBranchNodeID)
                    || edge.getStartNodeID().equals(baseBranchNodeID)) {
                baseEdge = edge;
                break;
            }
        }
        return baseEdge;
    }

    /**
     * Find the EndPoint of the track section corresponding to a node
     */
    private static RJSTrackSection.EndpointID findEndpoint(Edge trackSection, String nodeID) {
        if (trackSection.getStartNodeID().equals(nodeID))
            return trackSection.beginEndpoint();
        return trackSection.endEndpoint();
    }

    /**
     * Put the edge twice in the nodeMap with startNodeID and endNodeID as keys
     */
    private static void createNodeMap(HashMap<String, ArrayList<Edge>> nodeMap, Edge edge) {
        var startNodeID = edge.getStartNodeID();
        var endNodeID = edge.getEndNodeID();

        for (var node : new String[]{ startNodeID, endNodeID }) {
            var neighbors = nodeMap.get(node);
            if (neighbors == null) {
                var relatedTrackSections = new ArrayList<Edge>();
                relatedTrackSections.add(edge);
                nodeMap.put(node, relatedTrackSections);
            } else {
                neighbors.add(edge);
            }
        }
    }
}


