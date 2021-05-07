package fr.sncf.osrd.infra.parsing.rsl;

import org.dom4j.Document;
import org.dom4j.Element;
import java.util.ArrayList;

public class BlockSection {
    /**
     * * rsl Block Section (routes)
     */
    private String[] nodesId;
    private String id;
    private boolean isBerthingtrack;

    /** Creates a new BlockSection */
    public BlockSection(String id, String[] nodesId, boolean isBerthingtrack) {
        this.id = id;
        this.nodesId = nodesId;
        this.isBerthingtrack = isBerthingtrack;
    }

    /** Read the block sections from the rsl file */
    public static ArrayList<BlockSection> parseBlockSection(Document document) {
        ArrayList<BlockSection> blockSections = new ArrayList<BlockSection>();

        for (var node : document.selectNodes("/line/blockSections/blocksection")) {
            var blockSectionNode = (Element) node;
            var id = blockSectionNode.attributeValue("uuid");
            var isBerthingTrack = Boolean.parseBoolean(blockSectionNode.attributeValue("shuntingBlock"));

            // The block section is a list of nodes
            var partNode = blockSectionNode.element("part");
            var nodes = partNode.attributeValue("nodes");
            var nodesId = nodes.split(" ");
            var blockSection = new BlockSection(id, nodesId, isBerthingTrack);
            blockSections.add(blockSection);
        }
        return blockSections;
    }

    public String[] getnodesId() {
        return nodesId;
    }

    public String getid() {
        return id;
    }

    public boolean getisBerthingTrack() {
        return isBerthingtrack;
    }
}
