package fr.sncf.osrd.infra;

/**
 * A sequence of points delimiting a continuous stair.
 * @param <E> The type of the point objects
 */
public final class StairSequence<E> extends SortedSequence<E> {
    public final class Cursor {
        private int currentIndex = 0;
        private StairSequence<E> seq;

        public Cursor(StairSequence<E> seq) {
            this.seq = seq;
        }

        public Entry at() {
            return this.seq.data.get(currentIndex);
        }

        public double position() {
            return at().position;
        }

        public E value() {
            return at().value;
        }

        /**
         * Moves the cursor forward until the given position is reached.
         * @param targetPosition the position to stop at
         */
        public void advanceUntil(double targetPosition) {
            assert targetPosition > position();
            var data = this.seq.data;
            while (currentIndex < data.size() - 1) {
                if (position() > targetPosition)
                    break;
                currentIndex++;
            }
        }
    }

    public Cursor cursor() {
        return new Cursor(this);
    }
}