package fr.sncf.osrd.infra.parsing;

import fr.sncf.osrd.infra.*;
import org.dom4j.Document;
import org.dom4j.Node;
import org.dom4j.io.SAXReader;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class RailMLParser {
    private String inputPath;
    private HashMap<String, TopoNode> nodesMap;

    public RailMLParser(String inputPath) {
        this.inputPath = inputPath;
        this.nodesMap = new HashMap<>();
    }

    public Infra parse() {
        var infra = new Infra();
        try
        {
            SAXReader reader = new SAXReader();
            Document document = reader.read(inputPath);
            registerTopoNodes(infra, document);
            registerTopEdges(infra, document);
        } catch (Exception e)
        {
            e.printStackTrace();
        }

        return infra;
    }

    private void registerTopoNodes(Infra infra, Document document)
    {
        String netRelationsPath = "/railml/infrastructure/topology/netRelations/netRelation";
        List<Node> netRelations = document.selectNodes(netRelationsPath);
        for (Node node : netRelations)
        {
            String id = node.valueOf("@id");
            var newNode = new NoOpNode(id);
            infra.register(newNode);
            nodesMap.put(id, newNode);
        }
    }

    private void registerTopEdges(Infra infra, Document document)
    {
        String netElementsPath = "/railml/infrastructure/topology/netElements/netElement";
        List<Node> netElements = document.selectNodes(netElementsPath);
        for (Node node : netElements)
        {
            String id = node.valueOf("@id");
            double length = Double.parseDouble(node.valueOf("@length"));

            ArrayList<String> relationRefs = new ArrayList<String>();
            String netRelationsRefsPath = netElementsPath + "/netElement[@id=" + "'" + id + "'" + "]/relation";
            List<Node> netRelationsRefs = document.selectNodes(netRelationsRefsPath);

            String firstRelationId = netRelationsRefs.get(0).valueOf("@ref");
            TopoNode firstRelationNode = nodesMap.get(firstRelationId);
            String secondRelationId = netRelationsRefs.get(1).valueOf("@ref");
            TopoNode secondRelationNode = nodesMap.get(firstRelationId);

            infra.register(new TopoEdge(null, id, firstRelationNode, secondRelationNode, length));
        }
    }
}
