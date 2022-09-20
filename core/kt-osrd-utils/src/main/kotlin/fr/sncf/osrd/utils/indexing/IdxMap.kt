package fr.sncf.osrd.utils.indexing

typealias StaticIdxMap<IndexT, ValueT> = IdxMap<StaticIdx<IndexT>, ValueT>

class IdxMap<IndexT : NumIdx, DataT> {
    private val data = ArrayList<DataT?>()

    operator fun get(index: IndexT): DataT? {
        if (index.index >= data.size.toUInt())
            return null
        return data[index.index]
    }

    operator fun set(index: IndexT, value: DataT) {
        if (index.index >= data.size.toUInt()) {
            data.ensureCapacity(index.index.toInt() + 1)
            while (index.index >= data.size.toUInt())
                data.add(null)
        }
        data[index.index] = value
    }
}
