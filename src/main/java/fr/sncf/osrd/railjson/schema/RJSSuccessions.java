package fr.sncf.osrd.railjson.schema;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;

import fr.sncf.osrd.railjson.schema.successiontable.RJSSuccessionTable;

import java.util.Collection;

public final class RJSSuccessions {
    public static final JsonAdapter<RJSSuccessions> adapter = new Moshi
            .Builder()
            .build()
            .adapter(RJSSuccessions.class);

    /** An incremental format version number, which may be used for migrations */
    public final int version = 1;

    /** A list of succession tables involved in this simulation */
    @Json(name = "successions")
    public Collection<RJSSuccessionTable> successionTables;

    public RJSSuccessions(
            Collection<RJSSuccessionTable> successionTables
    ) {
        this.successionTables = successionTables;
    }
}