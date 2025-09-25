use std::collections::BTreeMap;

pub enum RangeKind {
    Open,
    Closed,
    OpenClosed,
    ClosedOpen,
    GreaterThan,
    AtLeast,
    LessThan,
    AtMost,
    All,
}

pub struct Range<K> {
    start: K,
    end: K,
    kind: RangeKind,
}

// https://guava.dev/releases/22.0/api/docs/com/google/common/collect/RangeMap.html
pub struct RangeMap<K, V> {
    inner: BTreeMap<Range<K>, V>,
}

impl<K, V> Default for RangeMap<K, V> {
    fn default() -> Self {
        Self {
            inner: BTreeMap::default(),
        }
    }
}

impl<K, V> RangeMap<K, V> {
    pub fn new() -> Self {
        Self::default()
    }
}

impl<K: PartialOrd, V> RangeMap<K, V> {
    pub fn insert(&mut self, range: Range<K>, value: V) {
        // TODO
        todo!()
    }

    pub fn get(&self, key: K) -> Option<&V> {
        // TODO
        todo!()
    }
}
