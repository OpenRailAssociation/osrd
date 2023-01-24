package fr.sncf.osrd.standalone_sim.result;

import com.google.common.collect.RangeMap;
import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.reporting.warnings.Warning;
import java.util.ArrayList;
import java.util.List;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class StandaloneSimResult {
    public static final JsonAdapter<StandaloneSimResult> adapter = new Moshi
            .Builder()
            .build()
            .adapter(StandaloneSimResult.class);

    @Json(name = "base_simulations")
    public List<ResultTrain> baseSimulations = new ArrayList<>();
    @Json(name = "eco_simulations")
    public List<ResultTrain> ecoSimulations = new ArrayList<>();
    @Json(name = "speed_limits")
    public List<List<ResultEnvelopePoint>> speedLimits = new ArrayList<>();
    public List<Warning> warnings = new ArrayList<>();
    @Json(name = "modes_and_profiles")
    public List<List<ResultModeAndProfilePoint>> modesAndProfiles = new ArrayList<>();
}
