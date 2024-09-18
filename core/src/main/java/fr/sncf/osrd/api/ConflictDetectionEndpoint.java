package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.conflicts.ConflictsKt;
import fr.sncf.osrd.conflicts.TrainRequirements;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.reporting.warnings.Warning;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.jetbrains.annotations.NotNull;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;

public class ConflictDetectionEndpoint implements Take {

    public ConflictDetectionEndpoint() {}

    public static final JsonAdapter<ConflictDetectionEndpoint.ConflictDetectionRequest> adapterRequest =
            new Moshi.Builder()
                    .add(ID.Adapter.FACTORY)
                    .addLast(new KotlinJsonAdapterFactory())
                    .build()
                    .adapter(ConflictDetectionEndpoint.ConflictDetectionRequest.class);

    @Override
    public Response act(Request req) throws Exception {
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null) return new RsWithStatus(new RsText("missing request body"), 400);

            var conflicts = ConflictsKt.detectConflicts(request.trainsRequirements);
            var result = new ConflictDetectionResult(conflicts);
            result.warnings = recorder.warnings;

            return new RsJson(new RsWithBody(ConflictDetectionResult.adapter.toJson(result)));
        } catch (Throwable ex) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex);
        }
    }

    public static class ConflictDetectionRequest {
        @Json(name = "trains_requirements")
        public final List<TrainRequirements> trainsRequirements;

        public ConflictDetectionRequest(List<TrainRequirements> trainsRequirements) {
            this.trainsRequirements = trainsRequirements;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class ConflictDetectionResult {
        public static final JsonAdapter<ConflictDetectionResult> adapter =
                new Moshi.Builder().build().adapter(ConflictDetectionResult.class);

        public List<Warning> warnings = new ArrayList<>();

        @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
        public static class Conflict {
            @Json(name = "train_ids")
            public final Collection<Long> trainIds;

            public final transient Collection<Long> workScheduleIds;

            @Json(name = "start_time")
            public final double startTime;

            @Json(name = "end_time")
            public final double endTime;

            public enum ConflictType {
                @Json(name = "Spacing")
                SPACING,
                @Json(name = "Routing")
                ROUTING,
            }

            @NotNull
            @Json(name = "conflict_type")
            public final ConflictType conflictType;

            public final transient Collection<ConflictRequirement> requirements;

            public Conflict(
                    Collection<Long> trainIds,
                    double startTime,
                    double endTime,
                    @NotNull ConflictType conflictType,
                    Collection<ConflictRequirement> requirements) {
                this.trainIds = trainIds;
                this.workScheduleIds = List.of();
                this.startTime = startTime;
                this.endTime = endTime;
                this.conflictType = conflictType;
                this.requirements = requirements;
            }

            public Conflict(
                    Collection<Long> trainIds,
                    Collection<Long> workScheduleIds,
                    double startTime,
                    double endTime,
                    @NotNull ConflictType conflictType,
                    Collection<ConflictRequirement> requirements) {
                this.trainIds = trainIds;
                this.workScheduleIds = workScheduleIds;
                this.startTime = startTime;
                this.endTime = endTime;
                this.conflictType = conflictType;
                this.requirements = requirements;
            }
        }

        public static class ConflictRequirement {
            public final String zone;
            public final double startTime;
            public final double endTime;

            public ConflictRequirement(String zone, double startTime, double endTime) {
                this.zone = zone;
                this.startTime = startTime;
                this.endTime = endTime;
            }
        }

        @Json(name = "conflicts")
        final List<Conflict> conflicts;

        public ConflictDetectionResult(List<Conflict> conflicts) {
            this.conflicts = conflicts;
        }
    }
}
