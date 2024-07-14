#!/usr/bin/env python3
"""
Generates a bake for multiple containers, given tags and labels
as produced by the docker/metadata-action action.
"""

import os
import sys
import json
import subprocess
from dataclasses import dataclass
from typing import Optional, Union, List, Tuple, Callable, TypeAlias
from abc import ABC, abstractmethod


DEFAULT_EDGE_NAMESPACE = "ghcr.io/openrailassociation/osrd-edge"
DEFAULT_RELEASE_NAMESPACE = "ghcr.io/openrailassociation/osrd-stable"


@dataclass
class Target:
    name: str
    image: str
    variant: Optional[str] = None
    release: bool = False

    @property
    def suffix(self):
        if self.variant is None:
            return ""
        return f"-{self.variant}"


TARGETS = [
    Target(name="core", image="core", release=True),
    Target(name="core-build", image="core", variant="build"),

    Target(name="editoast", image="editoast", release=True),
    Target(name="editoast-test", image="editoast", variant="test"),

    Target(name="front-devel", image="front", variant="devel"),
    Target(name="front-nginx", image="front", variant="nginx"),
    Target(name="front-build", image="front", variant="build"),
    Target(name="front-tests", image="front", variant="tests"),

    Target(name="gateway-standalone", image="gateway", variant="standalone"),
    Target(name="gateway-test", image="gateway", variant="test"),
    Target(name="gateway-front", image="gateway", variant="front", release=True),

    Target(name="osrdyne", image="osrdyne", release=True),
    Target(name="osrdyne-test", image="osrdyne", variant="test"),
]


def short_hash(commit_hash: str) -> str:
    args = ["git", "rev-parse", "--short", commit_hash]
    res = subprocess.run(args, check=True, stdout=subprocess.PIPE)
    return res.stdout.decode().strip()


def parse_merge_commit(ref) -> Tuple[str, str]:
    args = ["git", "log", "-1", "--pretty=format:%s", ref]
    res = subprocess.run(args, check=True, stdout=subprocess.PIPE)
    merge_title = res.stdout.decode().strip()
    # expect "Merge XXX into YYY"
    merge, pr_commit, into, base_commit = merge_title.split()
    assert ("Merge", "into") == (merge, into)
    return (pr_commit, base_commit)


def registry_cache(image: str) -> str:
    return f"type=registry,mode=max,ref={image}-cache"


class BaseEvent(ABC):
    @abstractmethod
    def version_string(self) -> str:
        pass

    @abstractmethod
    def get_stable_version(self) -> str:
        pass

    def get_namespace(self) -> str:
        return DEFAULT_EDGE_NAMESPACE

    def tag(self, target: Target, version: str) -> str:
        image_name = f"{self.get_namespace()}/osrd-{target.image}"
        return f"{image_name}:{version}{target.suffix}"

    def get_stable_tag(self, target: Target) -> str:
        version = self.get_stable_version()
        return self.tag(target, version)

    def output_method(self):
        return "registry"

    def get_output(self, target: Target) -> List[str]:
        return ["type=registry"]

    def get_tags(self, target: Target) -> List[str]:
        return [self.get_stable_tag(target)]

    def get_cache_to(self, target: Target) -> List[str]:
        return []

    def get_cache_from(self, target: Target) -> List[str]:
        return []


@dataclass
class PullRequestEvent(BaseEvent):
    is_fork: bool
    pr_id: str
    pr_branch: str
    # the target branch name
    target_branch: str

    # the merge commit the CI runs on
    merge_hash: str
    # the head of the PR
    orig_hash: str
    # the target branch commit hash
    target_hash: str

    def version_string(self):
        return (
            f"pr {self.pr_id} ("
            f"merge of {self.pr_branch}@{short_hash(self.orig_hash)} "
            f"into {self.target_branch}@{short_hash(self.target_hash)})"
        )

    def get_stable_version(self) -> str:
        # edge/osrd-front:pr-42-HASH-nginx
        return f"pr-{self.pr_id}-{self.merge_hash}"

    def output_method(self):
        if not self.is_fork:
            return super().output_method()
        return "artifact"

    def get_output(self, target: Target) -> List[str]:
        if not self.is_fork:
            return super().get_output(target)
        return [f"type=docker,dest=osrd-{target.name}.tar"]

    def pr_tag(self, target: Target) -> str:
        # edge/osrd-front:pr-42-nginx  # pr-42 (merge of XXXX into XXXX)
        return self.tag(target, f"pr-{self.pr_id}")

    def get_tags(self, target: Target) -> List[str]:
        return [*super().get_tags(target), self.pr_tag(target)]

    def get_cache_to(self, target: Target) -> List[str]:
        if self.is_fork:
            return []
        return [registry_cache(self.pr_tag(target))]

    def get_cache_from(self, target: Target) -> List[str]:
        target_branch_cache = registry_cache(self.tag(target, self.target_branch))
        if self.is_fork:
            return [target_branch_cache]
        return [
            target_branch_cache,
            registry_cache(self.pr_tag(target)),
        ]


@dataclass
class MergeGroupEvent(BaseEvent):
    # the merge commit the CI runs on
    merge_hash: str
    # the ref the PR is merged into
    target_branch: str

    def version_string(self):
        return f"merge queue {self.merge_hash}"

    def get_stable_version(self) -> str:
        # edge/osrd-front:merge-queue-HASH
        return f"merge-queue-{self.merge_hash}"

    def get_cache_from(self, target: Target) -> List[str]:
        # we can't easily cache from the PRs, as multiple PRs
        # can be grouped into one merge group batch, and there's
        # no obvious way to figure out which ones
        return [registry_cache(self.tag(target, self.target_branch))]

    def get_cache_to(self, target: Target) -> List[str]:
        return [registry_cache(self.tag(target, self.target_branch))]


@dataclass
class BranchEvent(BaseEvent):
    branch_name: str
    protected: bool
    commit_hash: str

    def version_string(self):
        return f"{self.branch_name} {short_hash(self.commit_hash)}"

    def get_stable_version(self) -> str:
        # edge/osrd-front:dev-HASH-nginx
        return f"{self.branch_name}-{self.commit_hash}"

    def branch_tag(self, target: Target) -> str:
        # edge/osrd-front:dev-nginx  # dev XXXX
        return self.tag(target, self.branch_name)

    def get_tags(self, target: Target) -> List[str]:
        return [*super().get_tags(target), self.branch_tag(target)]

    def get_cache_to(self, target: Target) -> List[str]:
        return [registry_cache(self.branch_tag(target))]

    def get_cache_from(self, target: Target) -> List[str]:
        return [registry_cache(self.branch_tag(target))]


@dataclass
class ReleaseEvent(BaseEvent):
    tag_name: str
    commit_hash: str
    draft: bool

    def version_string(self):
        return f"{self.get_stable_version()} {short_hash(self.commit_hash)}"

    def get_stable_version(self) -> str:
        # stable/osrd-front:1.0-devel  # 1.0 XXXX
        name = self.tag_name
        if self.draft:
            name = f"{name}-draft"
        return name

    def get_namespace(self) -> str:
        return DEFAULT_RELEASE_NAMESPACE

    def get_tags(self, target: Target) -> List[str]:
        if not target.release:
            return []
        return super().get_tags(target)


Event: TypeAlias = Union[PullRequestEvent, MergeGroupEvent, BranchEvent, ReleaseEvent]


def parse_pr_id(ref: str) -> str:
    # refs/pull/<pr_number>/merge
    refs, pull, pr_number, merge = ref.split("/")
    assert (refs, pull, merge) == ("refs", "pull", "merge")
    return pr_number


def parse_event(context) -> Event:
    event_name = context["event_name"]
    event = context["event"]
    commit_hash = context["sha"]
    ref = context["ref"]
    ref_name = context["ref_name"]
    protected = context["ref_protected"] == "true"

    if event_name == "merge_group":
        merge_group = event["merge_group"]
        target_ref = merge_group["base_ref"]
        assert target_ref.startswith("refs/heads/")
        target_branch = target_ref.removeprefix("refs/heads/")
        return MergeGroupEvent(commit_hash, target_branch)

    if event_name == "release":
        release = event["release"]
        return ReleaseEvent(
            release["tag_name"],
            commit_hash,
            release["draft"],
        )

    if event_name in ("workflow_dispatch", "push"):
        return BranchEvent(ref_name, protected, commit_hash)

    if event_name == "pull_request":
        target_branch = context["base_ref"]
        orig_hash, target_hash = parse_merge_commit(commit_hash)
        repo_ctx = context["event"]["pull_request"]["head"]["repo"]
        is_fork = repo_ctx["fork"]
        return PullRequestEvent(
            is_fork=is_fork,
            pr_id=parse_pr_id(ref),
            pr_branch=context["head_ref"],
            target_branch=target_branch,
            merge_hash=commit_hash,
            orig_hash=orig_hash,
            target_hash=target_hash,
        )
    raise ValueError(f"unknown event type: {event_name}")


def generate_bake_file(event, targets):
    bake_targets = {}
    for target in targets:
        # TODO: add labels
        target_manifest = {
            "tags": event.get_tags(target),
            "output": event.get_output(target),
        }
        if cache_to := event.get_cache_to(target):
            target_manifest["cache-to"] = cache_to
        if cache_from := event.get_cache_from(target):
            target_manifest["cache-from"] = cache_from
        bake_targets[f"base-{target.name}"] = target_manifest

    version = event.version_string()
    bake_targets["base"] = {"args": {"OSRD_GIT_DESCRIBE": version}}
    return {"target": bake_targets}


def main():
    context = json.loads(os.environ["GITHUB_CONTEXT"])
    event = parse_event(context)
    bake_file = generate_bake_file(event, TARGETS)
    json.dump(bake_file, sys.stdout, indent=2)

    gh_output_path = os.environ["GITHUB_OUTPUT"]
    with open(gh_output_path, "a", encoding="utf-8") as f:
        stable_tags = {}
        for target in TARGETS:
            stable_tags[target.name] = event.get_stable_tag(target)
        print(f"stable_version={event.get_stable_version()}", file=f)
        print(f"stable_tags={json.dumps(stable_tags)}", file=f)
        print(f"output_method={event.output_method()}", file=f)


if __name__ == "__main__":
    main()
