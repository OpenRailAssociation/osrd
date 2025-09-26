//! Port of Google's RangeMap.
//!
//! Ref: https://guava.dev/releases/22.0/api/docs/com/google/common/collect/RangeMap.html

#![warn(missing_docs)]

use std::collections::BTreeMap;
use std::fmt;

/// A range (or "interval") defines the boundaries around a contiguous span of values of some
/// Comparable type; for example, "integers from 1 to 100 inclusive."
///
/// Unlike [std::ops] ranges, this type can represent ranges of mixed openness, as well as more
/// kinds of ranges.
///
/// Note that it is not possible to iterate over these contained values.
pub enum Range<T> {
    /// `(start..end)` , or `{x | start < x < end}`
    Open { start: T, end: T },

    /// `[start..end]` , or `{x | start <= x <= end}`
    Closed { start: T, end: T },

    /// `(start..end]` , or `{x | start < x <= end}`
    OpenClosed { start: T, end: T },

    /// `[start..end)` , or `{x | start <= x < end}`
    ClosedOpen { start: T, end: T },

    /// `(start..+∞)` , or `{x | start < x}`
    GreaterThan { start: T },

    /// `[start..+∞)` , or `{x | start <= x}`
    AtLeast { start: T },

    /// `(-∞..end)` , or `{x | x < end}`
    LessThan { end: T },

    /// `(-∞..end]` , or `{x | x <= end}`
    AtMost { end: T },

    /// `(-∞..+∞)` , or `{x}`
    All,
}

impl<T> fmt::Debug for Range<T>
where
    T: fmt::Debug,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Open { start, end } => write!(f, "({start:?}..{end:?})"),
            Self::Closed { start, end } => write!(f, "[{start:?}..{end:?}]"),
            Self::OpenClosed { start, end } => write!(f, "({start:?}..{end:?}]"),
            Self::ClosedOpen { start, end } => write!(f, "[{start:?}..{end:?})"),
            Self::GreaterThan { start } => write!(f, "({start:?}..+∞)"),
            Self::AtLeast { start } => write!(f, "[{start:?}..+∞)"),
            Self::LessThan { end } => write!(f, "(-∞..{end:?})"),
            Self::AtMost { end } => write!(f, "(-∞..{end:?}]"),
            Self::All => write!(f, "(-∞..+∞)"),
        }
    }
}

/// A mapping from disjoint nonempty ranges to non-null values.
///
/// Queries look up the value associated with the range (if any) that contains a specified key.
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
    /// Creates a new empty [`RangeMap`].
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
