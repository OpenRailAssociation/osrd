package fr.sncf.osrd.infra.parsing.rsl;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.graph.ApplicableDirections;
import fr.sncf.osrd.infra.parsing.railjson.schema.*;
import fr.sncf.osrd.util.XmlNamespaceCleaner;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.Element;
import org.dom4j.io.SAXReader;

import java.util.ArrayList;
import java.util.HashMap;


public final class RslParser {
    /**
     * Initialises a new infrastructure from a Rsl file.
     *
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
        // create a map of all edges connected to a given node
        var rjsTrackSections = new HashMap<String, RJSTrackSection>();
        var nodeMap = new HashMap<Integer, ArrayList<Edge>>();
        for (var edge : edges) {
            rjsTrackSections.put(edge.id, edge);
            createNodeMap(nodeMap, edge);
        }

        // create RailJSON switches and track section links
        var rjsTrackSectionLinks = new HashMap<String, RJSTrackSectionLink>();
        var rjsSwitches = switchParse(document,nodeMap,rjsTrackSectionLinks);

        //create track section links for all the nodes not being switches
        for(var entry : nodeMap.entrySet()){
            if (entry.getValue().size() > 2) continue;
            /* x ------x x------
               x x------ ------x
               X x------ x------
               x ------x ------x
             */
            var id = String.join("-", entry.getValue().get(0).getID(), entry.getValue().get(1).getID());
            var navigability = findLinkNavigability(entry.getValue().get(0),entry.getValue().get(1));
            rjsTrackSectionLinks.put(id, new RJSTrackSectionLink(navigability, entry.getValue().get(0).endEndpoint(), entry.getValue().get(1).beginEndpoint()));
        }

        var rjsOperationalPoints = timingPointsParse(document, rjsTrackSections,nodeMap);
        var rjsSpeedSections = speedIndicatorsParse(document, rjsTrackSections);
        var rjsTvdSections = TVDSectionsParse();

        return new RJSRoot(
                rjsTrackSections.values(),
                rjsTrackSectionLinks.values(),
                rjsSwitches,
                rjsOperationalPoints,
                rjsTvdSections,
                rjsSpeedSections
        );
    }

    private static ArrayList<RJSTVDSection> TVDSectionsParse() {
        ArrayList<RJSTVDSection> rjsTvdSections = new ArrayList<RJSTVDSection>();
        return rjsTvdSections;
    }

    private static ArrayList<RJSSpeedSection> speedIndicatorsParse(Document document, HashMap<String, RJSTrackSection> rjsTrackSections) {
        var speedSections = new ArrayList<RJSSpeedSection>();
        for (var node : document.selectNodes("/line/nodes/speedIndicator")) {
            var speedIndicatorNode = (Element) node;

        }
        return speedSections;
    }

    private static ArrayList<RJSOperationalPoint> timingPointsParse
            (Document document, HashMap<String, RJSTrackSection> rjsTrackSections, HashMap<Integer, ArrayList<Edge>> nodeMap) {
        var operationalPoints = new ArrayList<RJSOperationalPoint>();
        for (var node : document.selectNodes("/line/nodes/track")) {
            var trackNode = (Element) node;
            // create the operational point
            if(trackNode.attributeValue("type")=="timingPoint") {
                var id = trackNode.attributeValue("NodeID");
                var rjsOperationalPoint = new RJSOperationalPoint(id);
                var operationalPointID = ID.from(rjsOperationalPoint);
                operationalPoints.add(rjsOperationalPoint);

                // link tracks sections back to the operational point
            }
        }
        return operationalPoints;
    }

    /**
     * Read the switches from a Rsl file
     *
     * @return the switches list for RJS
     */
    private static ArrayList<RJSSwitch> switchParse
    (Document document, HashMap<Integer, ArrayList<Edge>> nodeMap, HashMap<String, RJSTrackSectionLink> trackSectionLinks) {
        var switches = new ArrayList<RJSSwitch>();

        for (var node : document.selectNodes("/line/nodes/switch")) {
            var switchNode = (Element) node;
            var id = switchNode.attributeValue("nodeID");
            var baseBranchNodeID = Integer.getInteger(switchNode.attributeValue("start"));

            //TODO exception to verify that we have 3 elements
            var baseTrackSection = findBase(nodeMap.get(id),baseBranchNodeID);
            var otherTrackSections = findOthers(nodeMap.get(id),baseTrackSection);

            var base = findEndpoint(baseTrackSection,id);
            var left = findEndpoint(otherTrackSections.get(0),id);
            var right = findEndpoint(otherTrackSections.get(1),id);
            var rjsSwitch = new RJSSwitch(id, base, left, right);
            switches.add(rjsSwitch);

            //create 2 track section links for each switch: base/right, base/left
            //create the string ID with begin track section ID-end track section ID
            var id1 = String.join("-", base.section.id,left.section.id);
            var navigability1 = findLinkNavigability(baseTrackSection,otherTrackSections.get(0));
            trackSectionLinks.put(id1, new RJSTrackSectionLink(navigability1,base,left));
            var id2 = String.join("-",base.section.id,right.section.id);
            var navigability2 = findLinkNavigability(baseTrackSection,otherTrackSections.get(1));
            trackSectionLinks.put(id2, new RJSTrackSectionLink(navigability2,base,right));
        }
        return switches;
    }

    private static ApplicableDirections findLinkNavigability(RJSTrackSection section, RJSTrackSection section1) {
        ApplicableDirections navigability = null;
        return navigability;
    }


    private static ArrayList<Edge> findOthers(ArrayList<Edge> edges, Edge baseTrackSection) {
        ArrayList<Edge> others = null;
        for(var edge : edges){
            if(!edge.equals(baseTrackSection)) others.add(edge);
        }
        return others;
    }

    private static RJSTrackSection.EndpointID findEndpoint(Edge trackSection, String ID) {
        var id = Integer.getInteger(ID);
        if(trackSection.beginEndpoint().endpoint.id == id) return trackSection.beginEndpoint();
        return trackSection.endEndpoint();
    }

    private static Edge findBase(ArrayList<Edge> edges, Integer baseBranchNodeID) {
        Edge baseEdge = null;
        for(var edge : edges){
            if((edge.beginEndpoint().endpoint.id == baseBranchNodeID)||
                    (edge.endEndpoint().endpoint.id == baseBranchNodeID)) {
                baseEdge=edge;
                break;
            }
        }
        return baseEdge;
    }

    private static void createNodeMap
            (HashMap<Integer, ArrayList<Edge>> nodeMap, Edge edge) {
        var startNodeID = edge.beginEndpoint().endpoint.id;
        var endNodeID = edge.endEndpoint().endpoint.id;
        if (!nodeMap.containsKey(startNodeID)) {
            var relatedTrackSections = new ArrayList<Edge>();
            relatedTrackSections.add(edge);
            nodeMap.put(startNodeID, relatedTrackSections);
        } else {
            nodeMap.get(startNodeID).add(edge);
        }
        if (!nodeMap.containsKey(endNodeID)) {
            var relatedTrackSections = new ArrayList<Edge>();
            relatedTrackSections.add(edge);
            nodeMap.put(endNodeID, relatedTrackSections);
        } else {
            nodeMap.get(endNodeID).add(edge);
            return;
        }
    }
}


