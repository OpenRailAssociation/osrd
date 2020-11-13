package fr.sncf.osrd.infra;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Line {
    public final String name;
    public final Map<String, Track> tracks;

    public Line(String name, List<Track> tracks) throws DataIntegrityException {
        this.name = name;
        var tracksMap = new HashMap<String, Track>();
        for (var track : tracks)
            // there should be no duplicate tracks
            if (tracksMap.putIfAbsent(track.name, track) != null) {
                var message = String.format("duplicate track name '%s' in line '%s'", name, track.name);
                throw new DataIntegrityException(message);
            }
        this.tracks = Collections.unmodifiableMap(tracksMap);
    }
}
