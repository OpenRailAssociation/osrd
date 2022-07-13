package fr.sncf.osrd.utils;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.NonNull;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import io.github.classgraph.ClassGraph;
import io.github.classgraph.ClassInfoList;
import io.github.classgraph.ScanResult;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;

public class Reflection {


    /**
     * A collection of types and names.
     * It's just a convenient collection to store what names to associate with types.
     * @param <T> the base type
     */
    public static class SubtypeCollection<T> implements Iterable<SubtypeCollection.Subtype<T>> {
        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public static class Subtype<T> {
            public final Class<? extends T> type;
            public final String label;

            private Subtype(Class<? extends T> type, String label) {
                this.type = type;
                this.label = label;
            }
        }

        /**
         * Create the list of subclasses of a class
         * @param baseClass the descriptor of the class of the base type T
         * @param <T> the base type
         * @return  the list of subclasses of the base type T
         */
        @SuppressFBWarnings({"RCN_REDUNDANT_NULLCHECK_WOULD_HAVE_BEEN_A_NPE"})
        public static <T> SubtypeCollection<T> fromClass(Class<T> baseClass) {
            // Create a list of all classes of the package
            try (ScanResult scanResult = new ClassGraph()
                    .enableClassInfo()
                    .acceptPackages("fr.sncf.osrd")
                    .scan()) {

                // select the subclasses of baseClass
                ClassInfoList subclassesInfos = scanResult.getSubclasses(baseClass.getCanonicalName());

                // create result list
                var results = new SubtypeCollection<T>();

                // iterate over the subclasses
                for (var subclassInfo: subclassesInfos) {
                    // skip abstract classes
                    if (subclassInfo.isAbstract())
                        continue;

                    // load the java class using the classInfo descriptor
                    var subclass = subclassInfo.loadClass(baseClass);
                    String changeLabel = subclassInfo.getSimpleName();
                    results.add(subclass, changeLabel);
                }
                return results;
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
    }

    /** Creates a polymorphic JsonAdapter from the given class,
     * the labels are built hierarchically based on labelFieldName
     * @param type class to build the adapter for
     * @param label name of the type field in the generated json
     * @param adapters list of adapter factory to add
     * @param labelFieldName name of the `static final String` fields to use to generate labels
     * @see #makeHierarchicalLabel(Class, String)
     */
    public static <T> JsonAdapter<T> makeJsonAdapterFromSubtypes(
            Class<T> type,
            String label,
            List<JsonAdapter.Factory> adapters,
            String labelFieldName
    ) {
        var factory = PolymorphicJsonAdapterFactory.of(type, label);
        var subtypes = SubtypeCollection.fromClass(type);
        for (var c : subtypes) {
            var typeLabel = makeHierarchicalLabel(c.type, labelFieldName);
            factory = factory.withSubtype(c.type, typeLabel);
        }
        var builder = new Moshi.Builder().add(factory);
        for (var adapter : adapters)
            builder.add(adapter);
        return builder.build().adapter(type);
    }

    /** Builds a hierarchical label by going up the class parents
     * and looking for `static final String fieldName;`, concatenating them using `:`.
     * <pre>
     * {@code
     *     private class Root {
     *         public static final String category = "root";
     *     }
     *
     *     private class SubTypeWithoutCategory extends Root {
     *     }
     *
     *     private class SubSubType extends SubTypeWithoutCategory {
     *         public static final String category = "last";
     *     }
     *     // makeHierarchicalLabel(C.class, "category") -> "root:last"
     * }
     * </pre>
     */
    public static String makeHierarchicalLabel(Class<?> type, String fieldName) {
        var superclass = type.getSuperclass();
        if (superclass == null)
            return "";
        var parent = makeHierarchicalLabel(superclass, fieldName);
        var field = Arrays.stream(type.getDeclaredFields())
                .filter(f -> Modifier.isStatic(f.getModifiers()))
                .filter(f -> Modifier.isFinal(f.getModifiers()))
                .filter(f -> f.getType().equals(String.class))
                .filter(f -> f.getName().equals(fieldName))
                .findFirst();
        if (field.isEmpty())
            return parent;
        try {
            var value = (String) field.get().get(null);
            if (parent.isEmpty())
                return value;
            return parent + ":" + value;
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }
}
