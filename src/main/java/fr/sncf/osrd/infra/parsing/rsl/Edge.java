package fr.sncf.osrd.infra.parsing.rsl;

import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTrackSection;
import org.dom4j.Document;
import org.dom4j.Element;
import java.util.ArrayList;

public class Edge extends RJSTrackSection {
    /**
     * Extension of RJS Track section to parse rsl edge (links)
     */
    private String startNodeID;
    private String endNodeID;
    private String bidirectional;
    private double grade;
    private double speed;
    private double speedReverse;

    /** Creates a new Edge */
    public Edge(String id, double length, String startNodeID, String endNodeID,
             String bidirectional, double speed, double speedReverse, double grade) {
        super(id, length);
        this.startNodeID = startNodeID;
        this.endNodeID = endNodeID;
        this.bidirectional = bidirectional;
        this.speed = speed;
        this.speedReverse = speedReverse;
        this.grade = grade;
    }

    public double getSpeed() {
        return speed;
    }

    public double getSpeedReverse() {
        return speedReverse;
    }

    /**
     * Check the direction of the edge
     */
    public Boolean isBidirectional() {
        if (!bidirectional.equals("true"))
            return false;
        return true;
    }

    /**
     * Read Edge from rsl file
     */
    public static ArrayList<Edge> parseEdges(Document document) {
        var edgesList = new ArrayList<Edge>();
        var edges = document.selectNodes("/line/links/link");

        for (var edgeNode : edges) {
            var edge = (Element) edgeNode;
            final var startNodeID = edge.attributeValue("source");
            final var endNodeID = edge.attributeValue("target");
            final var bidirectional = edge.attributeValue("bidirectional");
            final var lengthStr = edge.attributeValue("length");
            final var speedStr = edge.attributeValue("vmax");
            final var speedRevStr = edge.attributeValue("vmaxr");
            final var gradeStr = edge.attributeValue("gradient");
            double length = 0;
            if (lengthStr != null)
                length = Double.parseDouble(lengthStr);
            double speed = Double.POSITIVE_INFINITY;
            if (speedStr != null)
                speed = Double.parseDouble(speedStr);
            double speedReverse = Double.POSITIVE_INFINITY;
            if (speedRevStr != null)
                speedReverse = Double.parseDouble(speedRevStr);
            double grade = 0;
            if (gradeStr != null)
                grade = Double.parseDouble(gradeStr);

            //create the string ID with startNodeID-endNodeID
            var id = String.join("-", startNodeID, endNodeID);
            var parsedEdge = new Edge(id, length, startNodeID, endNodeID, bidirectional, speed, speedReverse, grade);
            edgesList.add(parsedEdge);
        }
        return edgesList;
    }

    public String getEndNodeID() {
        return endNodeID;
    }

    public String getStartNodeID() {
        return startNodeID;
    }
}
