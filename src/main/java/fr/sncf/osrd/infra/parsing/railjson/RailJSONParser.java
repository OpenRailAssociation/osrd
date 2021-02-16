package fr.sncf.osrd.infra.parsing.railjson;

import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;

import com.squareup.moshi.*;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.Identified;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSRoot;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import okio.BufferedSource;

import java.io.IOException;
import java.util.HashMap;

public class RailJSONParser {
    private static final JsonAdapter<RJSRoot> adapter = new Moshi
            .Builder()
            .add(new IDAdapter())
            .build()
            .adapter(RJSRoot.class);

    /** A moshi adapter for ID serialization */
    private static class IDAdapter {
        @ToJson
        String toJson(ID<?> typedId) {
            return typedId.id;
        }

        @FromJson
        <T extends Identified> ID<T> fromJson(String str) {
            return new ID<T>(str);
        }
    }

    /**
     * Parses a structured railJSON into the internal representation
     * @param railJSON a railJSON infrastructure
     * @return an OSRD infrastructure
     */
    public static Infra parse(RJSRoot railJSON) throws InvalidInfraException {
        var infra = new Infra.Builder();

        // create a unique identifier for all track intersection nodes
        var nodeIDs = TrackNodeIDs.from(railJSON.trackSectionLinks, railJSON.trackSections);

        // create track sections
        var infraTrackSections = new HashMap<String, TrackSection>();
        for (var trackSection : railJSON.trackSections) {
            var beginID = nodeIDs.get(trackSection.beginEndpoint());
            var endID = nodeIDs.get(trackSection.endEndpoint());
            var infraTrackSection = infra.makeTrackSection(beginID, endID, trackSection.id, trackSection.length);
            infraTrackSections.put(trackSection.id, infraTrackSection);
        }

        // link track sections together
        for (var trackSectionLink : railJSON.trackSectionLinks) {
            var begin = trackSectionLink.begin;
            var end = trackSectionLink.end;
            var beginEdge = infraTrackSections.get(begin.section.id);
            var endEdge = infraTrackSections.get(end.section.id);
            linkEdges(beginEdge, begin.endpoint, endEdge, end.endpoint);
        }

        return infra.build();
    }

    /**
     * Parses some railJSON infra into the internal representation
     * @param source a data stream to read from
     * @param lenient whether to tolerate invalid yet understandable json constructs
     * @return an OSRD infrastructure
     * @throws InvalidInfraException {@inheritDoc}
     * @throws IOException {@inheritDoc}
     */
    public static Infra parse(BufferedSource source, boolean lenient) throws InvalidInfraException, IOException {
        var jsonReader = JsonReader.of(source);
        jsonReader.setLenient(lenient);
        var railJSON = adapter.fromJson(jsonReader);
        if (railJSON == null)
            throw new InvalidInfraException("the railJSON source does not contain any data");
        return RailJSONParser.parse(railJSON);
    }
}
