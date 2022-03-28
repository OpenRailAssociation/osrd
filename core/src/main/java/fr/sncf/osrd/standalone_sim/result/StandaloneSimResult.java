package fr.sncf.osrd.standalone_sim.result;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
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
    public List<List<ResultEnvelopePoint>> mrsps = new ArrayList<>();
}
