package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTVDSection;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTrackSection;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects.RJSBufferStop;
import fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects.RJSTrainDetector;
import org.dom4j.Document;
import org.dom4j.Element;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Map;

public final class RMLTVDSection {

    private static ArrayList<ID<RJSBufferStop>> parseBufferStops(Element tvdSection) {
        var bufferStops = new ArrayList<ID<RJSBufferStop>>();
        for (var bufferStop : tvdSection.elements("hasDemarcatingBufferstop")) {
            var bufferStopID = new ID<RJSBufferStop>(bufferStop.attributeValue("ref"));
            bufferStops.add(bufferStopID);
        }
        return bufferStops;
    }

    private static HashSet<ID<RJSTrainDetector>> parseTrainDetectors(Element tvdSection) {
        var trainDetectors = new HashSet<ID<RJSTrainDetector>>();
        for (var trainDetector : tvdSection.elements("hasDemarcatingTraindetector")) {
            var bufferStopID = new ID<RJSTrainDetector>(trainDetector.attributeValue("ref"));
            trainDetectors.add(bufferStopID);
        }
        return trainDetectors;
    }

    static ArrayList<RJSTVDSection> parse(
            Map<String, NetElement> netElements,
            Document document,
            Map<String, RJSTrackSection> rjsTrackSections
    ) throws InvalidInfraException  {
        var res = new ArrayList<RJSTVDSection>();
        var xpath = "/railML/interlocking/assetsForIL/tvdSections/tvdSection";
        for (var tvdSectionNode :  document.selectNodes(xpath)) {
            var tvdSection = (Element) tvdSectionNode;
            var id = tvdSection.attributeValue("id");
            var isBerthingTrack = Boolean.parseBoolean(tvdSection.attributeValue("isBerthingTrack"));

            var trainDetectors = parseTrainDetectors(tvdSection);
            var bufferStops = parseBufferStops(tvdSection);
            res.add(new RJSTVDSection(id, isBerthingTrack, trainDetectors, bufferStops));
        }
        return res;
    }
}
