package fr.sncf.osrd.utils.indexing

typealias StaticIdxMap<IndexT, ValueT> = IdxMap<StaticIdx<IndexT>, ValueT>

class IdxMap<IndexT : NumIdx, DataT>(@PublishedApi internal val data: ArrayList<DataT?>) {
    constructor() : this(ArrayList())


    operator fun get(index: IndexT): DataT? {
        if (index.index >= data.size.toUInt())
            return null
        return data[index.index]
    }

    inline fun getOrPut(index: IndexT, crossinline create: (IndexT) -> DataT): DataT {
        val res = get(index)
        if (res != null)
            return res
        set(index, create(index))
        return get(index)!!
    }

    operator fun set(index: IndexT, value: DataT) {
        if (index.index >= data.size.toUInt()) {
            data.ensureCapacity(index.index.toInt() + 1)
            while (index.index >= data.size.toUInt())
                data.add(null)
        }
        data[index.index] = value
    }

    inline fun <NewDataT> map(valueMap: (DataT) -> NewDataT): IdxMap<IndexT, NewDataT> {
        val res = ArrayList<NewDataT?>()
        for (i in 0 until data.size) {
            val curData = data[i]
            res.add(
                if (curData == null)
                    null
                else
                    valueMap(curData)
            )
        }
        return IdxMap(res)
    }

    fun values(): Iterable<DataT> {
        return object : Iterable<DataT> {
            override fun iterator(): Iterator<DataT> {
                return object : Iterator<DataT> {
                    var i = seekToNext(0)

                    fun seekToNext(startIndex: Int): Int {
                        var curIndex = startIndex
                        while (curIndex < data.size) {
                            if (data[curIndex] != null)
                                return curIndex
                            curIndex++
                        }
                        return -1
                    }

                    override fun hasNext(): Boolean {
                        return i != -1
                    }

                    override fun next(): DataT {
                        if (i == -1)
                            throw RuntimeException("called next after hasNext")
                        val cur = data[i]!!
                        i = seekToNext(i + 1)
                        return cur
                    }
                }
            }
        }
    }
}
