package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;

import fr.sncf.osrd.infra.parsing.railjson.RailJSONParser;
import fr.sncf.osrd.infra.parsing.railjson.schema.*;
import fr.sncf.osrd.util.XmlNamespaceCleaner;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.io.SAXReader;

import java.util.*;

public final class RailMLParser {
    /**
     * Initialises a new infrastructure from a RailML file.
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

        // parse the description level of netElements
        var descLevels = parseDescriptionLevels(document);

        // parse all net relations in the document (relations between pieces of track)
        var netRelations = NetRelation.parse(descLevels, document);

        // parse pieces of track, and add those to the json document
        var netElements = NetElement.parse(descLevels, document);

        // create RailJSON track sections for all micro netElements
        var rjsTrackSections = new HashMap<String, RJSTrackSection>();
        for (var netElement : netElements.values()) {
            // skip groups of netElements (macro or meso)
            if (netElement.getClass() != TrackNetElement.class)
                continue;
            var trackNetElement = (TrackNetElement) netElement;
            var rjsTrackSection = new RJSTrackSection(trackNetElement.id, trackNetElement.length);
            rjsTrackSections.put(rjsTrackSection.id, rjsTrackSection);
        }

        // create and fill the root RailJSON structure
        var rjsOperationalPoints = OperationalPoint.parse(netElements, document, rjsTrackSections);
        var rjsSpeedSections = SpeedSection.parse(netElements, document, rjsTrackSections);
        var rjsTvdSections = TVDSection.parse(netElements, document, rjsTrackSections);
        var rjsSwitches = SwitchIS.parse(netElements, netRelations, document);
        BufferStop.parse(netElements, document, rjsTrackSections);
        TrainDetectionElement.parse(netElements, document, rjsTrackSections);

        return new RJSRoot(
                rjsTrackSections.values(),
                netRelations.values(),
                rjsSwitches,
                rjsOperationalPoints,
                rjsTvdSections,
                rjsSpeedSections
        );
    }

    private static Map<String, DescriptionLevel> parseDescriptionLevels(Document document) {
        var descLevels = new HashMap<String, DescriptionLevel>();
        for (var level : document.selectNodes("/railML/infrastructure/topology/networks/network/level")) {
            var descriptionLevel = DescriptionLevel.getValue(level.valueOf("@descriptionLevel"));
            for (var networkResource : level.selectNodes("networkResource")) {
                descLevels.put(networkResource.valueOf("@ref"), descriptionLevel);
            }
        }
        return descLevels;
    }
}
