package fr.sncf.osrd.standalone_sim.result;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.reporting.warnings.Warning;
import java.util.ArrayList;
import java.util.List;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class StandaloneSimResult {
    public static final JsonAdapter<StandaloneSimResult> adapter = new Moshi
            .Builder()
            .add(ElectrificationRange.adapter)
            .build()
            .adapter(StandaloneSimResult.class);

    @Json(name = "base_simulations")
    public List<ResultTrain> baseSimulations = new ArrayList<>();
    @Json(name = "eco_simulations")
    public List<ResultTrain> ecoSimulations = new ArrayList<>();
    @Json(name = "speed_limits")
    public List<List<ResultEnvelopePoint>> speedLimits = new ArrayList<>();
    public List<Warning> warnings = new ArrayList<>();
    @Json(name = "electrification_ranges")
    public List<List<ElectrificationRange>> electrificationRanges = new ArrayList<>();
    @Json(name = "power_restriction_ranges")
    public List<List<PowerRestrictionRange>> powerRestrictionRanges = new ArrayList<>();

    /** Update all trainResults with the given departure times */
    public void addDepartureTimes(List<Double> departureTimes) {
        var simLists = new ArrayList<>(List.of(baseSimulations, ecoSimulations));
        for (var simList : simLists) {
            for (var i = 0; i < departureTimes.size(); i++) {
                var trainResult = simList.get(i);
                if (trainResult != null)
                    simList.set(i, trainResult.withDepartureTime(departureTimes.get(i)));
            }
        }
    }
}
