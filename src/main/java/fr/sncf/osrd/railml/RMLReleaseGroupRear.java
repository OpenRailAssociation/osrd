package fr.sncf.osrd.railml;

import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSTVDSection;
import org.dom4j.Document;
import org.dom4j.Element;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;


public class RMLReleaseGroupRear {
    public final Set<ID<RJSTVDSection>> tvdSections;

    public RMLReleaseGroupRear(Set<ID<RJSTVDSection>> tvdSections) {
        this.tvdSections = tvdSections;
    }

    static HashMap<String, RMLReleaseGroupRear> parse(Document document) {
        var xpath = "/railML/interlocking/assetsForIL/routeReleaseGroupsRear/routeReleaseGroupRear";
        var res = new HashMap<String, RMLReleaseGroupRear>();
        for (var routeReleaseGroupNode :  document.selectNodes(xpath)) {
            var routeReleaseGroup = (Element) routeReleaseGroupNode;
            var id = routeReleaseGroup.attributeValue("id");
            var tvdSections = parseTvdSections(routeReleaseGroup);
            var rmlReleaseGroup = new RMLReleaseGroupRear(tvdSections);
            res.put(id, rmlReleaseGroup);
        }
        return res;
    }

    private static HashSet<ID<RJSTVDSection>> parseTvdSections(Element routeReleaseGroup) {
        var res = new HashSet<ID<RJSTVDSection>>();
        for (var tvdSection : routeReleaseGroup.elements("hasTvdSection")) {
            var tvdSectionId = tvdSection.attributeValue("ref");
            res.add(new ID<>(tvdSectionId));
        }
        return res;
    }
}
