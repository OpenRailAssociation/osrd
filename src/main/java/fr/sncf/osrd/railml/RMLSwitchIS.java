package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSectionLink;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import org.dom4j.Document;
import org.dom4j.Element;

import java.util.ArrayList;
import java.util.Map;

public final class RMLSwitchIS {
    private static RJSTrackSection.EndpointID parseSwitchBranch(
            Map<String, RJSTrackSectionLink> netRelations,
            RJSTrackSection.EndpointID baseBranch,
            Element switchElement,
            String branchName
    ) throws InvalidInfraException {
        var branchNode = switchElement.element(branchName);
        var branchRelID = branchNode.attributeValue("netRelationRef");
        var branchRel = netRelations.get(branchRelID);
        if (branchRel == null)
            throw new InvalidInfraException(String.format("Unknown netRelation in switch branch: %s", branchRelID));

        // if the base branch is connected to the first link of the location, the second link is the branch
        if (baseBranch.section.equals(branchRel.begin.section))
            return branchRel.end;
        // if it's connected to the end of the link, it's the other way around
        if (baseBranch.section.equals(branchRel.end.section))
            return branchRel.begin;

        // otherwise, the base branch isn't part of the relation, which is an error
        throw new InvalidInfraException(String.format(
                "the %s of switch %s isn't connected to the base",
                branchName, switchElement.attributeValue("id")));
    }

    static ArrayList<RJSSwitch> parse(
            Map<String, NetElement> netElements,
            Map<String, RJSTrackSectionLink> netRelations,
            Document document
    ) throws InvalidInfraException {
        var res = new ArrayList<RJSSwitch>();
        var xpath = "/railML/infrastructure/functionalInfrastructure/switchesIS/switchIS";
        for (var switchISNode :  document.selectNodes(xpath)) {
            var switchIS = (Element) switchISNode;
            var id = switchIS.attributeValue("id");
            var baseBranch = ParsingUtils.parseLocationEndpointID(netElements, switchIS);
            var leftBranch = parseSwitchBranch(netRelations, baseBranch, switchIS, "leftBranch");
            var rightBranch = parseSwitchBranch(netRelations, baseBranch, switchIS, "rightBranch");
            res.add(new RJSSwitch(id, baseBranch, leftBranch, rightBranch, 0));
        }
        return res;
    }

}
