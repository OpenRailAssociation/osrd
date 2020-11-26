package fr.sncf.osrd.infra.branching;

import fr.sncf.osrd.util.Indexable;

public class Branch implements Indexable {
    public final String name;
    public final String id;

    public Branch(String name, String id) {
        this.name = name;
        this.id = id;
    }

    public final BranchAttrs attributes = new BranchAttrs();

    /**
     * A per-infra unique branch index.
     * It doesn't reflect any special order, it's just unique per infrastructure.
     */
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
