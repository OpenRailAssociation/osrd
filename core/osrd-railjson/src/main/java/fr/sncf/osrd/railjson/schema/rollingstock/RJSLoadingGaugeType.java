package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;

public enum RJSLoadingGaugeType {
    G1,
    G2,
    GA,
    GB,
    GB1,
    GC,
    @Json(name = "FR3.3")
    FR3_3,
    @Json(name = "FR3.3/GB/G2")
    FR3_3_GB_G2;
}
