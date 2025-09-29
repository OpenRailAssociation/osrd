//! Port of Google's RangeMap.
//!
//! Ref: https://guava.dev/releases/22.0/api/docs/com/google/common/collect/RangeMap.html

use std::cmp::Ordering;
use std::collections::BTreeMap;

/// A bound of a range.
///
/// This is a version of [`std::ops::Bound`] that implements [`Ord`] for types of interest.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Bound<T> {
    Included(T),
    Excluded(T),
    Unbounded,
}

impl<T> Eq for Bound<T> where T: PartialEq {}

impl PartialOrd for Bound<f64> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(Self::cmp(self, other))
    }
}

impl Ord for Bound<f64> {
    fn cmp(&self, other: &Self) -> Ordering {
        match (self, other) {
            (Bound::Unbounded, Bound::Unbounded) => Ordering::Equal,
            (Bound::Unbounded, _) => Ordering::Less,
            (_, Bound::Unbounded) => Ordering::Greater,
            (Bound::Included(s), Bound::Excluded(o)) => f64::total_cmp(s, o).then(Ordering::Less),
            (Bound::Excluded(s), Bound::Included(o)) => {
                f64::total_cmp(s, o).then(Ordering::Greater)
            }
            (Bound::Included(s), Bound::Included(o)) => f64::total_cmp(s, o),
            (Bound::Excluded(s), Bound::Excluded(o)) => f64::total_cmp(s, o),
        }
    }
}

impl PartialOrd for Bound<i64> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(Self::cmp(self, other))
    }
}

impl Ord for Bound<i64> {
    fn cmp(&self, other: &Self) -> Ordering {
        match (self, other) {
            (Bound::Unbounded, Bound::Unbounded) => Ordering::Equal,
            (Bound::Unbounded, _) => Ordering::Less,
            (_, Bound::Unbounded) => Ordering::Greater,
            (Bound::Included(s), Bound::Excluded(o)) => i64::cmp(s, o).then(Ordering::Less),
            (Bound::Excluded(s), Bound::Included(o)) => i64::cmp(s, o).then(Ordering::Greater),
            (Bound::Included(s), Bound::Included(o)) => i64::cmp(s, o),
            (Bound::Excluded(s), Bound::Excluded(o)) => i64::cmp(s, o),
        }
    }
}

impl<T> Bound<T> {
    /// Given `self` as the upper bound of a range, return the smallest lower bound a range can
    /// have after `self`.
    pub fn next_up(self) -> Option<Self> {
        match self {
            Self::Included(t) => Some(Self::Excluded(t)),
            Self::Excluded(t) => Some(Self::Included(t)),
            Self::Unbounded => None,
        }
    }

    /// Given `self` as the lower bound of a range, return the highest upper bound a range can have
    /// before `self`.
    pub fn next_down(self) -> Option<Self> {
        match self {
            Self::Included(t) => Some(Self::Excluded(t)),
            Self::Excluded(t) => Some(Self::Included(t)),
            Self::Unbounded => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Range<T> {
    pub start: Bound<T>,
    pub end: Bound<T>,
}

impl<T> Range<T>
where
    T: PartialOrd,
{
    pub fn is_empty(&self) -> bool {
        !match (&self.start, &self.end) {
            (Bound::Unbounded, _) | (_, Bound::Unbounded) => true,
            (Bound::Included(start), Bound::Excluded(end))
            | (Bound::Excluded(start), Bound::Included(end))
            | (Bound::Excluded(start), Bound::Excluded(end)) => start < end,
            (Bound::Included(start), Bound::Included(end)) => start <= end,
        }
    }

    pub fn contains(&self, value: T) -> bool {
        (match &self.start {
            Bound::Included(start) => start <= &value,
            Bound::Excluded(start) => start < &value,
            Bound::Unbounded => true,
        }) && (match &self.end {
            Bound::Included(end) => &value <= end,
            Bound::Excluded(end) => &value < end,
            Bound::Unbounded => true,
        })
    }
}

/// A mapping from disjoint nonempty ranges to non-null values.
///
/// Queries look up the value associated with the range (if any) that contains a specified key.
pub struct RangeMap<K, V> {
    /// start of the range --> (end of the range, value associated with the range)
    inner: BTreeMap<Bound<K>, (Bound<K>, V)>,
}

impl<K, V> Default for RangeMap<K, V> {
    fn default() -> Self {
        Self {
            inner: BTreeMap::default(),
        }
    }
}

impl<K, V> RangeMap<K, V> {
    /// Create a new empty [`RangeMap`].
    pub fn new() -> Self {
        Self::default()
    }
}

impl<K, V> RangeMap<K, V>
where
    Bound<K>: Ord,
    K: Copy + PartialOrd,
{
    /// Insert the given `value` at the given `range`, such that subsequent calls to
    /// [`RangeMap::get`] with a key in `range` return `value`.
    pub fn insert(&mut self, range: Range<K>, value: V)
    where
        V: Clone,
    {
        if range.is_empty() {
            // Don't bother using memory to insert empty ranges.
            return;
        }
        self.remove(range);
        self.inner.insert(range.start, (range.end, value));
    }

    /// Retrieve the value associated with the given `key`, or `None` if no range that contain
    /// `key` has been inserted.
    pub fn get(&self, key: K) -> Option<&V> {
        // TODO: change this function once [BTreeMap::lower_bound] is stable
        // https://github.com/rust-lang/rust/issues/107540

        let mut r = self.inner.range((
            std::ops::Bound::Unbounded,
            std::ops::Bound::Included(Bound::Included(key)),
        ));

        let (&start, &(end, ref value)) = r.next_back()?;

        if !(Range { start, end }).contains(key) {
            return None;
        }

        Some(value)
    }

    /// Remove all values in the given `range`, such that subsequent calls to [`RangeMap::get`]
    /// with a key in `range` return [`None`].
    pub fn remove(&mut self, range: Range<K>)
    where
        V: Clone,
    {
        // TODO: change this function once [BTreeMap::lower_bound] is stable
        // https://github.com/rust-lang/rust/issues/107540

        if range.is_empty() {
            // Prevent panics in the BTreeMap::range call.
            return;
        }

        let mut to_remove: Vec<Bound<K>> = Vec::new();
        let mut to_update: Option<(Bound<K>, Bound<K>)> = None;

        // First part: remove or truncate ranges that start in `range`.

        let mut overlaps = self.inner.range((
            std::ops::Bound::Included(range.start),
            std::ops::Bound::Included(range.end),
        ));

        if let Some(last) = overlaps.next_back() {
            // `last` is the last range that starts in [range.start..range.end]
            // It might not end in [range.start..range.end]

            let (last_start, (last_end, _)) = last;
            if *last_end <= range.end {
                // `last` is fully contained by `range`, let's remove it.
                to_remove.push(*last_start);
            } else {
                // `last` and `range` overlap, let's truncate `last`.
                if let Some(new_last_start) = range.end.next_up() {
                    to_update = Some((*last_start, new_last_start));
                }
            }
        }

        // All other ranges are for sure fully contained in `range`.
        to_remove.extend(overlaps.map(|(start, _)| *start));

        for start in to_remove {
            self.inner.remove(&start);
        }
        if let Some((old_start, new_start)) = to_update {
            // we are sure `old_start` exists in the map.
            let (end, value) = self.inner.remove(&old_start).unwrap();
            self.inner.insert(new_start, (end, value));
        }

        // Second part: update the potential range that starts before `range` and overlaps it.

        let mut overlaps = self.inner.range_mut((
            std::ops::Bound::Unbounded,
            std::ops::Bound::Included(range.start),
        ));
        if let Some((_before_start, (before_end, value))) = overlaps.next_back() {
            let old_before_end = *before_end;
            if range.start <= *before_end {
                // The range overlaps `range`, truncate it.
                if let Some(new_before_end) = range.start.next_down() {
                    *before_end = new_before_end
                }
            }
            if range.end < old_before_end {
                // `range` is fully contained in the range, we need to insert another range after
                // `range` with the same `value`.
                if let Some(new_before_start) = range.end.next_up() {
                    // TODO find a way to avoid cloning the value.
                    let value = value.clone();
                    self.inner.insert(new_before_start, (old_before_end, value));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_THIS() {
        let mut rm = RangeMap::<f64, bool>::new();
        rm.insert(
            Range {
                start: Bound::Excluded(0.0),
                end: Bound::Excluded(1.0),
            },
            true,
        );
        assert!(rm.get(0.0).is_none());
        assert!(rm.get(f64::next_up(0.0)) == Some(&true));
        assert!(rm.get(0.25) == Some(&true));
        assert!(rm.get(0.5) == Some(&true));
        assert!(rm.get(f64::next_down(1.0)) == Some(&true));
        assert!(rm.get(1.0).is_none());

        rm.insert(
            Range {
                start: Bound::Included(0.5),
                end: Bound::Unbounded,
            },
            false,
        );
        assert!(rm.get(0.0).is_none());
        assert!(rm.get(f64::next_up(0.0)) == Some(&true));
        assert!(rm.get(0.25) == Some(&true));
        assert!(rm.get(0.5) == Some(&false));
        assert!(rm.get(f64::next_down(1.0)) == Some(&false));
        assert!(rm.get(1.0) == Some(&false));
    }
}
