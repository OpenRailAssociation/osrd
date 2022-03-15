from collections import deque
from typing import (
    TypeVar, Generic,
    Iterator, Iterable,
    Deque, Sequence,
    Optional
)


ItemT = TypeVar('ItemT')


class PeekableIterator(Generic[ItemT]):
    """Wraps any iterable and provides a lookahead buffer"""
    __slots__ = ("iterator", "cache")

    iterator: Iterator[ItemT]
    cache: Deque[ItemT]

    def __init__(self, iterator: Iterator[ItemT]) -> None:
        self.iterator = iterator
        self.cache = deque()

    def _feed_cache(self) -> ItemT:
        new_val = next(self.iterator)
        self.cache.append(new_val)
        return new_val

    def is_empty(self) -> bool:
        if self.cache:
            return False
        try:
            self._feed_cache()
        except StopIteration:
            return True
        return False

    def prepend(self, elements: Sequence[ItemT]) -> None:
        """push back all elements into the read cache"""
        self.cache.extendleft(reversed(elements))

    def consume(self, count: int = 1) -> None:
        """Discards a given number of elements from the iterator"""
        assert count <= len(self.cache), "trying to consume unseen elements"
        for _ in range(count):
            self.cache.popleft()

    def __iter__(self) -> Iterator[ItemT]:
        return self

    def __next__(self) -> ItemT:
        if not self.cache:
            return next(self.iterator)
        return self.cache.popleft()

    def peek(self) -> ItemT:
        """Returns the next element of the iterator, without moving forward"""
        if not self.cache:
            self._feed_cache()
        return self.cache[0]

    def peek_iterator(self) -> Iterable[ItemT]:
        """streams all future elements without moving forward"""
        yield from self.cache
        while True:
            try:
                new_val = self._feed_cache()
            except StopIteration:
                return
            yield new_val

    def try_peek(self) -> Optional[ItemT]:
        """Behaves just like peek, but returns None at the end of the stream"""
        try:
            return self.peek()
        except StopIteration:
            return None
