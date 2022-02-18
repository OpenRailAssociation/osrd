package fr.sncf.osrd.utils;

import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.junit.jupiter.api.Test;

public class RangeSequenceTests {

    @Test
    public void testValues() {
        var sequence = new RangeSequence<String>();
        sequence.add(0, "0-50");
        sequence.add(50, "50-100");
        sequence.add(100, "100+");
        var it = sequence.iterate(EdgeDirection.START_TO_STOP, 10, 110, x -> x);
        assert it.next().equals(new RangeValue<>(10, 50, "0-50"));
        assert it.next().equals(new RangeValue<>(50, 100, "50-100"));
        assert it.next().equals(new RangeValue<>(100, 110, "100+"));
        assert !it.hasNext();
    }

    @Test
    public void testBeforeRange() {
        var sequence = new RangeSequence<String>();
        sequence.add(0, "0-50");
        sequence.add(50, "50-100");
        sequence.add(100, "100+");
        var it = sequence.iterate(EdgeDirection.START_TO_STOP, -10, 110, x -> x);
        assert it.next().equals(new RangeValue<>(0, 50, "0-50"));
        assert it.next().equals(new RangeValue<>(50, 100, "50-100"));
        assert it.next().equals(new RangeValue<>(100, 110, "100+"));
        assert !it.hasNext();
    }

    @Test
    public void testReverse() {
        var sequence = new RangeSequence<String>();
        sequence.add(0, "0-50");
        sequence.add(50, "50-100");
        sequence.add(100, "100+");
        var it = sequence.iterate(EdgeDirection.STOP_TO_START, 110, 10, x -> x);
        assert it.next().equals(new RangeValue<>(110, 100, "100+"));
        assert it.next().equals(new RangeValue<>(100, 50, "50-100"));
        assert it.next().equals(new RangeValue<>(50, 10, "0-50"));
        assert !it.hasNext();
    }

    @Test
    public void testBuilder() throws InvalidInfraException {
        var sequence = new RangeSequence<String>();
        var builder = new RangeSequence.Builder<>(sequence);
        builder.add(50, 100, "50-100");
        builder.add(0, 50, "0-50");
        builder.add(100, 200, "100+");
        builder.build();
        var it = sequence.iterate(EdgeDirection.START_TO_STOP, 10, 110, x -> x);
        assert it.next().equals(new RangeValue<>(10, 50, "0-50"));
        assert it.next().equals(new RangeValue<>(50, 100, "50-100"));
        assert it.next().equals(new RangeValue<>(100, 110, "100+"));
        assert !it.hasNext();
    }
}
