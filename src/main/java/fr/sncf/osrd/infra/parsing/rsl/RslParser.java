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
        //TODO entrySet
        nodeMap.forEach((key, value) -> {
            if(value.size()==3) return;
            ApplicableDirections navigability = ApplicableDirections.valueOf("BOTH");
            //create the string ID with begin track section ID-end track section ID
            var id = String.join("-", value.get(0).getID(), value.get(1).getID());
            if(!value.get(0).getBidirectional().equals("TRUE"))
                navigability = ApplicableDirections.valueOf("NORMAL");
            rjsTrackSectionLinks.put(id, new RJSTrackSectionLink(navigability, value.get(0).endEndpoint(), value.get(1).beginEndpoint()));
        });

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
        RJSTrackSection.EndpointID base, right, left;
        ApplicableDirections navigability = ApplicableDirections.valueOf("BOTH");

        for (var node : document.selectNodes("/line/nodes/switch")) {
            var switchNode = (Element) node;
            var id = switchNode.attributeValue("nodeID");
            var baseBranchNodeID = Integer.getInteger(switchNode.attributeValue("start"));

            //TODO exception to verify that we have 3 elements
            var firstTrackSection = nodeMap.get(id).get(0); //track sections having the switch as node
            var secondTrackSection = nodeMap.get(id).get(1);
            var thirdTrackSection = nodeMap.get(id).get(2);

            //TODO loop over nodeMap.get(id)
            if(nodeMap.get(baseBranchNodeID).contains(firstTrackSection)){
                // first track section is the base branch
                //TODO put this in a function
                if (firstTrackSection.beginEndpoint().endpoint.id == baseBranchNodeID) {
                    base = firstTrackSection.beginEndpoint();
                    left = secondTrackSection.endEndpoint();
                    right = thirdTrackSection.endEndpoint();
                } else {
                    base = firstTrackSection.endEndpoint();
                    left = secondTrackSection.beginEndpoint();
                    right = thirdTrackSection.beginEndpoint();
                }
                if(!firstTrackSection.getBidirectional().equals("true"))
                    navigability = ApplicableDirections.valueOf("NORMAL");
            }
            else if(nodeMap.get(baseBranchNodeID).contains(secondTrackSection)){
                // second track section is the base branch
                if (secondTrackSection.beginEndpoint().endpoint.id == baseBranchNodeID) {
                    base = secondTrackSection.beginEndpoint();
                    left = firstTrackSection.endEndpoint();
                    right = thirdTrackSection.endEndpoint();
                } else {
                    base = secondTrackSection.endEndpoint();
                    left = firstTrackSection.beginEndpoint();
                    right = thirdTrackSection.beginEndpoint();
                }
                if(!secondTrackSection.getBidirectional().equals("true"))
                    navigability = ApplicableDirections.NORMAL; //TODO put like this

            }
            else{
                // third track section is the base branch
                if (thirdTrackSection.beginEndpoint().endpoint.id == baseBranchNodeID) {
                    base = thirdTrackSection.beginEndpoint();
                    left = firstTrackSection.endEndpoint();
                    right = secondTrackSection.endEndpoint();
                } else {
                    base = thirdTrackSection.endEndpoint();
                    left = firstTrackSection.beginEndpoint();
                    right = secondTrackSection.beginEndpoint();
                }
                if(!thirdTrackSection.getBidirectional().equals("true"))
                    navigability = ApplicableDirections.valueOf("NORMAL");
            }
            var rjsSwitch = new RJSSwitch(id, base, left, right);
            switches.add(rjsSwitch);
            //create 2 track section links for each switch: base/right, base/left
            //create the string ID with begin track section ID-end track section ID
            var id1 = String.join("-", base.section.id,left.section.id);
            trackSectionLinks.put(id1, new RJSTrackSectionLink(navigability,base,left));
            var id2 = String.join("-",base.section.id,right.section.id);
            trackSectionLinks.put(id2, new RJSTrackSectionLink(navigability,base,right));
        }
        return switches;
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


