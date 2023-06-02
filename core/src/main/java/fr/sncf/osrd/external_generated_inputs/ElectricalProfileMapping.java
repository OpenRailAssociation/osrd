package fr.sncf.osrd.external_generated_inputs;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet;
import java.util.HashMap;

/**
 * A mapping from track sections to electrical profile values
 * The electrical profiles model the power loss along catenaries depending on the position and the power class of
 * the rolling stock used
 */
public class ElectricalProfileMapping {
    /**
     * Internal representation: {"power class": {"track section": {"range": "electrical profile value"}}}
     */
    protected HashMap<String, HashMap<String, RangeMap<Double, String>>> mapping = new HashMap<>();

    /**
     * Parse the rjs profiles and store them in the internal mapping.
     */
    public void parseRJS(RJSElectricalProfileSet rjsProfileSet) {
        assert mapping.isEmpty();

        for (var rjsProfile : rjsProfileSet.levels) {
            var trackMapping = mapping.computeIfAbsent(rjsProfile.powerClass, k -> new HashMap<>());
            for (var trackRange : rjsProfile.trackRanges) {
                var rangeMapping = trackMapping.computeIfAbsent(trackRange.trackSectionID, k -> TreeRangeMap.create());
                rangeMapping.put(Range.closedOpen(trackRange.begin, trackRange.end), rjsProfile.value);
            }
        }
    }

    /**
     * Returns the electrical profile values encountered along the train path, for each power class given.
     */
    public HashMap<String, RangeMap<Double, String>> getProfilesOnPath(TrainPath trainPath) {
        var res = new HashMap<String, RangeMap<Double, String>>();
        for (var entry : mapping.entrySet()) {
            var powerClass = entry.getKey();
            var byTrackMapping = entry.getValue();
            var rangeMap = new ImmutableRangeMap.Builder<Double, String>();
            double offset = 0;
            for (var trackRange : TrainPath.removeLocation(trainPath.trackRangePath())) {
                var trackID = trackRange.track.getEdge().getID();
                if (byTrackMapping.containsKey(trackID)) {
                    var pathRangeMapping = trackRange.convertMap(byTrackMapping.get(trackID));
                    for (var rangeMapEntry : pathRangeMapping.asMapOfRanges().entrySet())
                        rangeMap.put(Range.closedOpen(rangeMapEntry.getKey().lowerEndpoint() + offset,
                                rangeMapEntry.getKey().upperEndpoint() + offset), rangeMapEntry.getValue());
                }
                offset += trackRange.getLength();
            }
            res.put(powerClass, rangeMap.build());
        }

        return res;
    }
}
