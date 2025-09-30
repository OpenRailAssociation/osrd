//! Port of Google's RangeMap.
//!
//! Ref: https://guava.dev/releases/22.0/api/docs/com/google/common/collect/RangeMap.html

use std::cmp::Ordering;
use std::collections::BTreeMap;
use std::fmt;
use std::ops::Bound;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LowerBound<T>(Bound<T>);

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct UpperBound<T>(Bound<T>);

impl<T> Eq for LowerBound<T> where T: PartialEq {}
impl<T> Eq for UpperBound<T> where T: PartialEq {}

impl<T> PartialOrd for LowerBound<T>
where
    LowerBound<T>: Ord,
{
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(Self::cmp(self, other))
    }
}

impl<T> PartialOrd for UpperBound<T>
where
    UpperBound<T>: Ord,
{
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(Self::cmp(self, other))
    }
}

impl Ord for LowerBound<f64> {
    fn cmp(&self, other: &Self) -> Ordering {
        match (&self.0, &other.0) {
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

impl Ord for LowerBound<i64> {
    fn cmp(&self, other: &Self) -> Ordering {
        match (&self.0, &other.0) {
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

impl Ord for UpperBound<f64> {
    fn cmp(&self, other: &Self) -> Ordering {
        match (&self.0, &other.0) {
            (Bound::Unbounded, Bound::Unbounded) => Ordering::Equal,
            (Bound::Unbounded, _) => Ordering::Greater,
            (_, Bound::Unbounded) => Ordering::Less,
            (Bound::Included(s), Bound::Excluded(o)) => {
                f64::total_cmp(s, o).then(Ordering::Greater)
            }
            (Bound::Excluded(s), Bound::Included(o)) => f64::total_cmp(s, o).then(Ordering::Less),
            (Bound::Included(s), Bound::Included(o)) => f64::total_cmp(s, o),
            (Bound::Excluded(s), Bound::Excluded(o)) => f64::total_cmp(s, o),
        }
    }
}

impl Ord for UpperBound<i64> {
    fn cmp(&self, other: &Self) -> Ordering {
        match (&self.0, &other.0) {
            (Bound::Unbounded, Bound::Unbounded) => Ordering::Equal,
            (Bound::Unbounded, _) => Ordering::Greater,
            (_, Bound::Unbounded) => Ordering::Less,
            (Bound::Included(s), Bound::Excluded(o)) => i64::cmp(s, o).then(Ordering::Greater),
            (Bound::Excluded(s), Bound::Included(o)) => i64::cmp(s, o).then(Ordering::Less),
            (Bound::Included(s), Bound::Included(o)) => i64::cmp(s, o),
            (Bound::Excluded(s), Bound::Excluded(o)) => i64::cmp(s, o),
        }
    }
}

impl<T> UpperBound<T> {
    /// Given `self` as the upper bound of a range, return the smallest lower bound a range can
    /// have after `self`.
    pub fn next_up(self) -> Option<LowerBound<T>> {
        match self.0 {
            Bound::Included(t) => Some(LowerBound(Bound::Excluded(t))),
            Bound::Excluded(t) => Some(LowerBound(Bound::Included(t))),
            Bound::Unbounded => None,
        }
    }
}

impl<T> LowerBound<T> {
    /// Given `self` as the lower bound of a range, return the highest upper bound a range can have
    /// before `self`.
    pub fn next_down(self) -> Option<UpperBound<T>> {
        match self.0 {
            Bound::Included(t) => Some(UpperBound(Bound::Excluded(t))),
            Bound::Excluded(t) => Some(UpperBound(Bound::Included(t))),
            Bound::Unbounded => None,
        }
    }
}

/// Given `(-∞..left` and `right..+∞)`, return whether both range intersect.
///
/// This function returns
/// - [`Ordering::Less`] if both ranges do not intersect
/// - [`Ordering::Equal`] if both ranges intersect on one point only
/// - [`Ordering::Greater`] if both ranges intersect on more than one point
fn cmplr<T>(left: UpperBound<T>, right: LowerBound<T>) -> Ordering
where
    T: PartialOrd,
{
    match (&left.0, &right.0) {
        (Bound::Unbounded, _) | (_, Bound::Unbounded) => Ordering::Less,
        (Bound::Included(s), Bound::Included(o)) => T::partial_cmp(s, o).unwrap_or(Ordering::Less),
        (Bound::Included(s), Bound::Excluded(o))
        | (Bound::Excluded(s), Bound::Included(o))
        | (Bound::Excluded(s), Bound::Excluded(o)) => {
            T::partial_cmp(s, o).map_or(Ordering::Less, |cmp| cmp.then(Ordering::Less))
        }
    }
}

/// An interval/continuous span of values between two bounds.
///
/// `start` may be greater than `end`, in which case the range is considered empty.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Range<T> {
    /// Lower bound
    pub start: LowerBound<T>,

    /// Upper bound
    pub end: UpperBound<T>,
}

impl<T> Range<T> {
    /// Create a new [`Range`].
    pub fn new(start: Bound<T>, end: Bound<T>) -> Self {
        Self {
            start: LowerBound(start),
            end: UpperBound(end),
        }
    }
}

impl<T> Range<T>
where
    T: PartialOrd,
{
    /// Check for `NaN`, or whether the range bounds are valid with regards to [`Eq`] requirements.
    ///
    /// This doesn't check whether `start` is greater than `end`.
    #[allow(clippy::eq_op)]
    pub fn is_valid(&self) -> bool {
        self.start.0 == self.start.0 && self.end.0 == self.end.0
    }

    /// Return whether the range does not contain any element.
    pub fn is_empty(&self) -> bool {
        !self.is_valid()
            || !match (&self.start.0, &self.end.0) {
                (Bound::Unbounded, _) | (_, Bound::Unbounded) => true,
                (Bound::Included(start), Bound::Excluded(end))
                | (Bound::Excluded(start), Bound::Included(end))
                | (Bound::Excluded(start), Bound::Excluded(end)) => start < end,
                (Bound::Included(start), Bound::Included(end)) => start <= end,
            }
    }

    /// Return whether the range contains the given `value`.
    pub fn contains(&self, value: T) -> bool {
        (match &self.start.0 {
            Bound::Included(start) => start <= &value,
            Bound::Excluded(start) => start < &value,
            Bound::Unbounded => true,
        }) && (match &self.end.0 {
            Bound::Included(end) => &value <= end,
            Bound::Excluded(end) => &value < end,
            Bound::Unbounded => true,
        })
    }
}

impl<T> fmt::Debug for Range<T>
where
    T: fmt::Debug,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.start.0 {
            Bound::Included(t) => write!(f, "[{t:?}")?,
            Bound::Excluded(t) => write!(f, "({t:?}")?,
            Bound::Unbounded => write!(f, "(-∞")?,
        }
        write!(f, "..")?;
        match &self.end.0 {
            Bound::Included(t) => write!(f, "{t:?}]"),
            Bound::Excluded(t) => write!(f, "{t:?})"),
            Bound::Unbounded => write!(f, "+∞)"),
        }
    }
}

/// A mapping from disjoint nonempty ranges to non-null values.
///
/// Queries look up the value associated with the range (if any) that contains a specified key.
pub struct RangeMap<K, V> {
    /// start of the range --> (end of the range, value associated with the range)
    inner: BTreeMap<LowerBound<K>, (UpperBound<K>, V)>,
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
    LowerBound<K>: Ord,
    UpperBound<K>: Ord,
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
            std::ops::Bound::Included(LowerBound(Bound::Included(key))),
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
        if range.is_empty() {
            // Prevent panics in the BTreeMap::range call.
            return;
        }

        let mut to_remove: Vec<LowerBound<K>> = Vec::new();
        let mut to_update: Option<(LowerBound<K>, LowerBound<K>)> = None;

        // First part: remove or truncate ranges that start in `range`.

        // TODO: use [BTreeMap::lower_bound] once it is stable
        // https://github.com/rust-lang/rust/issues/107540
        let overlaps = self.inner.range((
            std::ops::Bound::Included(range.start),
            std::ops::Bound::Unbounded,
        ));

        for (start, (end, _value)) in overlaps {
            if cmplr(range.end, *start) == Ordering::Less {
                break;
            }
            if &range.end < end {
                // start..end is the last range that starts in [range.start..range.end] since it
                // does not end in [range.start..range.end], so let's truncate it.

                if let Some(new_start) = range.end.next_up() {
                    to_update = Some((*start, new_start));
                }

                break;
            }

            to_remove.push(*start);
        }

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
            if !(Range {
                start: range.start,
                end: *before_end,
            })
            .is_empty()
            {
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

impl<K, V> fmt::Debug for RangeMap<K, V>
where
    K: fmt::Debug,
    V: fmt::Debug,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_this() {
        let mut rm = RangeMap::<f64, bool>::new();
        rm.insert(Range::new(Bound::Excluded(0.0), Bound::Excluded(1.0)), true);
        assert!(rm.get(0.0).is_none());
        assert!(rm.get(f64::next_up(0.0)) == Some(&true));
        assert!(rm.get(0.25) == Some(&true));
        assert!(rm.get(0.5) == Some(&true));
        assert!(rm.get(f64::next_down(1.0)) == Some(&true));
        assert!(rm.get(1.0).is_none());

        rm.insert(Range::new(Bound::Included(0.5), Bound::Unbounded), false);
        assert!(rm.get(0.0).is_none());
        assert!(rm.get(f64::next_up(0.0)) == Some(&true));
        assert!(rm.get(0.25) == Some(&true));
        assert!(rm.get(0.5) == Some(&false));
        assert!(rm.get(f64::next_down(1.0)) == Some(&false));
        assert!(rm.get(1.0) == Some(&false));
    }
}
