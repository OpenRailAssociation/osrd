package fr.sncf.osrd.infra.railscript.value;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.utils.DeepComparable;
import fr.sncf.osrd.utils.SortedArraySet;

public final class RSAspectSet extends SortedArraySet<Aspect> implements RSValue {
    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(RSValue other) {
        if (other.getClass() != RSAspectSet.class)
            return false;

        var o = (RSAspectSet) other;
        if (size() != o.size())
            return false;

        for (int i = 0; i < size(); i++)
            if (!get(i).deepEquals(o.get(i)))
                return false;
        return true;
    }

    @Override
    public String toString() {
        StringBuilder stringBuilder = new StringBuilder();
        stringBuilder.append('[');
        for (var i = 0; i < data.size() - 1; i++)
            stringBuilder.append(String.format("%s, ", data.get(i).id));
        stringBuilder.append(data.get(data.size() - 1).id);
        stringBuilder.append(']');
        return stringBuilder.toString();
    }
}
