package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTVDSection;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTrackSection;
import org.dom4j.Document;

import java.util.ArrayList;
import java.util.Map;

public final class TVDSection {
    static ArrayList<RJSTVDSection> parse(
            Map<String, NetElement> netElements,
            Document document,
            Map<String, RJSTrackSection> rjsTrackSections
    ) {
        // TODO: implement TVDSection parsing
        return new ArrayList<>();
    }
}
