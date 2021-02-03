package fr.sncf.osrd.simulation.utils;

import static java.lang.annotation.RetentionPolicy.RUNTIME;

import com.squareup.moshi.*;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.NonNull;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.speedcontroller.*;
import fr.sncf.osrd.train.PathSection;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.util.CryoList;
import okio.BufferedSink;
import okio.Okio;
import okio.Sink;

import java.io.File;
import java.io.IOException;
import java.lang.annotation.Retention;
import java.lang.reflect.Type;
import java.time.LocalTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.function.Supplier;
import io.github.classgraph.*;

public class ChangeSerializer {
    private static final Moshi moshi;

    public static final JsonAdapter<Change> changeAdapter;

    /**
     * A collection of types and names.
     * It's just a convenient collection to store what names to associate with types.
     * @param <T> the base type
     */
    private static class SubtypeCollection<T> implements Iterable<SubtypeCollection.Subtype<T>> {
        static class Subtype<T> {
            public final Class<? extends T> type;
            public final String label;

            private Subtype(Class<? extends T> type, String label) {
                this.type = type;
                this.label = label;
            }
        }

        @Override
        @NonNull
        public Iterator<Subtype<T>> iterator() {
            return adapters.iterator();
        }

        private final ArrayList<Subtype<T>> adapters = new ArrayList<>();

        public SubtypeCollection<T> add(Class<? extends T> type, String label) {
            adapters.add(new Subtype<T>(type, label));
            return this;
        }

        /**
         * Create the list of subclasses of a class
         * @param baseClass the descriptor of the class of the base type T
         * @param <T> the base type
         * @return  the list of subclasses of the base type T
         */
        private static <T> SubtypeCollection<T> fromClass(Class<T> baseClass) {
            // Create a list of all classes of the package
            try (ScanResult scanResult = new ClassGraph().enableAllInfo().acceptPackages("fr.sncf.osrd")
                    .scan()) {

                // select the subclasses of baseClass
                ClassInfoList subclassesInfos = scanResult.getSubclasses(baseClass.getCanonicalName());

                // create result list
                var results = new SubtypeCollection<T>();

                // iterate over the subclasses
                for(var subclassInfo: subclassesInfos){
                    // load the java class using the classInfo descriptor
                    var subclass = subclassInfo.loadClass(baseClass);
                    String changeLabel = subclassInfo.getName();
                    results.add(subclass, changeLabel);
                }
                return results;
            }
        }
    }

    static {
        var builder = (
                new Moshi.Builder()
                .add(new EntityAdapter())
                .add(new CurrentPathEdgesAdapter())
                .add(new TopoEdgeAdapter())
                .add(new LocalTimeAdapter())
                .add(CollectionJsonAdapter.of(CryoList.class, CryoList::new))
                .add(new SerializableDoubleAdapter())
        );

        var changeSubtypes = SubtypeCollection.fromClass(Change.class);

        // tell moshi how to serialize Changes
        var changeAdapterFactory = PolymorphicJsonAdapterFactory.of(Change.class, "changeType");
        for (var subtype : changeSubtypes)
            changeAdapterFactory = changeAdapterFactory.withSubtype(subtype.type, subtype.label);
        builder.add(changeAdapterFactory);

        // tell moshi how to serialize TimelineEventValues
        var eventValueAdapterFactory = PolymorphicJsonAdapterFactory.of(TimelineEventValue.class, "valueType");
        for (var subtype : changeSubtypes)
            eventValueAdapterFactory = eventValueAdapterFactory.withSubtype(subtype.type, subtype.label);
        builder.add(eventValueAdapterFactory);

        // tell moshi how to serialize SpeedControllers
        builder.add(PolymorphicJsonAdapterFactory.of(SpeedController.class, "controllerType")
                .withSubtype(LimitAnnounceSpeedController.class, "LimitAnnounceSpeedController")
                .withSubtype(MaxSpeedController.class, "MaxSpeedController")
                .withSubtype(NoTraction.class, "NoTraction")
        );

        moshi = builder.build();
        changeAdapter = moshi.adapter(Change.class);
    }

    private static class EntityAdapter {
        @ToJson
        String toJson(Entity entity) {
            return entity.entityId;
        }

        @FromJson
        Entity fromJson(String entityId) {
            throw new RuntimeException("not implemented");
        }
    }

    private static class TopoEdgeAdapter {
        @ToJson
        String toJson(TopoEdge edge) {
            return edge.id;
        }

        @FromJson
        TopoEdge fromJson(String edgeId) {
            throw new RuntimeException("not implemented");
        }
    }

    private static class LocalTimeAdapter {
        @ToJson
        String toJson(LocalTime time) {
            return String.valueOf(time.toSecondOfDay());
        }

        @FromJson
        LocalTime fromJson(String time) {
            throw new RuntimeException("not implemented");
        }
    }

    private static class CurrentPathEdgesAdapter {
        @ToJson
        Collection<PathSection> edgesFromJson(ArrayDeque<PathSection> currentPathEdges) {
            return currentPathEdges;
        }

        @FromJson
        ArrayDeque<PathSection> eventToJson(Collection<PathSection> currentPathEdgesColl) {
            throw new RuntimeException("not implemented");
        }
    }

    /**
     * Serializing +inf and -inf usually fails, as those have no JSON equivalent.
     * This qualifier serializes doubles to string to workaround this issue.
     */
    @Retention(RUNTIME)
    @JsonQualifier
    public @interface SerializableDouble {
    }

    private static class SerializableDoubleAdapter {
        @ToJson
        String toJson(@SerializableDouble double number) {
            return Double.toString(number);
        }

        @FromJson
        @SerializableDouble double fromJson(String number) {
            return Double.parseDouble(number);
        }
    }

    /**
     * Converts collection types to JSON arrays containing their converted contents.
     * Adapted from moshi's CollectionJsonAdapter.java
     */
    abstract static class CollectionJsonAdapter<C extends Collection<T>, T> extends JsonAdapter<C> {
        public static <C extends Collection<T>, T> Factory of(
                Class<?> collectionType, // ArrayDeque.class
                Supplier<Collection<?>> supplier // ArrayDeque::new
        ) {

            return (type, annotations, moshi) -> {
                // the raw type is the one without a type parameter
                Class<?> rawType = Types.getRawType(type);
                if (!annotations.isEmpty())
                    return null;

                // if the type of the objects to adapt isn't something the factory can produce adapters for,
                // return null to tell the frame
                if (rawType != collectionType)
                    return null;

                Type elementType = Types.collectionElementType(type, Collection.class);
                JsonAdapter<T> elementAdapter = moshi.adapter(elementType);
                return new CollectionJsonAdapter<>(elementAdapter) {
                    @Override
                    // the collection supplier works for any type,
                    // as the collection is empty when created
                    @SuppressWarnings("unchecked")
                    Collection<T> newCollection() {
                        return (Collection<T>) supplier.get();
                    }
                };
            };
        }

        private final JsonAdapter<T> elementAdapter;

        private CollectionJsonAdapter(JsonAdapter<T> elementAdapter) {
            this.elementAdapter = elementAdapter;
        }

        abstract C newCollection();

        @Override
        public C fromJson(JsonReader reader) throws IOException {
            C result = newCollection();
            reader.beginArray();
            while (reader.hasNext()) {
                result.add(elementAdapter.fromJson(reader));
            }
            reader.endArray();
            return result;
        }

        @Override
        public void toJson(JsonWriter writer, C value) throws IOException {
            writer.beginArray();
            if (value != null)
                for (T element : value)
                    elementAdapter.toJson(writer, element);
            writer.endArray();
        }

        @Override
        public String toString() {
            return elementAdapter + ".collection()";
        }
    }


    /**
     * Writes the changelog as JSON to some output stream.
     * @param changeLog the changelog to serialize
     * @param outputStream the output stream
     * @throws IOException {@inheritDoc}
     */
    public static void serializeChangeLog(ChangeLog changeLog, BufferedSink outputStream) throws IOException {
        outputStream.writeByte('[');
        boolean isFirst = true;
        for (var change : changeLog) {
            if (!isFirst)
                outputStream.writeByte(',');

            changeAdapter.toJson(outputStream, change);
            isFirst = false;
        }
        outputStream.writeByte(']');
    }

    /**
     * Writes the changelog as JSON to some output file.
     * @param changeLog the changelog to serialize
     * @param file the output file
     * @throws IOException {@inheritDoc}
     */
    @SuppressFBWarnings(
            value = "RCN_REDUNDANT_NULLCHECK_WOULD_HAVE_BEEN_A_NPE",
            justification = "that's a spotbugs bug :)"
    )
    public static void serializeChangeLog(ChangeLog changeLog, File file) throws IOException {
        try (
                Sink fileSink = Okio.sink(file);
                var bufferedSink = Okio.buffer(fileSink)
        ) {
            serializeChangeLog(changeLog, bufferedSink);
        }
    }
}
