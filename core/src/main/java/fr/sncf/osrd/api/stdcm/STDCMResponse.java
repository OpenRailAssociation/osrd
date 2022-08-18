package fr.sncf.osrd.api.stdcm;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.geom.Point;

public final class STDCMResponse {
    public static final JsonAdapter<STDCMResponse> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(new LineString.Adapter())
            .add(new Point.Adapter())
            .build()
            .adapter(STDCMResponse.class);

    public StandaloneSimResult simulation;

    public PathfindingResult path;

    public STDCMResponse(StandaloneSimResult simulation, PathfindingResult path) {
        this.simulation = simulation;
        this.path = path;
    }
}
