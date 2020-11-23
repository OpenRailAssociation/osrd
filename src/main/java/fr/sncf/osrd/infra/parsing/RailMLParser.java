package fr.sncf.osrd.infra.parsing;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.topological.NoOpNode;
import org.dom4j.Document;
import org.dom4j.Node;
import org.dom4j.io.SAXReader;
import java.util.HashMap;
import java.util.List;

public class RailMLParser {
    private String inputPath;
    private HashMap<String, NoOpNode> nodesMap;

    public RailMLParser(String inputPath) {
        this.inputPath = inputPath;
        this.nodesMap = new HashMap<>();
    }

    /**
     * Initialises a new infrastructure from a RailML file.
     * @return the parsed infrastructure
     */
    public Infra parse() {
        var infra = new Infra();
        try {
            SAXReader reader = new SAXReader();
            Document document = reader.read(inputPath);
            registerTopoNodes(infra, document);
            registerTopEdges(infra, document);
        } catch (Exception e) {
            e.printStackTrace();
        }

        return infra;
    }

    private void registerTopoNodes(Infra infra, Document document) {
        var netRelationsPath = "/railml/infrastructure/topology/netRelations/netRelation";
        var netRelations = document.selectNodes(netRelationsPath);
        for (var node : netRelations) {
            var id = node.valueOf("@id");
            var newNode = infra.makeNoOpNode(id);
            nodesMap.put(id, newNode);
        }
    }

    private void registerTopEdges(Infra infra, Document document) {
        String netElementsPath = "/railml/infrastructure/topology/netElements/netElement";
        var netElements = document.selectNodes(netElementsPath);
        for (var node : netElements) {
            var id = node.valueOf("@id");
            var length = Double.parseDouble(node.valueOf("@length"));

            var netRelationsRefsPath = netElementsPath + "/netElement[@id=" + "'" + id + "'" + "]/relation";
            var netRelationsRefs = document.selectNodes(netRelationsRefsPath);

            var firstRelationId = netRelationsRefs.get(0).valueOf("@ref");
            var firstRelationNode = nodesMap.get(firstRelationId);
            var secondRelationId = netRelationsRefs.get(1).valueOf("@ref");
            var secondRelationNode = nodesMap.get(secondRelationId);

            infra.makeTopoLink(
                    firstRelationNode, firstRelationNode::addEdge,
                    secondRelationNode, secondRelationNode::addEdge,
                    0, length,
                    null, id, length);
        }
    }
}
