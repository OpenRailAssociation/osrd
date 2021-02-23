package fr.sncf.osrd.util.graph;

import fr.sncf.osrd.util.Indexable;

public abstract class AbstractNode implements Indexable {
    private int index = -1;

    @Override
    public void setIndex(int index) {
        assert this.index == -1;
        this.index = index;
    }

    @Override
    public int getIndex() {
        assert index != -1;
        return index;
    }
}
