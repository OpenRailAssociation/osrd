package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.RJSRoute;
import fr.sncf.osrd.infra.railjson.schema.RJSTVDSection;
import org.dom4j.Document;
import org.dom4j.Element;

import java.util.ArrayList;

public class RMLRoute {
    static ArrayList<RJSRoute> parse(
            Document document
    ) throws InvalidInfraException {
        var res = new ArrayList<RJSRoute>();
        var xpath = "/railML/interlocking/assetsForIL/routes/route";
        for (var routeNode :  document.selectNodes(xpath)) {
            var route = (Element) routeNode;
            var id = route.attributeValue("id");

            var tvdSections = parseTVDSections(route);
            res.add(new RJSRoute(id, tvdSections));
        }
        return res;
    }

    private static ArrayList<ID<RJSTVDSection>> parseTVDSections(Element route) {
        var tvdSections = new ArrayList<ID<RJSTVDSection>>();
        for (var tvdSection : route.elements("hasTvdSection")) {
            var tvdSectionID = new ID<RJSTVDSection>(tvdSection.attributeValue("ref"));
            tvdSections.add(tvdSectionID);
        }
        return tvdSections;
    }
}
